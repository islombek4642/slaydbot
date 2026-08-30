import { describe, it, expect } from "vitest";
import { buildModelInlineKeyboard } from "../../../src/bot/keyboards/modelInline";

describe("buildModelInlineKeyboard", () => {
  it("marks the selected model with a checkmark and leaves the other plain", () => {
    const keyboard = buildModelInlineKeyboard("claude-sonnet-5");
    const buttons = keyboard.inline_keyboard.flat().map((b: any) => ({ text: b.text, data: b.callback_data }));
    expect(buttons).toEqual([
      { text: "✅ Sonnet 5", data: "model:claude-sonnet-5" },
      { text: "Opus 5", data: "model:claude-opus-5" },
    ]);
  });

  it("switches the checkmark to the other model when it is selected", () => {
    const keyboard = buildModelInlineKeyboard("claude-opus-5");
    const buttons = keyboard.inline_keyboard.flat().map((b: any) => b.text);
    expect(buttons).toEqual(["Sonnet 5", "✅ Opus 5"]);
  });

  it("puts both models on the same row", () => {
    const keyboard = buildModelInlineKeyboard("claude-sonnet-5");
    expect(keyboard.inline_keyboard).toHaveLength(1);
    expect(keyboard.inline_keyboard[0]).toHaveLength(2);
  });
});
