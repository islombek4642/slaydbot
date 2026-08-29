import { describe, it, expect } from "vitest";
import {
  parseSlideCountText,
  parseLanguageText,
  parseThemeText,
  parseTelegramId,
} from "../../../src/bot/conversations/parsers";
import { SLIDE_COUNT_AUTO } from "../../../src/config/constants";

describe("parseSlideCountText", () => {
  it("parses a known slide count option", () => {
    expect(parseSlideCountText("10")).toBe(10);
  });

  it("parses the AI-decides label into the auto sentinel", () => {
    expect(parseSlideCountText("🤖 AI tanlasin")).toBe(SLIDE_COUNT_AUTO);
  });

  it("returns undefined for a number that is not one of the options", () => {
    expect(parseSlideCountText("7")).toBeUndefined();
  });

  it("returns undefined for non-numeric text", () => {
    expect(parseSlideCountText("abc")).toBeUndefined();
  });
});

describe("parseLanguageText", () => {
  it("maps a known language label to its code", () => {
    expect(parseLanguageText("O'zbek")).toBe("uz");
    expect(parseLanguageText("Rus")).toBe("ru");
    expect(parseLanguageText("Ingliz")).toBe("en");
  });

  it("returns undefined for an unknown label", () => {
    expect(parseLanguageText("French")).toBeUndefined();
  });
});

describe("parseThemeText", () => {
  it("maps a known theme label to its name", () => {
    expect(parseThemeText("Corporate")).toBe("corporate");
    expect(parseThemeText("Dark")).toBe("dark");
  });

  it("returns undefined for an unknown label", () => {
    expect(parseThemeText("Neon")).toBeUndefined();
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
