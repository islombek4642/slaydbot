# Slaydbot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Telegram bot (Node.js/TypeScript) that collects presentation
parameters via buttons, has Claude generate JavaScript code against a
constrained `pptxgenjs` bridge API, executes that code inside an
`isolated-vm` sandbox, and delivers a finished `.pptx` file — with an
admin-managed access whitelist and Docker/webhook deploy matching the
existing QuizBot server infrastructure.

**Architecture:** Layered, dependency-injected modules — `config` (env/constants),
`i18n`, `db` (Prisma + repositories), `pptx` (builder/bridge/sandbox/themes/icons),
`ai` (Claude client/design guide/validator), `services` (orchestration), `bot`
(grammY handlers/conversations/keyboards). Nothing reads `process.env` or
constructs its own dependencies internally — everything is passed in, so
every unit is testable in isolation with plain mocks.

**Tech Stack:** TypeScript, grammY + @grammyjs/conversations, pptxgenjs,
isolated-vm, react-icons + react-dom/server + sharp, PostgreSQL + Prisma,
@anthropic-ai/sdk, zod, pino, Vitest, Docker.

**Reference spec:** `docs/superpowers/specs/2026-08-29-slaydbot-design.md`

---

## File Structure

```
package.json, tsconfig.json, vitest.config.ts, .gitignore, .env.example
Dockerfile, docker-compose.yml
scripts/deploy.sh
prisma/schema.prisma
prisma.config.ts
src/
  index.ts                              # entrypoint: webhook HTTP server
  logger.ts
  config/
    env.ts                              # Zod env schema + loadEnv()
    constants.ts                        # slide counts, languages, themes, sandbox limits
  i18n/
    locales/uz.json
    t.ts
  db/
    client.ts                           # createDbClient(databaseUrl) via @prisma/adapter-pg
    repositories/
      userRepository.ts
      presentationRepository.ts
  pptx/
    presentationBuilder.ts              # wraps pptxgenjs
    bridge.ts                           # sandbox-facing function set
    sandbox.ts                          # isolated-vm runner
    themes/
      types.ts
      corporate.ts
      creative.ts
      minimal.ts
      dark.ts
      index.ts
    icons/
      iconSet.ts                        # curated react-icons list
      renderer.ts                       # react-icons -> SVG -> PNG
      iconCache.ts                      # per-theme render cache
  ai/
    codeValidator.ts
    designGuide.ts                      # system prompt builder
    client.ts                           # Anthropic SDK wrapper
  services/
    presentationService.ts              # orchestrates the whole generation flow
  bot/
    context.ts                          # MyContext type
    superAdmin.ts
    index.ts                            # createBot(): wires handlers/conversations
    middlewares/
      accessControl.ts
    keyboards/
      mainMenu.ts
      adminMenu.ts
      wizardKeyboards.ts
    handlers/
      start.ts
      help.ts
      listUsers.ts
    conversations/
      parsers.ts                        # pure parsing helpers (testable)
      presentationWizard.ts
      adminAddUser.ts
      adminRemoveUser.ts
      adminPromote.ts
tests/                                   # mirrors src/
```

---

### Task 1: Project scaffold

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `.gitignore`

- [ ] **Step 1: Initialize package.json**

Run: `npm init -y`

- [ ] **Step 2: Install runtime dependencies**

Run:
```bash
npm install grammy @grammyjs/conversations pptxgenjs isolated-vm \
  react react-dom react-icons sharp @anthropic-ai/sdk \
  @prisma/client zod pino dotenv
```

- [ ] **Step 3: Install dev dependencies**

Run:
```bash
npm install -D typescript vitest tsx prisma \
  @types/node @types/react @types/react-dom
```

- [ ] **Step 4: Write tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "CommonJS",
    "moduleResolution": "Node",
    "lib": ["ES2022"],
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "sourceMap": true
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

- [ ] **Step 5: Write vitest.config.ts**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    testTimeout: 20000,
  },
});
```

- [ ] **Step 6: Write .gitignore**

```
node_modules/
dist/
.env
backups/
*.log
```

- [ ] **Step 7: Edit package.json scripts**

Open `package.json` and replace the `"scripts"` block with:

```json
"scripts": {
  "dev": "tsx watch src/index.ts",
  "build": "tsc -p tsconfig.json",
  "start": "node dist/index.js",
  "test": "vitest run",
  "test:watch": "vitest",
  "prisma:generate": "prisma generate",
  "prisma:migrate": "prisma migrate deploy"
}
```

- [ ] **Step 8: Verify tooling installed correctly**

Run: `npx tsc --version && npx vitest --version`
Expected: both commands print version numbers with no errors.

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json tsconfig.json vitest.config.ts .gitignore
git commit -m "chore: scaffold Node/TypeScript project with grammY, pptxgenjs, Prisma, Vitest"
```

---

### Task 2: Environment config (config/env.ts)

**Files:**
- Create: `src/config/env.ts`
- Test: `tests/config/env.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/config/env.test.ts
import { describe, it, expect } from "vitest";
import { loadEnv } from "../../src/config/env";

describe("loadEnv", () => {
  const validEnv = {
    BOT_TOKEN: "123:abc",
    SUPER_ADMIN_ID: "111111111",
    DATABASE_URL: "postgresql://user:pass@localhost:5432/slaydbot",
    ANTHROPIC_API_KEY: "sk-ant-test",
    WEBHOOK_DOMAIN: "xamidullayevi.uz",
    WEBHOOK_SECRET: "supersecret",
  };

  it("parses a valid environment", () => {
    const env = loadEnv(validEnv);
    expect(env.BOT_TOKEN).toBe("123:abc");
    expect(env.SUPER_ADMIN_ID).toBe(111111111n);
    expect(env.PORT).toBe(3000);
    expect(env.CLAUDE_MODEL).toBe("claude-opus-4-5");
  });

  it("throws when BOT_TOKEN is missing", () => {
    const { BOT_TOKEN, ...rest } = validEnv;
    expect(() => loadEnv(rest)).toThrow(/BOT_TOKEN/);
  });

  it("allows overriding CLAUDE_MODEL and PORT", () => {
    const env = loadEnv({ ...validEnv, CLAUDE_MODEL: "claude-x", PORT: "8080" });
    expect(env.CLAUDE_MODEL).toBe("claude-x");
    expect(env.PORT).toBe(8080);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/config/env.test.ts`
Expected: FAIL — `Cannot find module '../../src/config/env'`

- [ ] **Step 3: Write the implementation**

```ts
// src/config/env.ts
import { z } from "zod";

const envSchema = z.object({
  BOT_TOKEN: z.string().min(1, "BOT_TOKEN is required"),
  SUPER_ADMIN_ID: z.coerce.bigint(),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  ANTHROPIC_API_KEY: z.string().min(1, "ANTHROPIC_API_KEY is required"),
  CLAUDE_MODEL: z.string().default("claude-opus-4-5"),
  WEBHOOK_DOMAIN: z.string().min(1, "WEBHOOK_DOMAIN is required"),
  WEBHOOK_SECRET: z.string().min(1, "WEBHOOK_SECRET is required"),
  PORT: z.coerce.number().int().positive().default(3000),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: Record<string, string | undefined> = process.env): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid environment configuration: ${issues}`);
  }
  return result.data;
}
```

Note: `loadEnv` is a pure function, never auto-executed at import time. Every
other module receives its config values as constructor/function parameters
instead of importing a global singleton — this keeps every module testable
without a real environment.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/config/env.test.ts`
Expected: 3 passed

- [ ] **Step 5: Commit**

```bash
git add src/config/env.ts tests/config/env.test.ts
git commit -m "feat: add Zod-validated environment config"
```

---

### Task 3: Constants (config/constants.ts)

**Files:**
- Create: `src/config/constants.ts`
- Test: `tests/config/constants.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/config/constants.test.ts
import { describe, it, expect } from "vitest";
import {
  SLIDE_COUNT_OPTIONS,
  PRESENTATION_LANGUAGES,
  THEME_NAMES,
  SANDBOX_TIMEOUT_MS,
  SANDBOX_MEMORY_LIMIT_MB,
} from "../../src/config/constants";

describe("constants", () => {
  it("defines the expected slide count options", () => {
    expect(SLIDE_COUNT_OPTIONS).toEqual([5, 10, 15, 20]);
  });

  it("defines uz, ru, en languages", () => {
    expect(PRESENTATION_LANGUAGES.map((l) => l.code)).toEqual(["uz", "ru", "en"]);
  });

  it("defines four unique theme names", () => {
    expect(THEME_NAMES).toEqual(["corporate", "creative", "minimal", "dark"]);
    expect(new Set(THEME_NAMES).size).toBe(THEME_NAMES.length);
  });

  it("defines sane sandbox limits", () => {
    expect(SANDBOX_TIMEOUT_MS).toBe(5000);
    expect(SANDBOX_MEMORY_LIMIT_MB).toBe(128);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/config/constants.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

```ts
// src/config/constants.ts
export const SLIDE_COUNT_OPTIONS = [5, 10, 15, 20] as const;
export type SlideCountOption = (typeof SLIDE_COUNT_OPTIONS)[number];

export const PRESENTATION_LANGUAGES = [
  { code: "uz", label: "O'zbek" },
  { code: "ru", label: "Rus" },
  { code: "en", label: "Ingliz" },
] as const;
export type PresentationLanguageCode = (typeof PRESENTATION_LANGUAGES)[number]["code"];

export const THEME_NAMES = ["corporate", "creative", "minimal", "dark"] as const;
export type ThemeName = (typeof THEME_NAMES)[number];

export const SANDBOX_TIMEOUT_MS = 5000;
export const SANDBOX_MEMORY_LIMIT_MB = 128;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/config/constants.test.ts`
Expected: 4 passed

- [ ] **Step 5: Commit**

```bash
git add src/config/constants.ts tests/config/constants.test.ts
git commit -m "feat: add shared constants (slide counts, languages, themes, sandbox limits)"
```

---

### Task 4: i18n (locale + translator)

**Files:**
- Create: `src/i18n/locales/uz.json`
- Create: `src/i18n/t.ts`
- Test: `tests/i18n/t.test.ts`

- [ ] **Step 1: Write the uz locale file**

```json
{
  "start.welcome": "Xush kelibsiz! Quyidagi menyudan foydalaning.",
  "start.accessDenied": "Kirish cheklangan. Administrator bilan bog'laning.",
  "help.text": "Bu bot AI yordamida taqdimot (.pptx) yaratadi. \"🎨 Taqdimot yaratish\" tugmasini bosing va ko'rsatmalarga amal qiling.",
  "menu.createPresentation": "🎨 Taqdimot yaratish",
  "menu.adminPanel": "⚙️ Admin panel",
  "menu.back": "🔙 Orqaga",
  "admin.addUser": "➕ Foydalanuvchi qo'shish",
  "admin.removeUser": "➖ Foydalanuvchi o'chirish",
  "admin.listUsers": "📋 Ro'yxat",
  "admin.promote": "⬆️ Admin qilish",
  "admin.addUser.askId": "Foydalanuvchining Telegram ID raqamini yuboring:",
  "admin.addUser.success": "Foydalanuvchi qo'shildi.",
  "admin.removeUser.askId": "O'chiriladigan foydalanuvchi Telegram ID raqamini yuboring:",
  "admin.removeUser.success": "Foydalanuvchi o'chirildi.",
  "admin.promote.askId": "Admin qilinadigan foydalanuvchi Telegram ID raqamini yuboring:",
  "admin.promote.success": "Foydalanuvchi admin qilindi.",
  "admin.listUsers.empty": "Ro'yxat bo'sh.",
  "admin.listUsers.item": "{{index}}. {{name}} — ID: {{id}}",
  "wizard.askTopic": "Taqdimot mavzusini yozing:",
  "wizard.askSlideCount": "Nechta slayd bo'lsin?",
  "wizard.askLanguage": "Taqdimot tilini tanlang:",
  "wizard.askTheme": "Dizayn uslubini tanlang:",
  "wizard.generating": "Tayyorlanmoqda, biroz kuting...",
  "wizard.cancel": "❌ Bekor qilish",
  "wizard.cancelled": "Bekor qilindi.",
  "wizard.success": "Taqdimot tayyor!",
  "wizard.error": "Taqdimot yaratishda xatolik yuz berdi. Qaytadan urinib ko'ring."
}
```

- [ ] **Step 2: Write the failing test**

```ts
// tests/i18n/t.test.ts
import { describe, it, expect } from "vitest";
import { t } from "../../src/i18n/t";

