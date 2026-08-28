import { describe, it, expect } from "vitest";
import { buildAdminMenuKeyboard } from "../../../src/bot/keyboards/adminMenu";

describe("buildAdminMenuKeyboard", () => {
  it("hides the promote button for regular admins", () => {
    const keyboard = buildAdminMenuKeyboard(false);
    const texts = keyboard.keyboard.flat().map((btn: any) => btn.text);
    expect(texts).not.toContain("⬆️ Admin qilish");
    expect(texts).toContain("🔙 Orqaga");
  });

  it("shows the promote button for the super admin", () => {
    const keyboard = buildAdminMenuKeyboard(true);
    const texts = keyboard.keyboard.flat().map((btn: any) => btn.text);
    expect(texts).toContain("⬆️ Admin qilish");
  });
});
