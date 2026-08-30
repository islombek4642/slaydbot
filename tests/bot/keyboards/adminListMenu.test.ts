import { describe, it, expect } from "vitest";
import { buildAdminListMenuKeyboard } from "../../../src/bot/keyboards/adminListMenu";

describe("buildAdminListMenuKeyboard", () => {
  it("shows the add-admin button and the back button, in order", () => {
    const keyboard = buildAdminListMenuKeyboard();
    const texts = keyboard.keyboard.flat().map((btn: any) => btn.text);
    expect(texts).toEqual(["➕ Admin qo'shish", "🔙 Orqaga"]);
  });

  it("puts both buttons on the same row", () => {
    const keyboard = buildAdminListMenuKeyboard();
    expect(keyboard.keyboard).toEqual([[{ text: "➕ Admin qo'shish" }, { text: "🔙 Orqaga" }]]);
  });
});