describe("t", () => {
  it("returns the translation for a known key", () => {
    expect(t("wizard.cancelled")).toBe("Bekor qilindi.");
  });

  it("interpolates params", () => {
    const result = t("admin.listUsers.item", { index: 1, name: "Ali", id: 555 });
    expect(result).toBe("1. Ali — ID: 555");
  });

  it("throws for an unknown key", () => {
    expect(() => t("nonexistent.key" as any)).toThrow(/Missing translation/);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run tests/i18n/t.test.ts`
Expected: FAIL — module not found

- [ ] **Step 4: Write the implementation**

```ts
// src/i18n/t.ts
import uz from "./locales/uz.json";

type Locale = typeof uz;
export type TranslationKey = keyof Locale;

const locales: Record<string, Locale> = { uz };

export function t(
  key: TranslationKey,
  params?: Record<string, string | number>,
  locale = "uz"
): string {
  const dict = locales[locale] ?? locales.uz;
  let text: string | undefined = dict[key];
  if (text === undefined) {
    throw new Error(`Missing translation for key "${key}" in locale "${locale}"`);
  }
  if (params) {
    for (const [paramKey, value] of Object.entries(params)) {
      text = text.replaceAll(`{{${paramKey}}}`, String(value));
    }
  }
  return text;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/i18n/t.test.ts`
Expected: 3 passed

- [ ] **Step 6: Commit**

```bash
git add src/i18n tests/i18n
git commit -m "feat: add uz locale and translation lookup helper"
```

---

### Task 5: Prisma schema and DB client

**Files:**
- Create: `prisma/schema.prisma`
- Create: `src/db/client.ts`

- [ ] **Step 1: Write the schema**

> **Correction (discovered during implementation):** the installed version is
> Prisma 7.10.0, which removed `url = env("DATABASE_URL")` from the
> `datasource` block (hard validation error P1012) AND removed implicit
> env-based connection from a bare `new PrismaClient()`. A driver adapter
> must be constructed explicitly and passed to the client, and CLI commands
> (`prisma generate`/`migrate deploy`) need a `prisma.config.ts` with the
> datasource URL. The schema and client code below reflect this; see the
> added `prisma.config.ts` step.

```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
}

model User {
  id            BigInt         @id
  username      String?
  firstName     String?
  isAdmin       Boolean        @default(false)
  addedById     BigInt?
  addedBy       User?          @relation("UserAddedBy", fields: [addedById], references: [id])
  addedUsers    User[]         @relation("UserAddedBy")
  createdAt     DateTime       @default(now())
  presentations Presentation[]
}

model Presentation {
  id           String             @id @default(cuid())
  userId       BigInt
  user         User               @relation(fields: [userId], references: [id])
  topic        String
  slideCount   Int
  language     String
  theme        String
  status       PresentationStatus @default(PENDING)
  errorMessage String?
  createdAt    DateTime           @default(now())
}

enum PresentationStatus {
  PENDING
  SUCCESS
  FAILED
}
```

- [ ] **Step 2: Install the Postgres driver adapter**

Run: `npm install @prisma/adapter-pg pg && npm install -D @types/pg`

- [ ] **Step 3: Write the DB client factory**

```ts
// src/db/client.ts
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

export function createDbClient(databaseUrl: string): PrismaClient {
  const adapter = new PrismaPg({ connectionString: databaseUrl });
  return new PrismaClient({ adapter });
}

export type Db = PrismaClient;
```

Note the signature takes `databaseUrl` explicitly (consistent with this
project's rule that only the entrypoint reads `process.env` — see Task 2).
The entrypoint (Task 27) calls `createDbClient(env.DATABASE_URL)`.

- [ ] **Step 4: Write prisma.config.ts**

The Prisma CLI (`prisma generate`, `prisma migrate deploy`) needs its own
config file for the datasource URL, separate from the runtime client above:

```ts
// prisma.config.ts
import "dotenv/config";
import { defineConfig, env } from "@prisma/config";

export default defineConfig({
  datasource: {
    url: env("DATABASE_URL"),
  },
});
```

(Verified against `node_modules/@prisma/config/dist/index.d.ts` on the
installed 7.10.0 — `defineConfig`/`env` are exported from `@prisma/config`,
not `prisma/config`. The `import "dotenv/config"` line is required: `env()`
reads `process.env` directly and does not load `.env` itself, so without
this import the Prisma CLI fails with `PrismaConfigEnvError` on a fresh
checkout.)

- [ ] **Step 5: Generate the Prisma client**

Run: `npx prisma generate`
Expected: `✔ Generated Prisma Client`

- [ ] **Step 6: Validate the schema and config**

Run: `npx prisma validate`
Expected: schema is valid, no P1012 or config errors.

Note: this task has no unit test — it defines schema/types consumed and
tested through the repositories in Tasks 6–7. `prisma generate` +
`prisma validate` are this task's verification steps.

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma prisma.config.ts src/db/client.ts package.json package-lock.json
git commit -m "feat: add Prisma schema (User, Presentation) and driver-adapter DB client"
```

---

### Task 6: UserRepository

**Files:**
- Create: `src/db/repositories/userRepository.ts`
- Test: `tests/db/repositories/userRepository.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/db/repositories/userRepository.test.ts
import { describe, it, expect, vi } from "vitest";
import { UserRepository } from "../../../src/db/repositories/userRepository";

function createMockDb() {
  return {
    user: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
    },
  };
}

describe("UserRepository", () => {
  it("isAllowed returns true when the user exists", async () => {
    const db = createMockDb();
    db.user.findUnique.mockResolvedValue({ id: 1n, isAdmin: false });
    const repo = new UserRepository(db as any);
    await expect(repo.isAllowed(1n)).resolves.toBe(true);
  });

  it("isAllowed returns false when the user does not exist", async () => {
    const db = createMockDb();
    db.user.findUnique.mockResolvedValue(null);
    const repo = new UserRepository(db as any);
    await expect(repo.isAllowed(1n)).resolves.toBe(false);
  });

  it("isAdmin returns the stored isAdmin flag", async () => {
    const db = createMockDb();
    db.user.findUnique.mockResolvedValue({ id: 1n, isAdmin: true });
    const repo = new UserRepository(db as any);
    await expect(repo.isAdmin(1n)).resolves.toBe(true);
  });

  it("isAdmin returns false for a user that does not exist", async () => {
    const db = createMockDb();
    db.user.findUnique.mockResolvedValue(null);
    const repo = new UserRepository(db as any);
    await expect(repo.isAdmin(1n)).resolves.toBe(false);
  });

  it("add upserts a non-admin user recording who added them", async () => {
    const db = createMockDb();
    db.user.upsert.mockResolvedValue({ id: 2n, isAdmin: false });
    const repo = new UserRepository(db as any);
    await repo.add(2n, 1n, { username: "ali" });
    expect(db.user.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 2n },
        create: expect.objectContaining({ id: 2n, addedById: 1n, isAdmin: false, username: "ali" }),
      })
    );
  });

  it("remove deletes the user by id", async () => {
    const db = createMockDb();
    const repo = new UserRepository(db as any);
    await repo.remove(5n);
    expect(db.user.delete).toHaveBeenCalledWith({ where: { id: 5n } });
  });

  it("promote sets isAdmin to true", async () => {
    const db = createMockDb();
    const repo = new UserRepository(db as any);
    await repo.promote(5n);
    expect(db.user.update).toHaveBeenCalledWith({ where: { id: 5n }, data: { isAdmin: true } });
  });

  it("ensureSuperAdmin upserts the given id as an admin", async () => {
    const db = createMockDb();
    const repo = new UserRepository(db as any);
    await repo.ensureSuperAdmin(9n);
    expect(db.user.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 9n },
        update: { isAdmin: true },
        create: expect.objectContaining({ id: 9n, isAdmin: true, addedById: null }),
      })
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/db/repositories/userRepository.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

```ts
// src/db/repositories/userRepository.ts
import type { Db } from "../client";

export interface UserRecord {
  id: bigint;
  username: string | null;
  firstName: string | null;
  isAdmin: boolean;
  addedById: bigint | null;
  createdAt: Date;
}

export interface UserProfile {
  username?: string;
  firstName?: string;
}

export class UserRepository {
  constructor(private readonly db: Db) {}

  async findById(id: bigint): Promise<UserRecord | null> {
    return this.db.user.findUnique({ where: { id } });
  }

  async isAllowed(id: bigint): Promise<boolean> {
    const user = await this.findById(id);
    return user !== null;
  }

  async isAdmin(id: bigint): Promise<boolean> {
    const user = await this.findById(id);
    return user?.isAdmin ?? false;
  }

  async add(id: bigint, addedById: bigint | null, profile: UserProfile = {}): Promise<UserRecord> {
    return this.db.user.upsert({
      where: { id },
      update: {},
      create: {
        id,
        addedById,
        username: profile.username,
        firstName: profile.firstName,
        isAdmin: false,
      },
    });
  }

  async remove(id: bigint): Promise<void> {
    await this.db.user.delete({ where: { id } });
  }

  async promote(id: bigint): Promise<UserRecord> {
    return this.db.user.update({ where: { id }, data: { isAdmin: true } });
  }

  async listAll(): Promise<UserRecord[]> {
    return this.db.user.findMany({ orderBy: { createdAt: "asc" } });
  }

  async ensureSuperAdmin(id: bigint): Promise<void> {
    await this.db.user.upsert({
      where: { id },
      update: { isAdmin: true },
      create: { id, isAdmin: true, addedById: null },
    });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/db/repositories/userRepository.test.ts`
Expected: 8 passed

- [ ] **Step 5: Commit**

```bash
git add src/db/repositories/userRepository.ts tests/db/repositories/userRepository.test.ts
git commit -m "feat: add UserRepository (whitelist, admin, super-admin seed)"
```

---

### Task 7: PresentationRepository

**Files:**
- Create: `src/db/repositories/presentationRepository.ts`
- Test: `tests/db/repositories/presentationRepository.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/db/repositories/presentationRepository.test.ts
import { describe, it, expect, vi } from "vitest";
import { PresentationRepository } from "../../../src/db/repositories/presentationRepository";

function createMockDb() {
  return {
    presentation: {
      create: vi.fn(),
      update: vi.fn(),
    },
  };
}

describe("PresentationRepository", () => {
  it("create stores a PENDING record and returns its id", async () => {
    const db = createMockDb();
    db.presentation.create.mockResolvedValue({ id: "pres_1" });
    const repo = new PresentationRepository(db as any);
    const result = await repo.create({
      userId: 1n,
      topic: "AI tarixi",
      slideCount: 10,
      language: "uz",
      theme: "corporate",
    });
    expect(result).toEqual({ id: "pres_1" });
    expect(db.presentation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ topic: "AI tarixi", status: "PENDING" }),
      })
    );
  });

  it("markSuccess sets status to SUCCESS", async () => {
    const db = createMockDb();
    const repo = new PresentationRepository(db as any);
    await repo.markSuccess("pres_1");
    expect(db.presentation.update).toHaveBeenCalledWith({
      where: { id: "pres_1" },
      data: { status: "SUCCESS" },
    });
  });

  it("markFailed sets status to FAILED with an error message", async () => {
    const db = createMockDb();
    const repo = new PresentationRepository(db as any);
    await repo.markFailed("pres_1", "boom");
    expect(db.presentation.update).toHaveBeenCalledWith({
      where: { id: "pres_1" },
      data: { status: "FAILED", errorMessage: "boom" },
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/db/repositories/presentationRepository.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

```ts
// src/db/repositories/presentationRepository.ts
import type { Db } from "../client";

export interface CreatePresentationInput {
  userId: bigint;
  topic: string;
  slideCount: number;
  language: string;
  theme: string;
}

export class PresentationRepository {
  constructor(private readonly db: Db) {}

  async create(input: CreatePresentationInput): Promise<{ id: string }> {
    return this.db.presentation.create({
      data: { ...input, status: "PENDING" },
      select: { id: true },
    });
  }

  async markSuccess(id: string): Promise<void> {
    await this.db.presentation.update({ where: { id }, data: { status: "SUCCESS" } });
  }

  async markFailed(id: string, errorMessage: string): Promise<void> {
    await this.db.presentation.update({
      where: { id },
      data: { status: "FAILED", errorMessage },
    });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/db/repositories/presentationRepository.test.ts`
Expected: 3 passed

- [ ] **Step 5: Commit**

```bash
git add src/db/repositories/presentationRepository.ts tests/db/repositories/presentationRepository.test.ts
git commit -m "feat: add PresentationRepository (generation history)"
```

---

### Task 8: PresentationBuilder (pptxgenjs wrapper)

**Files:**
- Create: `src/pptx/presentationBuilder.ts`
- Test: `tests/pptx/presentationBuilder.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/pptx/presentationBuilder.test.ts
import { describe, it, expect } from "vitest";
import { PresentationBuilder } from "../../src/pptx/presentationBuilder";

describe("PresentationBuilder", () => {
  it("creates a slide and returns its index", () => {
    const builder = new PresentationBuilder();
    const index = builder.addSlide();
    expect(index).toBe(0);
    expect(builder.slideCount()).toBe(1);
  });

  it("assigns increasing indexes to subsequent slides", () => {
    const builder = new PresentationBuilder();
    expect(builder.addSlide()).toBe(0);
    expect(builder.addSlide()).toBe(1);
    expect(builder.slideCount()).toBe(2);
  });

  it("throws when adding text to a non-existent slide", () => {
    const builder = new PresentationBuilder();
    expect(() => builder.addText(0, "Salom")).toThrow(/Slide index 0 does not exist/);
  });

  it("produces a non-empty pptx buffer", async () => {
    const builder = new PresentationBuilder();
    const index = builder.addSlide();
    builder.addText(index, "Salom dunyo");
    const buffer = await builder.toBuffer();
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/pptx/presentationBuilder.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

```ts
// src/pptx/presentationBuilder.ts
import PptxGenJS from "pptxgenjs";

export class PresentationBuilder {
  private readonly pptx: InstanceType<typeof PptxGenJS>;
  private readonly slides: PptxGenJS.Slide[] = [];

  constructor() {
    this.pptx = new PptxGenJS();
  }

  addSlide(): number {
    const slide = this.pptx.addSlide();
    this.slides.push(slide);
    return this.slides.length - 1;
  }

  addText(slideIndex: number, text: string, options: PptxGenJS.TextPropsOptions = {}): void {
    // pptxgenjs mutates the options object in place (fills in defaults); clone
    // it so callers never see their own objects change out from under them.
    this.getSlide(slideIndex).addText(text, { ...options });
  }

  addImage(slideIndex: number, options: PptxGenJS.ImageProps): void {
    this.getSlide(slideIndex).addImage({ ...options });
  }

  addChart(
    slideIndex: number,
    type: PptxGenJS.CHART_NAME,
    data: PptxGenJS.OptsChartData[],
    options: PptxGenJS.IChartOpts = {}
  ): void {
    this.getSlide(slideIndex).addChart(type, data, { ...options });
  }

  addShape(slideIndex: number, shapeType: PptxGenJS.SHAPE_NAME, options: PptxGenJS.ShapeProps = {}): void {
    this.getSlide(slideIndex).addShape(shapeType, { ...options });
  }

  slideCount(): number {
    return this.slides.length;
  }

  async toBuffer(): Promise<Buffer> {
    return this.pptx.write({ outputType: "nodebuffer" }) as Promise<Buffer>;
  }

  private getSlide(index: number): PptxGenJS.Slide {
    const slide = this.slides[index];
    if (!slide) {
      throw new Error(`Slide index ${index} does not exist`);
    }
    return slide;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/pptx/presentationBuilder.test.ts`
Expected: 4 passed

- [ ] **Step 5: Commit**

```bash
git add src/pptx/presentationBuilder.ts tests/pptx/presentationBuilder.test.ts
git commit -m "feat: add PresentationBuilder wrapping pptxgenjs"
```

---

### Task 9: Themes

**Files:**
- Create: `src/pptx/themes/types.ts`
- Create: `src/pptx/themes/corporate.ts`
- Create: `src/pptx/themes/creative.ts`
- Create: `src/pptx/themes/minimal.ts`
- Create: `src/pptx/themes/dark.ts`
- Create: `src/pptx/themes/index.ts`
- Test: `tests/pptx/themes/index.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/pptx/themes/index.test.ts
import { describe, it, expect } from "vitest";
import { getTheme, THEMES } from "../../../src/pptx/themes";
import { THEME_NAMES } from "../../../src/config/constants";

describe("themes", () => {
  it("has a theme defined for every constant theme name", () => {
    for (const name of THEME_NAMES) {
      expect(THEMES[name]).toBeDefined();
      expect(getTheme(name).name).toBe(name);
    }
  });

  it("each theme has valid 6-digit hex colors", () => {
    const hexPattern = /^[0-9A-Fa-f]{6}$/;
    for (const theme of Object.values(THEMES)) {
      expect(theme.primaryColor).toMatch(hexPattern);
      expect(theme.secondaryColor).toMatch(hexPattern);
      expect(theme.backgroundColor).toMatch(hexPattern);
      expect(theme.textColor).toMatch(hexPattern);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/pptx/themes/index.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

```ts
// src/pptx/themes/types.ts
export interface Theme {
  name: string;
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  textColor: string;
  fontFace: string;
}
```

```ts
// src/pptx/themes/corporate.ts
import type { Theme } from "./types";

export const corporateTheme: Theme = {
  name: "corporate",
  primaryColor: "1F3864",
  secondaryColor: "2E75B6",
  backgroundColor: "FFFFFF",
  textColor: "1A1A1A",
  fontFace: "Calibri",
};
```

```ts
// src/pptx/themes/creative.ts
import type { Theme } from "./types";

export const creativeTheme: Theme = {
  name: "creative",
  primaryColor: "D6249F",
  secondaryColor: "FF7A00",
  backgroundColor: "FFFDF7",
  textColor: "2B2B2B",
  fontFace: "Poppins",
};
```

```ts
// src/pptx/themes/minimal.ts
import type { Theme } from "./types";

export const minimalTheme: Theme = {
  name: "minimal",
  primaryColor: "111111",
  secondaryColor: "888888",
  backgroundColor: "FFFFFF",
  textColor: "111111",
  fontFace: "Helvetica",
};
```

```ts
// src/pptx/themes/dark.ts
import type { Theme } from "./types";

export const darkTheme: Theme = {
  name: "dark",
  primaryColor: "60A5FA",
  secondaryColor: "34D399",
  backgroundColor: "0F172A",
  textColor: "F1F5F9",
  fontFace: "Calibri",
};
```

```ts
// src/pptx/themes/index.ts
import type { ThemeName } from "../../config/constants";
import type { Theme } from "./types";
import { corporateTheme } from "./corporate";
import { creativeTheme } from "./creative";
import { minimalTheme } from "./minimal";
import { darkTheme } from "./dark";

export const THEMES: Record<ThemeName, Theme> = {
  corporate: corporateTheme,
  creative: creativeTheme,
  minimal: minimalTheme,
  dark: darkTheme,
};

export function getTheme(name: ThemeName): Theme {
  return THEMES[name];
}

export type { Theme };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/pptx/themes/index.test.ts`
Expected: 2 passed

- [ ] **Step 5: Commit**

```bash
git add src/pptx/themes tests/pptx/themes
git commit -m "feat: add corporate/creative/minimal/dark presentation themes"
```

---

### Task 10: Icon set and renderer

**Files:**
- Create: `src/pptx/icons/iconSet.ts`
- Create: `src/pptx/icons/renderer.ts`
- Test: `tests/pptx/icons/renderer.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/pptx/icons/renderer.test.ts
import { describe, it, expect } from "vitest";
import { renderIconToSvg, renderIconToPngDataUri } from "../../../src/pptx/icons/renderer";

describe("icon renderer", () => {
  it("renders a known icon to an svg string containing the requested color", () => {
    const svg = renderIconToSvg("FaStar", "FF0000");
    expect(svg).toContain("<svg");
    expect(svg).toContain("#FF0000");
  });

  it("throws for an unknown icon name", () => {
    expect(() => renderIconToSvg("NotAnIcon" as any, "FF0000")).toThrow(/Unknown icon/);
  });

  it("renders a known icon to a base64 png data uri", async () => {
    const dataUri = await renderIconToPngDataUri("FaStar", "FF0000");
    expect(dataUri.startsWith("data:image/png;base64,")).toBe(true);
    expect(dataUri.length).toBeGreaterThan(50);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/pptx/icons/renderer.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the icon set**

```ts
// src/pptx/icons/iconSet.ts
import type { IconType } from "react-icons";
import {
  FaChartBar,
  FaChartLine,
  FaChartPie,
  FaUsers,
  FaLightbulb,
  FaRocket,
  FaCheckCircle,
  FaCog,
  FaGlobe,
  FaMoneyBillWave,
  FaCalendarAlt,
  FaBullseye,
  FaHandshake,
  FaShieldAlt,
  FaGraduationCap,
  FaStar,
} from "react-icons/fa";

export const ICON_SET: Record<string, IconType> = {
  FaChartBar,
  FaChartLine,
  FaChartPie,
  FaUsers,
  FaLightbulb,
  FaRocket,
  FaCheckCircle,
  FaCog,
  FaGlobe,
  FaMoneyBillWave,
  FaCalendarAlt,
  FaBullseye,
  FaHandshake,
  FaShieldAlt,
  FaGraduationCap,
  FaStar,
};

export type IconName = keyof typeof ICON_SET;
export const ICON_NAMES = Object.keys(ICON_SET) as IconName[];
```

- [ ] **Step 4: Write the renderer**

```ts
// src/pptx/icons/renderer.ts
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import sharp from "sharp";
import { ICON_SET, type IconName } from "./iconSet";

const RENDER_SIZE_PX = 128;

export function renderIconToSvg(iconName: IconName, colorHex: string): string {
  const Icon = ICON_SET[iconName];
  if (!Icon) {
    throw new Error(`Unknown icon: ${iconName}`);
  }
  return renderToStaticMarkup(React.createElement(Icon, { size: RENDER_SIZE_PX, color: `#${colorHex}` }));
}

export async function renderIconToPngDataUri(iconName: IconName, colorHex: string): Promise<string> {
  const svg = renderIconToSvg(iconName, colorHex);
  const pngBuffer = await sharp(Buffer.from(svg)).png().toBuffer();
  return `data:image/png;base64,${pngBuffer.toString("base64")}`;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/pptx/icons/renderer.test.ts`
Expected: 3 passed

- [ ] **Step 6: Commit**

```bash
git add src/pptx/icons/iconSet.ts src/pptx/icons/renderer.ts tests/pptx/icons/renderer.test.ts
git commit -m "feat: render a curated react-icons set to SVG/PNG server-side"
```

---

### Task 11: Icon cache

**Files:**
- Create: `src/pptx/icons/iconCache.ts`
- Test: `tests/pptx/icons/iconCache.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/pptx/icons/iconCache.test.ts
import { describe, it, expect } from "vitest";
import { IconCache } from "../../../src/pptx/icons/iconCache";
import { corporateTheme } from "../../../src/pptx/themes/corporate";

describe("IconCache", () => {
  it("returns undefined before warming", () => {
    const cache = new IconCache();
    expect(cache.get("FaStar", corporateTheme.primaryColor)).toBeUndefined();
  });

  it("returns a png data uri after warming a theme", async () => {
    const cache = new IconCache();
    await cache.warmTheme(corporateTheme);
    const result = cache.get("FaStar", corporateTheme.primaryColor);
    expect(result).toMatch(/^data:image\/png;base64,/);
  });

  it("lookup is case-insensitive on the color hex", async () => {
    const cache = new IconCache();
    await cache.warmTheme(corporateTheme);
    const upper = cache.get("FaStar", corporateTheme.primaryColor.toUpperCase());
    const lower = cache.get("FaStar", corporateTheme.primaryColor.toLowerCase());
    expect(upper).toBe(lower);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/pptx/icons/iconCache.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

```ts
// src/pptx/icons/iconCache.ts
import { renderIconToPngDataUri } from "./renderer";
import { ICON_NAMES, type IconName } from "./iconSet";
import type { Theme } from "../themes/types";

export class IconCache {
  private readonly cache = new Map<string, string>();

  get(iconName: string, colorHex: string): string | undefined {
    return this.cache.get(this.key(iconName, colorHex));
  }

  async warmTheme(theme: Theme): Promise<void> {
    const colors = [theme.primaryColor, theme.secondaryColor, theme.textColor];
    for (const iconName of ICON_NAMES) {
      for (const color of colors) {
        const key = this.key(iconName, color);
        if (!this.cache.has(key)) {
          this.cache.set(key, await renderIconToPngDataUri(iconName as IconName, color));
        }
      }
    }
  }

  private key(iconName: string, colorHex: string): string {
    return `${iconName}:${colorHex.toUpperCase()}`;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/pptx/icons/iconCache.test.ts`
Expected: 3 passed

- [ ] **Step 5: Commit**

```bash
git add src/pptx/icons/iconCache.ts tests/pptx/icons/iconCache.test.ts
git commit -m "feat: add per-theme icon render cache"
```

---

### Task 12: Bridge (sandbox-facing API)

**Files:**
- Create: `src/pptx/bridge.ts`
- Test: `tests/pptx/bridge.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/pptx/bridge.test.ts
import { describe, it, expect, vi } from "vitest";
import { createBridgeFunctions } from "../../src/pptx/bridge";
import { PresentationBuilder } from "../../src/pptx/presentationBuilder";
import { IconCache } from "../../src/pptx/icons/iconCache";

describe("createBridgeFunctions", () => {
  it("addSlide delegates to the builder and returns the slide index", () => {
    const builder = new PresentationBuilder();
    const bridge = createBridgeFunctions(builder, new IconCache());
    expect(bridge.addSlide()).toBe(0);
    expect(builder.slideCount()).toBe(1);
  });

  it("addText delegates to the builder", () => {
    const builder = new PresentationBuilder();
    const addTextSpy = vi.spyOn(builder, "addText");
    const bridge = createBridgeFunctions(builder, new IconCache());
    bridge.addSlide();
    bridge.addText(0, "Salom", { bold: true });
    expect(addTextSpy).toHaveBeenCalledWith(0, "Salom", { bold: true });
  });

  it("addIcon throws when the icon/color combo is not cached", () => {
    const builder = new PresentationBuilder();
    const bridge = createBridgeFunctions(builder, new IconCache());
    bridge.addSlide();
    expect(() => bridge.addIcon(0, "FaStar", { color: "FFFFFF", x: 0, y: 0, w: 1, h: 1 })).toThrow(
      /is not cached/
    );
  });

  it("addIcon adds an image using the cached data uri", () => {
    const builder = new PresentationBuilder();
    const iconCache = new IconCache();
    vi.spyOn(iconCache, "get").mockReturnValue("data:image/png;base64,AAAA");
    const addImageSpy = vi.spyOn(builder, "addImage");
    const bridge = createBridgeFunctions(builder, iconCache);
    bridge.addSlide();
    bridge.addIcon(0, "FaStar", { color: "FFFFFF", x: 1, y: 1, w: 2, h: 2 });
    expect(addImageSpy).toHaveBeenCalledWith(0, {
      data: "data:image/png;base64,AAAA",
      x: 1,
      y: 1,
      w: 2,
      h: 2,
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/pptx/bridge.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

```ts
// src/pptx/bridge.ts
import type PptxGenJS from "pptxgenjs";
import type { PresentationBuilder } from "./presentationBuilder";
import type { IconCache } from "./icons/iconCache";

export interface AddIconOptions {
  color: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export type BridgeFunctions = Record<string, (...args: any[]) => any>;

export function createBridgeFunctions(builder: PresentationBuilder, iconCache: IconCache): BridgeFunctions {
  return {
    addSlide: () => builder.addSlide(),

    addText: (slideIndex: number, text: string, options: PptxGenJS.TextPropsOptions = {}) =>
      builder.addText(slideIndex, text, options),

    addImage: (slideIndex: number, options: PptxGenJS.ImageProps) => builder.addImage(slideIndex, options),

    addChart: (
      slideIndex: number,
      type: PptxGenJS.CHART_NAME,
      data: PptxGenJS.OptsChartData[],
      options: PptxGenJS.IChartOpts = {}
    ) => builder.addChart(slideIndex, type, data, options),

    addShape: (slideIndex: number, shapeType: PptxGenJS.SHAPE_NAME, options: PptxGenJS.ShapeProps = {}) =>
      builder.addShape(slideIndex, shapeType, options),

    addIcon: (slideIndex: number, iconName: string, options: AddIconOptions) => {
      const dataUri = iconCache.get(iconName, options.color);
      if (!dataUri) {
        throw new Error(`Icon "${iconName}" with color "${options.color}" is not cached`);
      }
      builder.addImage(slideIndex, {
        data: dataUri,
        x: options.x,
        y: options.y,
        w: options.w,
        h: options.h,
      });
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/pptx/bridge.test.ts`
Expected: 4 passed

- [ ] **Step 5: Commit**

```bash
git add src/pptx/bridge.ts tests/pptx/bridge.test.ts
git commit -m "feat: add bridge exposing a constrained pptx API for sandboxed code"
```

---

### Task 13: Sandbox (isolated-vm runner)

**Files:**
- Create: `src/pptx/sandbox.ts`
- Test: `tests/pptx/sandbox.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/pptx/sandbox.test.ts
import { describe, it, expect, vi } from "vitest";
import { runInSandbox } from "../../src/pptx/sandbox";

describe("runInSandbox", () => {
  it("calls the exposed bridge function", async () => {
    const addSlide = vi.fn(() => 0);
    const result = await runInSandbox("addSlide();", { addSlide });
    expect(result.success).toBe(true);
    expect(addSlide).toHaveBeenCalledTimes(1);
  });

  it("passes arguments across the isolate boundary", async () => {
    const addText = vi.fn();
    const result = await runInSandbox('addText(0, "Salom dunyo");', { addText });
    expect(result.success).toBe(true);
    expect(addText).toHaveBeenCalledWith(0, "Salom dunyo");
  });

  it("returns success: false and captures the message when the code throws", async () => {
    const result = await runInSandbox("throw new Error('boom');", {});
    expect(result.success).toBe(false);
    expect(result.error).toContain("boom");
  });

  it("returns success: false when execution exceeds the timeout", async () => {
    const result = await runInSandbox("while (true) {}", {});
    expect(result.success).toBe(false);
  });

  it("does not expose require or process to the sandboxed code", async () => {
    const result = await runInSandbox("require('fs');", {});
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/pptx/sandbox.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

> **Correction (discovered during implementation):** the manual
> `ivm.Reference` + `applySync`-via-`eval`-shim below was unnecessary.
> `isolated-vm`'s real API (v6.2.0, confirmed against
> `node_modules/isolated-vm/README.md` and `isolated-vm.d.ts`) auto-wraps a
> plain function passed to `jail.set(name, fn)` as a synchronous `Callback`
> by default — it already appears in the isolate as an ordinary function,
> no `.then()`, no `applySync` shim, no `__host_` naming needed. This was
> independently security-verified (Function-constructor escape attempts,
> `require`/`process`/`fs` access, timeout-under-load) with no issues found.

```ts
// src/pptx/sandbox.ts
import ivm from "isolated-vm";
import type { BridgeFunctions } from "./bridge";
import { SANDBOX_TIMEOUT_MS, SANDBOX_MEMORY_LIMIT_MB } from "../config/constants";

export interface SandboxResult {
  success: boolean;
  error?: string;
}

/**
 * Runs Claude-generated JavaScript inside an isolated-vm isolate.
 *
 * The isolate is a fresh v8 context: it has no `require`, `process`, `fetch`,
 * or any other Node/browser global. The only things reachable from inside
 * the sandboxed code are the functions listed in `bridgeFunctions`, which are
 * exposed as plain global functions. Because isolated-vm auto-wraps plain
 * functions passed across the isolate boundary as *synchronous* callbacks by
 * default, calling e.g. `addSlide()` from sandboxed code blocks and returns
 * the host function's return value directly - no `.then()` required.
 */
export async function runInSandbox(code: string, bridgeFunctions: BridgeFunctions): Promise<SandboxResult> {
  const isolate = new ivm.Isolate({ memoryLimit: SANDBOX_MEMORY_LIMIT_MB });

  try {
    const context = await isolate.createContext();
    const jail = context.global;

    for (const [name, fn] of Object.entries(bridgeFunctions)) {
      // Passing a plain function is auto-wrapped by isolated-vm as a
      // synchronous Callback, so it appears in the isolate as a normal
      // synchronous function.
      await jail.set(name, (...args: unknown[]) => fn(...args));
    }

    const script = await isolate.compileScript(code);
    await script.run(context, { timeout: SANDBOX_TIMEOUT_MS });

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  } finally {
    if (!isolate.isDisposed) {
      isolate.dispose();
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/pptx/sandbox.test.ts`
Expected: 5 passed

- [ ] **Step 5: Commit**

```bash
git add src/pptx/sandbox.ts tests/pptx/sandbox.test.ts
git commit -m "feat: run Claude-generated code in an isolated-vm sandbox with a sync bridge"
```

---

### Task 14: Code validator

**Files:**
- Create: `src/ai/codeValidator.ts`
- Test: `tests/ai/codeValidator.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/ai/codeValidator.test.ts
import { describe, it, expect } from "vitest";
import { validateGeneratedCode } from "../../src/ai/codeValidator";

describe("validateGeneratedCode", () => {
  it("accepts plain bridge calls", () => {
    const code = 'const s = addSlide();\naddText(s, "Salom");';
    expect(validateGeneratedCode(code)).toEqual({ valid: true });
  });

  it("rejects code using require", () => {
    const result = validateGeneratedCode("require('fs').readFileSync('/etc/passwd');");
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/require/);
  });

  it("rejects code using process", () => {
    expect(validateGeneratedCode("process.exit(1);").valid).toBe(false);
  });

  it("rejects code using eval", () => {
    expect(validateGeneratedCode("eval('1+1');").valid).toBe(false);
  });

  it("rejects code using the Function constructor", () => {
    expect(validateGeneratedCode("Function('return 1')();").valid).toBe(false);
  });

  it("rejects code touching __proto__", () => {
    expect(validateGeneratedCode("({}).__proto__.polluted = true;").valid).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ai/codeValidator.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

```ts
// src/ai/codeValidator.ts
const BANNED_PATTERNS: RegExp[] = [
  /\brequire\s*\(/,
  /\bimport\s+/,
  /\bprocess\s*\./,
  /\beval\s*\(/,
  /\bFunction\s*\(/,
  /\bfetch\s*\(/,
  /\bXMLHttpRequest\b/,
  /__proto__/,
  /constructor\s*\.\s*constructor/,
];

export interface ValidationResult {
  valid: boolean;
  reason?: string;
}

export function validateGeneratedCode(code: string): ValidationResult {
  for (const pattern of BANNED_PATTERNS) {
    if (pattern.test(code)) {
      return { valid: false, reason: `Code contains a banned pattern: ${pattern.source}` };
    }
  }
  return { valid: true };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/ai/codeValidator.test.ts`
Expected: 6 passed

- [ ] **Step 5: Commit**

```bash
git add src/ai/codeValidator.ts tests/ai/codeValidator.test.ts
git commit -m "feat: statically reject dangerous patterns before sandboxing generated code"
```

---

### Task 15: Design guide (Claude system prompt)

**Files:**
- Create: `src/ai/designGuide.ts`
- Test: `tests/ai/designGuide.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/ai/designGuide.test.ts
import { describe, it, expect } from "vitest";
import { buildSystemPrompt } from "../../src/ai/designGuide";
import { corporateTheme } from "../../src/pptx/themes/corporate";

describe("buildSystemPrompt", () => {
  it("includes the requested slide count", () => {
    const prompt = buildSystemPrompt(corporateTheme, 10, "o'zbek");
    expect(prompt).toContain("10 ta slayd");
  });

  it("includes the theme's colors so Claude does not invent its own", () => {
    const prompt = buildSystemPrompt(corporateTheme, 5, "o'zbek");
    expect(prompt).toContain(corporateTheme.primaryColor);
    expect(prompt).toContain(corporateTheme.secondaryColor);
  });

  it("lists the bridge functions and the curated icon names", () => {
    const prompt = buildSystemPrompt(corporateTheme, 5, "o'zbek");
    expect(prompt).toContain("addSlide()");
    expect(prompt).toContain("addIcon");
    expect(prompt).toContain("FaChartBar");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ai/designGuide.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

```ts
// src/ai/designGuide.ts
import { ICON_NAMES } from "../pptx/icons/iconSet";
import type { Theme } from "../pptx/themes/types";

export function buildSystemPrompt(theme: Theme, slideCount: number, language: string): string {
  return `Siz professional taqdimot dizayneri sifatida ishlaysiz. Sizning vazifangiz — faqat JavaScript kod yozish, bu kod quyidagi funksiyalar orqali taqdimot slaydlarini yaratadi:

- addSlide() -> number — yangi slayd qo'shadi, uning indeksini qaytaradi
- addText(slideIndex, text, options) — matn qo'shadi. options: { x, y, w, h, fontSize, bold, color, align }
- addImage(slideIndex, options) — rasm qo'shadi. options: { data, x, y, w, h }
- addChart(slideIndex, type, data, options) — diagram qo'shadi. type: "bar" | "line" | "pie"
- addShape(slideIndex, shapeType, options) — geometrik shakl qo'shadi
- addIcon(slideIndex, iconName, options) — ikonka qo'shadi. options: { color, x, y, w, h }

Mavjud ikonka nomlari (faqat shu ro'yxatdan foydalaning): ${ICON_NAMES.join(", ")}.

Ranglar faqat quyidagi tema qiymatlaridan olinsin (o'zingiz rang o'ylab topmang):
- primaryColor: ${theme.primaryColor}
- secondaryColor: ${theme.secondaryColor}
- backgroundColor: ${theme.backgroundColor}
- textColor: ${theme.textColor}

Qoidalar:
1. Aniq ${slideCount} ta slayd yarating (${slideCount} marta addSlide() chaqiring).
2. Har bir slaydda sarlavha va 2-4 ta qisqa bullet bo'lsin, matn ${language} tilida bo'lsin.
3. Kamida yarim slaydlarda addIcon yoki addChart ishlatib vizual boyitilgan qiling.
4. Faqat yuqoridagi funksiyalarni chaqiring — boshqa hech qanday global funksiya yoki obyekt (require, process, fetch va h.k.) mavjud emas.
5. Javobingiz FAQAT JavaScript kod bo'lsin, boshqa hech qanday izoh yozmang. Kodni \`\`\`javascript kod bloki ichida qaytaring.`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/ai/designGuide.test.ts`
Expected: 3 passed

- [ ] **Step 5: Commit**

```bash
git add src/ai/designGuide.ts tests/ai/designGuide.test.ts
git commit -m "feat: build the Claude system prompt (bridge API + design rules)"
```

---

### Task 16: Claude client

**Files:**
- Create: `src/ai/client.ts`
- Test: `tests/ai/client.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/ai/client.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { AiClient, extractCodeBlock } from "../../src/ai/client";

const createMock = vi.fn();

vi.mock("@anthropic-ai/sdk", () => ({
  // Must be a `function` expression, not an arrow function: vitest's spy
  // calls Reflect.construct() on this when `new Anthropic(...)` runs, and
  // arrow functions are never constructible (throws "is not a constructor").
  default: vi.fn().mockImplementation(function () {
    return { messages: { create: createMock } };
  }),
}));

describe("extractCodeBlock", () => {
  it("extracts code from a fenced javascript block", () => {
    const text = "Mana kod:\n```javascript\naddSlide();\n```";
    expect(extractCodeBlock(text)).toBe("addSlide();");
  });

  it("returns the raw text when there is no fence", () => {
    expect(extractCodeBlock("addSlide();")).toBe("addSlide();");
  });
});

describe("AiClient.generateSlideCode", () => {
  const theme = {
    name: "corporate",
    primaryColor: "111111",
    secondaryColor: "222222",
    backgroundColor: "FFFFFF",
    textColor: "000000",
    fontFace: "Calibri",
  };

  beforeEach(() => {
    createMock.mockReset();
  });

  it("sends the topic as the user message and returns the extracted code", async () => {
    createMock.mockResolvedValue({
      content: [{ type: "text", text: "```javascript\naddSlide();\n```" }],
    });
    const client = new AiClient("test-key", "claude-opus-4-5");
    const code = await client.generateSlideCode({
      topic: "Sun'iy intellekt",
      slideCount: 5,
      language: "o'zbek",
      theme,
    });
    expect(code).toBe("addSlide();");
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "claude-opus-4-5",
        messages: [{ role: "user", content: "Taqdimot mavzusi: Sun'iy intellekt" }],
      })
    );
  });

  it("throws when Claude returns no text block", async () => {
    createMock.mockResolvedValue({ content: [] });
    const client = new AiClient("test-key", "claude-opus-4-5");
    await expect(
      client.generateSlideCode({ topic: "Test", slideCount: 5, language: "uz", theme })
    ).rejects.toThrow(/did not return a text response/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/ai/client.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

```ts
// src/ai/client.ts
import Anthropic from "@anthropic-ai/sdk";
import { buildSystemPrompt } from "./designGuide";
import type { Theme } from "../pptx/themes/types";

export interface GenerateCodeParams {
  topic: string;
  slideCount: number;
  language: string;
  theme: Theme;
}

export function extractCodeBlock(text: string): string {
  const match = text.match(/```(?:javascript|js)?\s*([\s\S]*?)```/);
  return match ? match[1].trim() : text.trim();
}

export class AiClient {
  private readonly client: Anthropic;

  constructor(apiKey: string, private readonly model: string) {
    this.client = new Anthropic({ apiKey });
  }

  async generateSlideCode(params: GenerateCodeParams): Promise<string> {
    const systemPrompt = buildSystemPrompt(params.theme, params.slideCount, params.language);
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: "user", content: `Taqdimot mavzusi: ${params.topic}` }],
    });

    const textBlock = response.content.find(
      (block): block is Anthropic.TextBlock => block.type === "text"
    );
    if (!textBlock) {
      throw new Error("Claude did not return a text response");
    }

    return extractCodeBlock(textBlock.text);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/ai/client.test.ts`
Expected: 4 passed

- [ ] **Step 5: Commit**

```bash
git add src/ai/client.ts tests/ai/client.test.ts
git commit -m "feat: add Claude API client that returns extracted slide-generation code"
```

---

### Task 17: Logger

**Files:**
- Create: `src/logger.ts`
- Test: `tests/logger.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/logger.test.ts
import { describe, it, expect } from "vitest";
import { createLogger } from "../src/logger";

describe("createLogger", () => {
  it("creates a logger exposing the standard log level methods", () => {
    const logger = createLogger();
    expect(typeof logger.info).toBe("function");
    expect(typeof logger.error).toBe("function");
    expect(typeof logger.warn).toBe("function");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/logger.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

```ts
// src/logger.ts
import pino from "pino";

export function createLogger() {
  return pino({
    level: process.env.LOG_LEVEL ?? "info",
    timestamp: pino.stdTimeFunctions.isoTime,
  });
}

export type Logger = ReturnType<typeof createLogger>;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/logger.test.ts`
Expected: 1 passed

- [ ] **Step 5: Commit**

```bash
git add src/logger.ts tests/logger.test.ts
git commit -m "feat: add pino-based structured logger factory"
```

---

### Task 18: PresentationService (orchestrator)

**Files:**
- Create: `src/services/presentationService.ts`
- Test: `tests/services/presentationService.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/services/presentationService.test.ts
import { describe, it, expect, vi } from "vitest";
import { PresentationService } from "../../src/services/presentationService";

function createMockAiClient(code: string) {
  return { generateSlideCode: vi.fn().mockResolvedValue(code) } as any;
}

function createMockPresentationRepository() {
  return {
    create: vi.fn().mockResolvedValue({ id: "pres_1" }),
    markSuccess: vi.fn().mockResolvedValue(undefined),
    markFailed: vi.fn().mockResolvedValue(undefined),
  } as any;
}

function createMockIconCache() {
  return { warmTheme: vi.fn().mockResolvedValue(undefined), get: vi.fn() } as any;
}

describe("PresentationService.generate", () => {
  it("returns a pptx buffer on success and marks the record successful", async () => {
    const aiClient = createMockAiClient('const s = addSlide(); addText(s, "Salom");');
    const repo = createMockPresentationRepository();
    const service = new PresentationService(aiClient, repo, createMockIconCache());

    const result = await service.generate({
      userId: 1n,
      topic: "Test",
      slideCount: 1,
      language: "o'zbek",
      themeName: "corporate",
    });

    expect(result.success).toBe(true);
    expect(result.buffer).toBeInstanceOf(Buffer);
    expect(repo.markSuccess).toHaveBeenCalledWith("pres_1");
    expect(repo.markFailed).not.toHaveBeenCalled();
  });

  it("fails and records the reason when generated code trips the validator", async () => {
    const aiClient = createMockAiClient("require('fs');");
    const repo = createMockPresentationRepository();
    const service = new PresentationService(aiClient, repo, createMockIconCache());

    const result = await service.generate({
      userId: 1n,
      topic: "Test",
      slideCount: 1,
      language: "o'zbek",
      themeName: "corporate",
    });

    expect(result.success).toBe(false);
    expect(result.errorMessage).toMatch(/banned pattern/);
    expect(repo.markFailed).toHaveBeenCalledWith("pres_1", expect.stringContaining("banned pattern"));
  });

  it("fails and records the reason when the sandboxed code throws", async () => {
    const aiClient = createMockAiClient("throw new Error('bad code');");
    const repo = createMockPresentationRepository();
    const service = new PresentationService(aiClient, repo, createMockIconCache());

    const result = await service.generate({
      userId: 1n,
      topic: "Test",
      slideCount: 1,
      language: "o'zbek",
      themeName: "corporate",
    });

    expect(result.success).toBe(false);
    expect(result.errorMessage).toContain("bad code");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/services/presentationService.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

```ts
// src/services/presentationService.ts
import type { AiClient } from "../ai/client";
import { validateGeneratedCode } from "../ai/codeValidator";
import { runInSandbox } from "../pptx/sandbox";
import { PresentationBuilder } from "../pptx/presentationBuilder";
import { createBridgeFunctions } from "../pptx/bridge";
import { IconCache } from "../pptx/icons/iconCache";
import { getTheme } from "../pptx/themes";
import type { ThemeName } from "../config/constants";
import type { PresentationRepository } from "../db/repositories/presentationRepository";

export interface GeneratePresentationInput {
  userId: bigint;
  topic: string;
  slideCount: number;
  language: string;
  themeName: ThemeName;
}

export interface GeneratePresentationResult {
  success: boolean;
  buffer?: Buffer;
  errorMessage?: string;
}

> **Correction (discovered during review):** the original version below ran
> `getTheme`/`create` before the `try` block, so a DB error or invalid theme
> name would make `generate()` reject instead of honoring its
> "never throws, always returns a result" contract. Fixed by moving both
> inside `try` and tracking `recordId` so `markFailed` is only called when a
> record actually exists.

```ts
export class PresentationService {
  constructor(
    private readonly aiClient: AiClient,
    private readonly presentationRepository: PresentationRepository,
    private readonly iconCache: IconCache = new IconCache()
  ) {}

  async generate(input: GeneratePresentationInput): Promise<GeneratePresentationResult> {
    let recordId: string | undefined;
    try {
      const theme = getTheme(input.themeName);
      const record = await this.presentationRepository.create({
        userId: input.userId,
        topic: input.topic,
        slideCount: input.slideCount,
        language: input.language,
        theme: input.themeName,
      });
      recordId = record.id;

      const code = await this.aiClient.generateSlideCode({
        topic: input.topic,
        slideCount: input.slideCount,
        language: input.language,
        theme,
      });

      const validation = validateGeneratedCode(code);
      if (!validation.valid) {
        throw new Error(validation.reason ?? "Generated code failed validation");
      }

      await this.iconCache.warmTheme(theme);

      const builder = new PresentationBuilder();
      const bridge = createBridgeFunctions(builder, this.iconCache);
      const sandboxResult = await runInSandbox(code, bridge);
      if (!sandboxResult.success) {
        throw new Error(sandboxResult.error ?? "Sandbox execution failed");
      }

      const buffer = await builder.toBuffer();
      await this.presentationRepository.markSuccess(recordId);
      return { success: true, buffer };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (recordId) {
        await this.presentationRepository.markFailed(recordId, message);
      }
      return { success: false, errorMessage: message };
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/services/presentationService.test.ts`
Expected: 3 passed

- [ ] **Step 5: Commit**

```bash
git add src/services/presentationService.ts tests/services/presentationService.test.ts
git commit -m "feat: add PresentationService orchestrating AI -> validate -> sandbox -> file"
```

---

### Task 19: Bot context and super-admin check

**Files:**
- Create: `src/bot/context.ts`
- Create: `src/bot/superAdmin.ts`
- Test: `tests/bot/superAdmin.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/bot/superAdmin.test.ts
import { describe, it, expect } from "vitest";
import { isSuperAdmin } from "../../src/bot/superAdmin";

describe("isSuperAdmin", () => {
  it("returns true when the ids match", () => {
    expect(isSuperAdmin(42n, 42n)).toBe(true);
  });

  it("returns false when the ids differ", () => {
    expect(isSuperAdmin(1n, 42n)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/bot/superAdmin.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

```ts
// src/bot/context.ts
import type { Context } from "grammy";
import type { ConversationFlavor } from "@grammyjs/conversations";

// ConversationFlavor is generic (ConversationFlavor<C extends Context>),
// not a plain type — `Context & ConversationFlavor` does not compile
// ("Generic type 'ConversationFlavor' requires 1 type argument(s)").
export type MyContext = ConversationFlavor<Context>;
```

```ts
// src/bot/superAdmin.ts
export function isSuperAdmin(userId: bigint, superAdminId: bigint): boolean {
  return userId === superAdminId;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/bot/superAdmin.test.ts`
Expected: 2 passed

- [ ] **Step 5: Commit**

```bash
git add src/bot/context.ts src/bot/superAdmin.ts tests/bot/superAdmin.test.ts
git commit -m "feat: add bot context type and env-based super-admin check"
```

---

### Task 20: Keyboards (main menu, admin menu, wizard)

**Files:**
- Create: `src/bot/keyboards/mainMenu.ts`
- Create: `src/bot/keyboards/adminMenu.ts`
- Create: `src/bot/keyboards/wizardKeyboards.ts`
- Test: `tests/bot/keyboards/mainMenu.test.ts`
- Test: `tests/bot/keyboards/adminMenu.test.ts`
- Test: `tests/bot/keyboards/wizardKeyboards.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// tests/bot/keyboards/mainMenu.test.ts
import { describe, it, expect } from "vitest";
import { buildMainMenuKeyboard } from "../../../src/bot/keyboards/mainMenu";

describe("buildMainMenuKeyboard", () => {
  it("shows only the create-presentation button for non-admins", () => {
    const keyboard = buildMainMenuKeyboard(false);
    const texts = keyboard.keyboard.flat().map((btn: any) => btn.text);
    expect(texts).toEqual(["🎨 Taqdimot yaratish"]);
  });

  it("adds the admin panel button for admins", () => {
    const keyboard = buildMainMenuKeyboard(true);
    const texts = keyboard.keyboard.flat().map((btn: any) => btn.text);
    expect(texts).toEqual(["🎨 Taqdimot yaratish", "⚙️ Admin panel"]);
  });
});
```

```ts
// tests/bot/keyboards/adminMenu.test.ts
import { describe, it, expect } from "vitest";
import { buildAdminMenuKeyboard } from "../../../src/bot/keyboards/adminMenu";

describe("buildAdminMenuKeyboard", () => {
  it("hides the promote button for regular admins", () => {
    const keyboard = buildAdminMenuKeyboard(false);
    const texts = keyboard.keyboard.flat().map((btn: any) => btn.text);
    expect(texts).not.toContain("⬆️ Admin qilish");
    expect(texts).toContain("🔙 Orqaga");
  });

  it("shows the promote button for the super admin", () => {
    const keyboard = buildAdminMenuKeyboard(true);
    const texts = keyboard.keyboard.flat().map((btn: any) => btn.text);
    expect(texts).toContain("⬆️ Admin qilish");
  });
});
```

```ts
// tests/bot/keyboards/wizardKeyboards.test.ts
import { describe, it, expect } from "vitest";
import {
  buildSlideCountKeyboard,
  buildLanguageKeyboard,
  buildThemeKeyboard,
  buildCancelKeyboard,
} from "../../../src/bot/keyboards/wizardKeyboards";

describe("wizard keyboards", () => {
  it("builds a button for every slide count option", () => {
    const data = buildSlideCountKeyboard().inline_keyboard.flat().map((b: any) => b.callback_data);
    expect(data).toEqual(["slideCount:5", "slideCount:10", "slideCount:15", "slideCount:20"]);
  });

  it("builds a button for every language", () => {
    const data = buildLanguageKeyboard().inline_keyboard.flat().map((b: any) => b.callback_data);
    expect(data).toEqual(["language:uz", "language:ru", "language:en"]);
  });

  it("builds a button for every theme", () => {
    const data = buildThemeKeyboard().inline_keyboard.flat().map((b: any) => b.callback_data);
    expect(data).toEqual(["theme:corporate", "theme:creative", "theme:minimal", "theme:dark"]);
  });

  it("builds a single cancel button", () => {
    const data = buildCancelKeyboard().inline_keyboard.flat().map((b: any) => b.callback_data);
    expect(data).toEqual(["cancel"]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/bot/keyboards`
Expected: FAIL — modules not found

- [ ] **Step 3: Write the implementations**

```ts
// src/bot/keyboards/mainMenu.ts
import { Keyboard } from "grammy";
import { t } from "../../i18n/t";

export function buildMainMenuKeyboard(isAdmin: boolean): Keyboard {
  const keyboard = new Keyboard().text(t("menu.createPresentation")).row();
  if (isAdmin) {
    keyboard.text(t("menu.adminPanel")).row();
  }
  return keyboard.resized();
}
```

```ts
// src/bot/keyboards/adminMenu.ts
import { Keyboard } from "grammy";
import { t } from "../../i18n/t";

export function buildAdminMenuKeyboard(isSuperAdmin: boolean): Keyboard {
  const keyboard = new Keyboard()
    .text(t("admin.addUser"))
    .text(t("admin.removeUser"))
    .row()
    .text(t("admin.listUsers"));
  if (isSuperAdmin) {
    keyboard.text(t("admin.promote"));
  }
  keyboard.row().text(t("menu.back"));
  return keyboard.resized();
}
```

```ts
// src/bot/keyboards/wizardKeyboards.ts
import { InlineKeyboard } from "grammy";
import { SLIDE_COUNT_OPTIONS, PRESENTATION_LANGUAGES, THEME_NAMES, type ThemeName } from "../../config/constants";
import { t } from "../../i18n/t";

export function buildSlideCountKeyboard(): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  for (const count of SLIDE_COUNT_OPTIONS) {
    keyboard.text(String(count), `slideCount:${count}`);
  }
  return keyboard;
}

export function buildLanguageKeyboard(): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  for (const lang of PRESENTATION_LANGUAGES) {
    keyboard.text(lang.label, `language:${lang.code}`).row();
  }
  return keyboard;
}

const THEME_LABELS: Record<ThemeName, string> = {
  corporate: "Corporate",
  creative: "Creative",
  minimal: "Minimal",
  dark: "Dark",
};

export function buildThemeKeyboard(): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  for (const themeName of THEME_NAMES) {
    keyboard.text(THEME_LABELS[themeName], `theme:${themeName}`).row();
  }
  return keyboard;
}

export function buildCancelKeyboard(): InlineKeyboard {
  return new InlineKeyboard().text(t("wizard.cancel"), "cancel");
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/bot/keyboards`
Expected: 8 passed

- [ ] **Step 5: Commit**

```bash
git add src/bot/keyboards tests/bot/keyboards
git commit -m "feat: add main menu, admin menu, and wizard keyboards"
```

---

### Task 21: Access control middleware

**Files:**
- Create: `src/bot/middlewares/accessControl.ts`
- Test: `tests/bot/middlewares/accessControl.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/bot/middlewares/accessControl.test.ts
import { describe, it, expect, vi } from "vitest";
import { createAccessControlMiddleware } from "../../../src/bot/middlewares/accessControl";

function createMockCtx(userId: number | undefined) {
  return {
    from: userId === undefined ? undefined : { id: userId },
    reply: vi.fn(),
  } as any;
}

describe("createAccessControlMiddleware", () => {
  it("calls next() when the user is allowed", async () => {
    const userRepository = { isAllowed: vi.fn().mockResolvedValue(true) } as any;
    const middleware = createAccessControlMiddleware(userRepository);
    const ctx = createMockCtx(1);
    const next = vi.fn();
    await middleware(ctx, next);
    expect(next).toHaveBeenCalled();
    expect(ctx.reply).not.toHaveBeenCalled();
  });

  it("replies with access denied and skips next() when the user is not allowed", async () => {
    const userRepository = { isAllowed: vi.fn().mockResolvedValue(false) } as any;
    const middleware = createAccessControlMiddleware(userRepository);
    const ctx = createMockCtx(2);
    const next = vi.fn();
    await middleware(ctx, next);
    expect(next).not.toHaveBeenCalled();
    expect(ctx.reply).toHaveBeenCalledWith("Kirish cheklangan. Administrator bilan bog'laning.");
  });

  it("does nothing when the update has no sender id", async () => {
    const userRepository = { isAllowed: vi.fn() } as any;
    const middleware = createAccessControlMiddleware(userRepository);
    const ctx = createMockCtx(undefined);
    const next = vi.fn();
    await middleware(ctx, next);
    expect(userRepository.isAllowed).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/bot/middlewares/accessControl.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

```ts
// src/bot/middlewares/accessControl.ts
import type { Context, NextFunction } from "grammy";
import type { UserRepository } from "../../db/repositories/userRepository";
import { t } from "../../i18n/t";

export function createAccessControlMiddleware(userRepository: UserRepository) {
  return async (ctx: Context, next: NextFunction): Promise<void> => {
    const userId = ctx.from?.id;
    if (userId === undefined) {
      return;
    }
    const allowed = await userRepository.isAllowed(BigInt(userId));
    if (!allowed) {
      await ctx.reply(t("start.accessDenied"));
      return;
    }
    await next();
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/bot/middlewares/accessControl.test.ts`
Expected: 3 passed

- [ ] **Step 5: Commit**

```bash
git add src/bot/middlewares/accessControl.ts tests/bot/middlewares/accessControl.test.ts
git commit -m "feat: add whitelist access-control middleware"
```

---

### Task 22: Handlers (start, help, listUsers)

**Files:**
- Create: `src/bot/handlers/start.ts`
- Create: `src/bot/handlers/help.ts`
- Create: `src/bot/handlers/listUsers.ts`
- Test: `tests/bot/handlers/start.test.ts`
- Test: `tests/bot/handlers/help.test.ts`
- Test: `tests/bot/handlers/listUsers.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// tests/bot/handlers/start.test.ts
import { describe, it, expect, vi } from "vitest";
import { createStartHandler } from "../../../src/bot/handlers/start";

describe("createStartHandler", () => {
  it("replies with the welcome message and a menu including the admin panel for admins", async () => {
    const userRepository = { isAdmin: vi.fn().mockResolvedValue(true) } as any;
    const handler = createStartHandler(userRepository);
    const ctx = { from: { id: 1 }, reply: vi.fn() } as any;
    await handler(ctx);
    expect(ctx.reply).toHaveBeenCalledTimes(1);
    const [text, options] = ctx.reply.mock.calls[0];
    expect(text).toBe("Xush kelibsiz! Quyidagi menyudan foydalaning.");
    const texts = options.reply_markup.keyboard.flat().map((b: any) => b.text);
    expect(texts).toContain("⚙️ Admin panel");
  });

  it("omits the admin panel button for non-admins", async () => {
    const userRepository = { isAdmin: vi.fn().mockResolvedValue(false) } as any;
    const handler = createStartHandler(userRepository);
    const ctx = { from: { id: 2 }, reply: vi.fn() } as any;
    await handler(ctx);
    const [, options] = ctx.reply.mock.calls[0];
    const texts = options.reply_markup.keyboard.flat().map((b: any) => b.text);
    expect(texts).not.toContain("⚙️ Admin panel");
  });
});
```

```ts
// tests/bot/handlers/help.test.ts
import { describe, it, expect, vi } from "vitest";
import { helpHandler } from "../../../src/bot/handlers/help";

describe("helpHandler", () => {
  it("replies with the help text", async () => {
    const ctx = { reply: vi.fn() } as any;
    await helpHandler(ctx);
    expect(ctx.reply).toHaveBeenCalledWith(
      'Bu bot AI yordamida taqdimot (.pptx) yaratadi. "🎨 Taqdimot yaratish" tugmasini bosing va ko\'rsatmalarga amal qiling.'
    );
  });
});
```

```ts
// tests/bot/handlers/listUsers.test.ts
import { describe, it, expect, vi } from "vitest";
import { createListUsersHandler } from "../../../src/bot/handlers/listUsers";

describe("createListUsersHandler", () => {
  it("replies with the empty message when there are no users", async () => {
    const userRepository = { listAll: vi.fn().mockResolvedValue([]) } as any;
    const handler = createListUsersHandler(userRepository);
    const ctx = { reply: vi.fn() } as any;
    await handler(ctx);
    expect(ctx.reply).toHaveBeenCalledWith("Ro'yxat bo'sh.");
  });

  it("formats each user as a numbered line", async () => {
    const userRepository = {
      listAll: vi.fn().mockResolvedValue([
        { id: 111n, firstName: "Ali", username: null },
        { id: 222n, firstName: null, username: "vali" },
      ]),
    } as any;
    const handler = createListUsersHandler(userRepository);
    const ctx = { reply: vi.fn() } as any;
    await handler(ctx);
    expect(ctx.reply).toHaveBeenCalledWith("1. Ali — ID: 111\n2. vali — ID: 222");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/bot/handlers`
Expected: FAIL — modules not found

- [ ] **Step 3: Write the implementations**

```ts
// src/bot/handlers/start.ts
import type { Context } from "grammy";
import type { UserRepository } from "../../db/repositories/userRepository";
import { buildMainMenuKeyboard } from "../keyboards/mainMenu";
import { t } from "../../i18n/t";

export function createStartHandler(userRepository: UserRepository) {
  return async (ctx: Context): Promise<void> => {
    const userId = ctx.from?.id;
    if (userId === undefined) {
      return;
    }
    const isAdmin = await userRepository.isAdmin(BigInt(userId));
    await ctx.reply(t("start.welcome"), { reply_markup: buildMainMenuKeyboard(isAdmin) });
  };
}
```

```ts
// src/bot/handlers/help.ts
import type { Context } from "grammy";
import { t } from "../../i18n/t";

export async function helpHandler(ctx: Context): Promise<void> {
  await ctx.reply(t("help.text"));
}
```

```ts
// src/bot/handlers/listUsers.ts
import type { Context } from "grammy";
import type { UserRepository } from "../../db/repositories/userRepository";
import { t } from "../../i18n/t";

export function createListUsersHandler(userRepository: UserRepository) {
  return async (ctx: Context): Promise<void> => {
    const users = await userRepository.listAll();
    if (users.length === 0) {
      await ctx.reply(t("admin.listUsers.empty"));
      return;
    }
    const lines = users.map((user, index) =>
      t("admin.listUsers.item", {
        index: index + 1,
        name: user.firstName ?? user.username ?? "—",
        id: user.id.toString(),
      })
    );
    await ctx.reply(lines.join("\n"));
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/bot/handlers`
Expected: 5 passed

- [ ] **Step 5: Commit**

```bash
git add src/bot/handlers tests/bot/handlers
git commit -m "feat: add /start, /help and list-users handlers"
```

---

### Task 23: Conversation parsers (pure helpers)

**Files:**
- Create: `src/bot/conversations/parsers.ts`
- Test: `tests/bot/conversations/parsers.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/bot/conversations/parsers.test.ts
import { describe, it, expect } from "vitest";
import { parseCallbackValue, parseTelegramId } from "../../../src/bot/conversations/parsers";

describe("parseCallbackValue", () => {
  it("extracts the value after the prefix", () => {
    expect(parseCallbackValue("slideCount:10", "slideCount")).toBe("10");
  });

  it("throws when the prefix does not match", () => {
    expect(() => parseCallbackValue("language:uz", "slideCount")).toThrow(/Invalid callback data/);
  });
});

describe("parseTelegramId", () => {
  it("parses a numeric string into a bigint", () => {
    expect(parseTelegramId("123456789")).toBe(123456789n);
  });

  it("throws for non-numeric input", () => {
    expect(() => parseTelegramId("abc")).toThrow(/not a valid Telegram ID/);
  });

  it("trims surrounding whitespace", () => {
    expect(parseTelegramId(" 42 \n")).toBe(42n);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/bot/conversations/parsers.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

```ts
// src/bot/conversations/parsers.ts
export function parseCallbackValue(data: string, expectedPrefix: string): string {
  const [prefix, value] = data.split(":");
  if (prefix !== expectedPrefix || value === undefined) {
    throw new Error(`Invalid callback data "${data}" for prefix "${expectedPrefix}"`);
  }
  return value;
}

export function parseTelegramId(text: string): bigint {
  const trimmed = text.trim();
  if (!/^\d+$/.test(trimmed)) {
    throw new Error(`"${text}" is not a valid Telegram ID`);
  }
  return BigInt(trimmed);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/bot/conversations/parsers.test.ts`
Expected: 5 passed

- [ ] **Step 5: Commit**

```bash
git add src/bot/conversations/parsers.ts tests/bot/conversations/parsers.test.ts
git commit -m "feat: add pure parsers for callback data and Telegram ids"
```

---

### Task 24: Presentation creation wizard

**Files:**
- Create: `src/bot/conversations/presentationWizard.ts`

> **Note on testing:** grammY conversations only execute meaningfully inside
> the full bot + conversations-plugin runtime (they replay update handling
> to restore state). The parsing/validation logic they use
> (`parseCallbackValue`, `parseTelegramId`) is already unit-tested in Task 23,
> and the side-effecting call this wizard makes
> (`presentationService.generate`) is unit-tested in Task 18. This task is
> verified manually in Task 27 by running the bot end-to-end. Do not write a
> fake unit test that mocks grammY's internals — it would test the mock, not
> the behavior.

- [ ] **Step 1: Write the implementation**

```ts
// src/bot/conversations/presentationWizard.ts
import { InputFile } from "grammy";
import type { Context } from "grammy";
import type { Conversation } from "@grammyjs/conversations";
import type { MyContext } from "../context";
import { t } from "../../i18n/t";
import {
  buildSlideCountKeyboard,
  buildLanguageKeyboard,
  buildThemeKeyboard,
  buildCancelKeyboard,
} from "../keyboards/wizardKeyboards";
import { parseCallbackValue } from "./parsers";
import type { PresentationService } from "../../services/presentationService";
import type { ThemeName, PresentationLanguageCode } from "../../config/constants";

export function createPresentationWizard(presentationService: PresentationService) {
  return async function presentationWizard(conversation: Conversation<MyContext>, ctx: Context): Promise<void> {
    await ctx.reply(t("wizard.askTopic"), { reply_markup: buildCancelKeyboard() });
    const topicCtx = await conversation.waitFor(["message:text", "callback_query:data"]);
    if (topicCtx.has("callback_query:data")) {
      await topicCtx.answerCallbackQuery();
      await topicCtx.reply(t("wizard.cancelled"));
      return;
    }
    const topic = topicCtx.message.text;

    await ctx.reply(t("wizard.askSlideCount"), { reply_markup: buildSlideCountKeyboard() });
    const slideCountCtx = await conversation.waitFor("callback_query:data");
    await slideCountCtx.answerCallbackQuery();
    const slideCount = Number(parseCallbackValue(slideCountCtx.callbackQuery.data, "slideCount"));

    await ctx.reply(t("wizard.askLanguage"), { reply_markup: buildLanguageKeyboard() });
    const languageCtx = await conversation.waitFor("callback_query:data");
    await languageCtx.answerCallbackQuery();
    const language = parseCallbackValue(languageCtx.callbackQuery.data, "language") as PresentationLanguageCode;

    await ctx.reply(t("wizard.askTheme"), { reply_markup: buildThemeKeyboard() });
    const themeCtx = await conversation.waitFor("callback_query:data");
    await themeCtx.answerCallbackQuery();
    const themeName = parseCallbackValue(themeCtx.callbackQuery.data, "theme") as ThemeName;

    await ctx.reply(t("wizard.generating"));

    const userId = BigInt(ctx.from!.id);
    const result = await conversation.external(() =>
      presentationService.generate({ userId, topic, slideCount, language, themeName })
    );

    if (result.success && result.buffer) {
      // grammY throws synchronously if a filename contains \r or \n (header
      // injection guard) - a plain `${topic}.pptx` crashes on any multi-line
      // topic (e.g. Shift+Enter), discarding an already-generated file.
      const safeFilename = `${topic.replace(/[\r\n]+/g, " ").trim().slice(0, 60) || "taqdimot"}.pptx`;
      await ctx.replyWithDocument(new InputFile(result.buffer, safeFilename), {
        caption: t("wizard.success"),
      });
    } else {
      await ctx.reply(t("wizard.error"));
    }
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/bot/conversations/presentationWizard.ts
git commit -m "feat: add presentation creation wizard conversation"
```

---

### Task 25: Admin conversations (add, remove, promote)

**Files:**
- Create: `src/bot/conversations/adminAddUser.ts`
- Create: `src/bot/conversations/adminRemoveUser.ts`
- Create: `src/bot/conversations/adminPromote.ts`

> Same testing note as Task 24: the parsing logic (`parseTelegramId`) is
> unit-tested in Task 23 and the repository calls are unit-tested in Task 6.
> These conversations are verified manually in Task 27.

- [ ] **Step 1: Write adminAddUser.ts**

```ts
// src/bot/conversations/adminAddUser.ts
import type { Context } from "grammy";
import type { Conversation } from "@grammyjs/conversations";
import type { MyContext } from "../context";
import { t } from "../../i18n/t";
import { parseTelegramId } from "./parsers";
import type { UserRepository } from "../../db/repositories/userRepository";

export function createAdminAddUserConversation(userRepository: UserRepository) {
  return async function adminAddUser(conversation: Conversation<MyContext>, ctx: Context): Promise<void> {
    await ctx.reply(t("admin.addUser.askId"));
    const idCtx = await conversation.waitFor("message:text");
    let targetId: bigint;
    try {
      targetId = parseTelegramId(idCtx.message.text);
    } catch (error) {
      await idCtx.reply(error instanceof Error ? error.message : String(error));
      return;
    }
    const addedById = BigInt(ctx.from!.id);
    await conversation.external(() => userRepository.add(targetId, addedById));
    await idCtx.reply(t("admin.addUser.success"));
  };
}
```

- [ ] **Step 2: Write adminRemoveUser.ts**

```ts
// src/bot/conversations/adminRemoveUser.ts
import type { Context } from "grammy";
import type { Conversation } from "@grammyjs/conversations";
import type { MyContext } from "../context";
import { t } from "../../i18n/t";
import { parseTelegramId } from "./parsers";
import type { UserRepository } from "../../db/repositories/userRepository";

export function createAdminRemoveUserConversation(userRepository: UserRepository) {
  return async function adminRemoveUser(conversation: Conversation<MyContext>, ctx: Context): Promise<void> {
    await ctx.reply(t("admin.removeUser.askId"));
    const idCtx = await conversation.waitFor("message:text");
    let targetId: bigint;
    try {
      targetId = parseTelegramId(idCtx.message.text);
    } catch (error) {
      await idCtx.reply(error instanceof Error ? error.message : String(error));
      return;
    }
    await conversation.external(() => userRepository.remove(targetId));
    await idCtx.reply(t("admin.removeUser.success"));
  };
}
```

- [ ] **Step 3: Write adminPromote.ts**

```ts
// src/bot/conversations/adminPromote.ts
import type { Context } from "grammy";
import type { Conversation } from "@grammyjs/conversations";
import type { MyContext } from "../context";
import { t } from "../../i18n/t";
import { parseTelegramId } from "./parsers";
import type { UserRepository } from "../../db/repositories/userRepository";

export function createAdminPromoteConversation(userRepository: UserRepository) {
  return async function adminPromote(conversation: Conversation<MyContext>, ctx: Context): Promise<void> {
    await ctx.reply(t("admin.promote.askId"));
    const idCtx = await conversation.waitFor("message:text");
    let targetId: bigint;
    try {
      targetId = parseTelegramId(idCtx.message.text);
    } catch (error) {
      await idCtx.reply(error instanceof Error ? error.message : String(error));
      return;
    }
    await conversation.external(() => userRepository.promote(targetId));
    await idCtx.reply(t("admin.promote.success"));
  };
}
```

- [ ] **Step 4: Commit**

```bash
git add src/bot/conversations/adminAddUser.ts src/bot/conversations/adminRemoveUser.ts src/bot/conversations/adminPromote.ts
git commit -m "feat: add admin add/remove/promote conversations"
```

---

### Task 26: Wire the bot together (bot/index.ts)

**Files:**
- Create: `src/bot/index.ts`

- [ ] **Step 1: Write the implementation**

```ts
// src/bot/index.ts
import { Bot } from "grammy";
// Note: @grammyjs/conversations v2 manages its own state internally and
// does NOT need grammY's core session() middleware - MyContext has no
// SessionFlavor, so bot.use(session(...)) would not type-check here.
import { conversations, createConversation } from "@grammyjs/conversations";
import type { MyContext } from "./context";
import { t } from "../i18n/t";
import { createAccessControlMiddleware } from "./middlewares/accessControl";
import { createStartHandler } from "./handlers/start";
import { helpHandler } from "./handlers/help";
import { createListUsersHandler } from "./handlers/listUsers";
import { buildAdminMenuKeyboard } from "./keyboards/adminMenu";
import { buildMainMenuKeyboard } from "./keyboards/mainMenu";
import { createPresentationWizard } from "./conversations/presentationWizard";
import { createAdminAddUserConversation } from "./conversations/adminAddUser";
import { createAdminRemoveUserConversation } from "./conversations/adminRemoveUser";
import { createAdminPromoteConversation } from "./conversations/adminPromote";
import { isSuperAdmin } from "./superAdmin";
import type { UserRepository } from "../db/repositories/userRepository";
import type { PresentationService } from "../services/presentationService";

export interface BotDependencies {
  botToken: string;
  superAdminId: bigint;
  userRepository: UserRepository;
  presentationService: PresentationService;
}

export function createBot(deps: BotDependencies): Bot<MyContext> {
  const bot = new Bot<MyContext>(deps.botToken);

  bot.use(conversations());
  bot.use(createConversation(createPresentationWizard(deps.presentationService), "presentationWizard"));
  bot.use(createConversation(createAdminAddUserConversation(deps.userRepository), "adminAddUser"));
  bot.use(createConversation(createAdminRemoveUserConversation(deps.userRepository), "adminRemoveUser"));
  bot.use(createConversation(createAdminPromoteConversation(deps.userRepository), "adminPromote"));

  bot.use(createAccessControlMiddleware(deps.userRepository));

  bot.command("start", createStartHandler(deps.userRepository));
  bot.command("help", helpHandler);

  bot.hears(t("menu.createPresentation"), async (ctx) => {
    await ctx.conversation.enter("presentationWizard");
  });

  bot.hears(t("menu.adminPanel"), async (ctx) => {
    const superAdmin = isSuperAdmin(BigInt(ctx.from!.id), deps.superAdminId);
    await ctx.reply(t("menu.adminPanel"), { reply_markup: buildAdminMenuKeyboard(superAdmin) });
  });

  bot.hears(t("menu.back"), async (ctx) => {
    const admin = await deps.userRepository.isAdmin(BigInt(ctx.from!.id));
    await ctx.reply(t("start.welcome"), { reply_markup: buildMainMenuKeyboard(admin) });
  });

  bot.hears(t("admin.addUser"), async (ctx) => {
    await ctx.conversation.enter("adminAddUser");
  });

  bot.hears(t("admin.removeUser"), async (ctx) => {
    await ctx.conversation.enter("adminRemoveUser");
  });

  bot.hears(t("admin.listUsers"), createListUsersHandler(deps.userRepository));

  bot.hears(t("admin.promote"), async (ctx) => {
    if (!isSuperAdmin(BigInt(ctx.from!.id), deps.superAdminId)) {
      return;
    }
    await ctx.conversation.enter("adminPromote");
  });

  return bot;
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/bot/index.ts
git commit -m "feat: wire grammY bot (menus, admin panel, conversations)"
```

---

### Task 27: Entrypoint (webhook HTTP server)

**Files:**
- Create: `src/index.ts`

- [ ] **Step 1: Write the implementation**

```ts
// src/index.ts
import "dotenv/config";
import { createServer } from "node:http";
import { webhookCallback } from "grammy";
import { loadEnv } from "./config/env";
import { createDbClient } from "./db/client";
import { UserRepository } from "./db/repositories/userRepository";
import { PresentationRepository } from "./db/repositories/presentationRepository";
import { AiClient } from "./ai/client";
import { PresentationService } from "./services/presentationService";
import { createBot } from "./bot";
import { createLogger } from "./logger";

async function main(): Promise<void> {
  const env = loadEnv();
  const logger = createLogger();
  const db = createDbClient(env.DATABASE_URL);
  const userRepository = new UserRepository(db);
  const presentationRepository = new PresentationRepository(db);

  await userRepository.ensureSuperAdmin(env.SUPER_ADMIN_ID);

  const aiClient = new AiClient(env.ANTHROPIC_API_KEY, env.CLAUDE_MODEL);
  const presentationService = new PresentationService(aiClient, presentationRepository);

  const bot = createBot({
    botToken: env.BOT_TOKEN,
    superAdminId: env.SUPER_ADMIN_ID,
    userRepository,
    presentationService,
  });

  await bot.init();

  const handleUpdate = webhookCallback(bot, "http", { secretToken: env.WEBHOOK_SECRET });

  const server = createServer((req, res) => {
    if (req.url === "/health") {
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end("ok");
      return;
    }
    if (req.url === "/webhook" && req.method === "POST") {
      handleUpdate(req, res).catch((error) => {
        logger.error({ error }, "Failed to handle Telegram update");
        if (!res.writableEnded) {
          res.writeHead(500);
          res.end();
        }
      });
      return;
    }
    res.writeHead(404);
    res.end();
  });

  server.listen(env.PORT, () => {
    logger.info({ port: env.PORT }, "Server listening");
  });

  await bot.api.setWebhook(`https://${env.WEBHOOK_DOMAIN}/webhook`, {
    secret_token: env.WEBHOOK_SECRET,
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
```

Note: this is the composition root — it performs real I/O (DB connection,
webhook registration, HTTP server) and is intentionally not unit-tested.
It is verified in Task 30 by running the full stack via Docker and hitting
`/health`, and by exercising the bot manually in Telegram.

- [ ] **Step 2: Verify the whole project builds**

Run: `npm run build`
Expected: `dist/index.js` and the rest of `dist/` are created with no
TypeScript errors.

- [ ] **Step 3: Run the full test suite**

Run: `npm test`
Expected: all test files pass.

- [ ] **Step 4: Commit**

```bash
git add src/index.ts
git commit -m "feat: add webhook HTTP server entrypoint"
```

---

### Task 28: Dockerfile

**Files:**
- Create: `Dockerfile`

- [ ] **Step 1: Write the Dockerfile**

```dockerfile
# --- Stage 1: build ---
FROM node:20-slim AS builder
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY prisma ./prisma
RUN npx prisma generate

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# --- Stage 2: runtime ---
FROM node:20-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/* \
    && useradd -m -u 1000 appuser

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY package.json ./

RUN chown -R appuser:appuser /app
USER appuser

HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

EXPOSE 3000
CMD ["node", "dist/index.js"]
```

- [ ] **Step 2: Verify the image builds**

Run: `docker build -t slaydbot:local .`
Expected: build completes successfully (final layer `CMD ["node", "dist/index.js"]`).

- [ ] **Step 3: Commit**

```bash
git add Dockerfile
git commit -m "build: add multi-stage Dockerfile (isolated-vm/sharp native build)"
```

---

### Task 29: docker-compose.yml and .env.example

**Files:**
- Create: `docker-compose.yml`
- Create: `.env.example`

- [ ] **Step 1: Write docker-compose.yml**

```yaml
services:
  db:
    image: postgres:16-alpine
    container_name: slaydbot_db
    restart: always
    environment:
      POSTGRES_USER: ${DB_USER:-postgres}
      POSTGRES_PASSWORD: ${DB_PASSWORD:-postgres}
      POSTGRES_DB: ${DB_NAME:-slaydbot}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER:-postgres}"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - backend

  bot:
    build: .
    container_name: slaydbot_bot
    restart: on-failure:5
    depends_on:
      db:
        condition: service_healthy
    env_file:
      - .env
    environment:
      - DATABASE_URL=postgresql://${DB_USER:-postgres}:${DB_PASSWORD:-postgres}@db:5432/${DB_NAME:-slaydbot}
      - VIRTUAL_HOST=${WEBHOOK_DOMAIN}
      - VIRTUAL_PORT=3000
      - LETSENCRYPT_HOST=${WEBHOOK_DOMAIN}
      - LETSENCRYPT_EMAIL=${SSL_EMAIL}
    healthcheck:
      test: ["CMD-SHELL", "curl -f http://localhost:3000/health || exit 1"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 20s
    expose:
      - "3000"
    networks:
      - backend
      - proxy_network

networks:
  backend:
  proxy_network:
    external: true

volumes:
  postgres_data:
```

- [ ] **Step 2: Write .env.example**

```
BOT_TOKEN=
SUPER_ADMIN_ID=
ANTHROPIC_API_KEY=
CLAUDE_MODEL=claude-opus-4-5
WEBHOOK_DOMAIN=xamidullayevi.uz
WEBHOOK_SECRET=
PORT=3000
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/slaydbot
DB_USER=postgres
DB_PASSWORD=
DB_NAME=slaydbot
SSL_EMAIL=admin@example.com
LOG_LEVEL=info
```

- [ ] **Step 3: Verify the compose file is valid**

Run: `docker compose config`
Expected: prints the resolved compose configuration with no errors (missing
`.env` values show as empty, which is fine at this stage).

- [ ] **Step 4: Commit**

```bash
git add docker-compose.yml .env.example
git commit -m "build: add docker-compose (bot + postgres) joining the shared proxy_network"
```

---

### Task 30: Deploy script

**Files:**
- Create: `scripts/deploy.sh`

- [ ] **Step 1: Write the script**

```bash
#!/bin/bash
# Slaydbot Production Deployment Script
# Run on server: bash scripts/deploy.sh

set -e

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"

echo -e "${GREEN}=== Slaydbot Deployment ===${NC}"

echo -e "${YELLOW}[1/6] Pre-flight checks...${NC}"
if ! command -v docker &> /dev/null; then
  echo -e "${RED}Docker not installed. Installing...${NC}"
  curl -fsSL https://get.docker.com | sudo sh
fi

if [[ ! -f .env ]]; then
  echo -e "${RED}.env not found. Copy .env.example to .env and fill in values.${NC}"
  exit 1
fi

echo -e "${YELLOW}[2/6] Backing up database...${NC}"
mkdir -p backups
if sudo docker ps --format '{{.Names}}' | grep -q 'slaydbot_db'; then
  BACKUP_NAME="backup_$(date +%Y%m%d_%H%M%S)"
  DB_USER_VALUE=$(grep '^DB_USER=' .env | cut -d= -f2)
  DB_NAME_VALUE=$(grep '^DB_NAME=' .env | cut -d= -f2)
  sudo docker exec slaydbot_db pg_dump -U "$DB_USER_VALUE" "$DB_NAME_VALUE" \
    | gzip > "backups/${BACKUP_NAME}.sql.gz" \
    && echo -e "${GREEN}Backup created: backups/${BACKUP_NAME}.sql.gz${NC}" \
    || echo -e "${YELLOW}Backup skipped (db not ready yet)${NC}"
else
  echo -e "${YELLOW}Backup skipped (container not running)${NC}"
fi

echo -e "${YELLOW}[3/6] Pulling latest code...${NC}"
git stash
git pull origin master
git stash pop 2>/dev/null || true

echo -e "${YELLOW}[4/6] Ensuring proxy_network exists...${NC}"
if ! sudo docker network inspect proxy_network &>/dev/null; then
  sudo docker network create proxy_network
fi

echo -e "${YELLOW}[5/6] Building and starting containers...${NC}"
sudo docker compose down
sudo docker compose up -d --build

echo "Waiting for containers to initialize..."
sleep 10

echo -e "${YELLOW}[6/6] Running database migrations and health check...${NC}"
sudo docker compose exec -T bot npx prisma migrate deploy

HTTP_CODE=$(sudo docker compose exec -T bot curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/health || echo "000")
if [[ "$HTTP_CODE" == "200" ]]; then
  echo -e "${GREEN}Bot is healthy.${NC}"
else
  echo -e "${RED}Health check failed (status: $HTTP_CODE). Check logs: docker compose logs bot${NC}"
fi

echo -e "${GREEN}=== Deployment Complete ===${NC}"
DOMAIN=$(grep '^WEBHOOK_DOMAIN=' .env | cut -d= -f2)
echo "Test: curl -I https://${DOMAIN}/health"
```

- [ ] **Step 2: Make it executable**

Run: `chmod +x scripts/deploy.sh`

- [ ] **Step 3: Commit**

```bash
git add scripts/deploy.sh
git commit -m "build: add deploy.sh (backup, pull, rebuild, migrate, health check)"
```

---

### Task 31: First Prisma migration and full-suite verification

**Files:**
- Create: `prisma/migrations/` (generated)

- [ ] **Step 1: Create the initial migration against a local Postgres**

Run (requires a local Postgres reachable at the `DATABASE_URL` in `.env.example`,
or a temporary one: `docker run --rm -d -p 5432:5432 -e POSTGRES_PASSWORD=postgres --name slaydbot_dev_db postgres:16-alpine`):

```bash
cp .env.example .env
# fill in DATABASE_URL to point at the local Postgres, then:
npx prisma migrate dev --name init
```

Expected: `prisma/migrations/<timestamp>_init/migration.sql` is created and
applied; Prisma prints `Your database is now in sync with your schema.`

- [ ] **Step 2: Run the entire test suite**

Run: `npm test`
Expected: every test file listed in Tasks 2–23 passes.

- [ ] **Step 3: Run a full production build**

Run: `npm run build`
Expected: no TypeScript errors.

- [ ] **Step 4: Stop the temporary dev database (if used)**

Run: `docker stop slaydbot_dev_db`

- [ ] **Step 5: Commit the migration**

```bash
git add prisma/migrations
git commit -m "chore: add initial Prisma migration"
```

---

## Manual End-to-End Verification (not automated)

After Task 31, before first production deploy:

1. Create a real Telegram bot via @BotFather, get `BOT_TOKEN`.
2. Get your own Telegram numeric ID (e.g. via @userinfobot), set as `SUPER_ADMIN_ID`.
3. Fill in `.env` (copy from `.env.example`) with a real `ANTHROPIC_API_KEY`,
   `WEBHOOK_DOMAIN=xamidullayevi.uz`, a random `WEBHOOK_SECRET`, and DB credentials.
4. On the server, join the existing `proxy_network` (already created by the
   QuizBot nginx-proxy/acme-companion setup) and run `bash scripts/deploy.sh`.
5. In Telegram: send `/start` to the bot as the super-admin — confirm the
   welcome message and menu (with "⚙️ Admin panel") appear.
6. Tap "🎨 Taqdimot yaratish", provide a topic, pick slide count/language/theme,
   and confirm a `.pptx` file arrives and opens correctly in PowerPoint/Google Slides/Keynote.
7. Tap "⚙️ Admin panel" → "➕ Foydalanuvchi qo'shish", add a second Telegram
   account's ID, and confirm that account can now use `/start`.
8. As a non-whitelisted third account, confirm `/start` replies with the
   access-denied message.

---

## Plan Self-Review

**Spec coverage:**
- §2 stack (grammY, pptxgenjs, isolated-vm, react-icons, sharp, Prisma, i18n, pino, Vitest, Docker) → Tasks 1, 8–17, 20–30.
- §3 modular structure → File Structure section + every task's file paths.
- §4 roles/admin buttons (SUPER_ADMIN via env, ADMIN via DB, Reply-Keyboard-only admin nav) → Tasks 6, 19–22, 25–26.
- §5 wizard flow (topic → slide count → language → theme → generate → send → record) → Tasks 20, 24.
- §6 code-generation + bridge + isolated-vm sandbox → Tasks 12–16, 18.
- §7 icons/themes → Tasks 9–11.
- §8 Prisma schema → Task 5.
- §9 env/constants/i18n, no hardcoding → Tasks 2–4.
- §10 deploy (same server, `xamidullayevi.uz`, `proxy_network`, `/webhook`) → Tasks 28–30.
- §11 error handling (try/catch per stage, friendly messages, DB status, logging) → Task 18 (service), Task 17 (logger), Task 27 (webhook error capture).
- §12 testing strategy (unit + integration + sandbox security tests) → Tasks 8, 12–18 include exactly these cases.

**Placeholder scan:** no TBD/TODO; every step has literal file content and
commands. The two tasks without automated tests (24, 25) explicitly justify
why (grammY conversations require the full runtime to execute) rather than
faking a test.

**Type consistency:** `ThemeName`/`PresentationLanguageCode` (Task 3) are
used identically in `themes/index.ts` (9), `wizardKeyboards.ts` (20),
`presentationWizard.ts` (24), and `presentationService.ts` (18).
`BridgeFunctions` (Task 12) is the type consumed by `sandbox.ts` (13) and
`presentationService.ts` (18). `UserRecord`/`UserRepository` methods (Task 6)
match their usage in `accessControl.ts`, `start.ts`, `listUsers.ts`,
`superAdmin`-gated handlers, and the admin conversations (Tasks 21–22, 25–26).

---

**Plan complete and saved to `docs/superpowers/plans/2026-08-29-slaydbot-implementation.md`.**
