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
