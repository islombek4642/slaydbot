import { z } from "zod";

const envSchema = z.object({
  BOT_TOKEN: z.string().min(1, "BOT_TOKEN is required"),
  SUPER_ADMIN_ID: z.coerce.bigint(),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  // .optional() alone only skips validation when the key is absent
  // (undefined) - a .env line like "ANTHROPIC_API_KEY=" (present but
  // empty) still sets process.env.ANTHROPIC_API_KEY to "", which would
  // fail .min(1). Preprocess "" to undefined so both cases are treated
  // as "not configured".
  ANTHROPIC_API_KEY: z.preprocess(
    (val) => (val === "" ? undefined : val),
    z.string().min(1, "ANTHROPIC_API_KEY is required").optional()
  ),
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
