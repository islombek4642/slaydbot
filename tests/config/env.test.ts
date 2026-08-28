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
