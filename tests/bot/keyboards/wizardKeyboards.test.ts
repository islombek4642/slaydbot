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
