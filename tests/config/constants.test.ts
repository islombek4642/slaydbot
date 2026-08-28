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
