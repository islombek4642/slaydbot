import { describe, it, expect } from "vitest";
import { buildAdminMenuKeyboard } from "../../../src/bot/keyboards/adminMenu";

describe("buildAdminMenuKeyboard", () => {
  it("shows the admins button, the model button, and the back button, in order", () => {
    const keyboard = buildAdminMenuKeyboard();
    const texts = keyboard.keyboard.flat().map((btn: any) => btn.text);
    expect(texts).toEqual(["👥 Adminlar", "🧠 Model", "🔙 Orqaga"]);
  });
});
