import { describe, it, expect } from "vitest";
import {
  buildSlideCountKeyboard,
  buildLanguageKeyboard,
  buildThemeKeyboard,
  buildCancelKeyboard,
} from "../../../src/bot/keyboards/wizardKeyboards";

describe("wizard keyboards", () => {
  it("builds a button for every slide count option plus an AI-decides option, and a cancel button", () => {
    const texts = buildSlideCountKeyboard().keyboard.flat().map((b: any) => b.text);
    expect(texts).toEqual(["5", "10", "15", "20", "🤖 AI tanlasin", "❌ Bekor qilish"]);
  });

  it("builds a button for every language, and a cancel button", () => {
    const texts = buildLanguageKeyboard().keyboard.flat().map((b: any) => b.text);
    expect(texts).toEqual(["O'zbek", "Rus", "Ingliz", "❌ Bekor qilish"]);
  });

  it("builds a button for every theme, and a cancel button", () => {
    const texts = buildThemeKeyboard().keyboard.flat().map((b: any) => b.text);
    expect(texts).toEqual(["Corporate", "Creative", "Minimal", "Dark", "❌ Bekor qilish"]);
  });

  it("builds a single cancel button", () => {
    const texts = buildCancelKeyboard().keyboard.flat().map((b: any) => b.text);
    expect(texts).toEqual(["❌ Bekor qilish"]);
  });
});
