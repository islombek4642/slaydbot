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

  it("succeeds when ANTHROPIC_API_KEY is omitted, leaving it undefined", () => {
    const { ANTHROPIC_API_KEY, ...rest } = validEnv;
    const env = loadEnv(rest);
    expect(env.ANTHROPIC_API_KEY).toBeUndefined();
  });

  it("succeeds when ANTHROPIC_API_KEY is present but empty (a bare 'KEY=' line in .env), leaving it undefined", () => {
    const env = loadEnv({ ...validEnv, ANTHROPIC_API_KEY: "" });
    expect(env.ANTHROPIC_API_KEY).toBeUndefined();
  });

  it("throws when DATABASE_URL is missing", () => {
    const { DATABASE_URL, ...rest } = validEnv;
    expect(() => loadEnv(rest)).toThrow(/DATABASE_URL/);
  });

  it("throws when WEBHOOK_DOMAIN is missing", () => {
    const { WEBHOOK_DOMAIN, ...rest } = validEnv;
    expect(() => loadEnv(rest)).toThrow(/WEBHOOK_DOMAIN/);
  });

  it("throws when WEBHOOK_SECRET is missing", () => {
    const { WEBHOOK_SECRET, ...rest } = validEnv;
    expect(() => loadEnv(rest)).toThrow(/WEBHOOK_SECRET/);
  });

  it("throws when SUPER_ADMIN_ID is missing", () => {
    const { SUPER_ADMIN_ID, ...rest } = validEnv;
    expect(() => loadEnv(rest)).toThrow(/SUPER_ADMIN_ID/);
  });
});
