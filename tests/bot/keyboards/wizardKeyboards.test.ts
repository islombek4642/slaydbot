import { describe, it, expect } from "vitest";
import {
  buildSlideCountKeyboard,
  buildLanguageKeyboard,
  buildThemeKeyboard,
  buildConfirmKeyboard,
  buildCancelKeyboard,
} from "../../../src/bot/keyboards/wizardKeyboards";

function rowTexts(keyboard: { keyboard: { text: string }[][] }): string[][] {
  return keyboard.keyboard.map((row) => row.map((b) => b.text));
}

describe("wizard keyboards", () => {
  it("builds a button for every slide count option plus an AI-decides option, and a cancel button", () => {
    const texts = buildSlideCountKeyboard().keyboard.flat().map((b: any) => b.text);
    expect(texts).toEqual(["5", "10", "15", "20", "🤖 AI tanlasin", "❌ Bekor qilish"]);
  });

  it("puts the AI-decides option and the cancel button on the same row", () => {
    expect(rowTexts(buildSlideCountKeyboard())).toEqual([
      ["5", "10", "15", "20"],
      ["🤖 AI tanlasin", "❌ Bekor qilish"],
    ]);
  });

  it("builds a button for every language, and a cancel button", () => {
    const texts = buildLanguageKeyboard().keyboard.flat().map((b: any) => b.text);
    expect(texts).toEqual(["O'zbek", "Rus", "Ingliz", "❌ Bekor qilish"]);
  });

  it("lays out language options two per row, with the last one sharing a row with cancel", () => {
    expect(rowTexts(buildLanguageKeyboard())).toEqual([
      ["O'zbek", "Rus"],
      ["Ingliz", "❌ Bekor qilish"],
    ]);
  });

  it("builds a button for every theme, and a cancel button", () => {
    const texts = buildThemeKeyboard().keyboard.flat().map((b: any) => b.text);
    expect(texts).toEqual(["Corporate", "Creative", "Minimal", "Dark", "❌ Bekor qilish"]);
  });

  it("lays out theme options two per row, with cancel on its own row", () => {
    expect(rowTexts(buildThemeKeyboard())).toEqual([
      ["Corporate", "Creative"],
      ["Minimal", "Dark"],
      ["❌ Bekor qilish"],
    ]);
  });

  it("builds a single cancel button", () => {
    const texts = buildCancelKeyboard().keyboard.flat().map((b: any) => b.text);
    expect(texts).toEqual(["❌ Bekor qilish"]);
  });

  it("builds a confirm button and a cancel button, in order", () => {
    const texts = buildConfirmKeyboard().keyboard.flat().map((b: any) => b.text);
    expect(texts).toEqual(["✅ Tasdiqlash", "❌ Bekor qilish"]);
  });

  it("puts confirm and cancel on the same row", () => {
    expect(rowTexts(buildConfirmKeyboard())).toEqual([["✅ Tasdiqlash", "❌ Bekor qilish"]]);
  });
});
