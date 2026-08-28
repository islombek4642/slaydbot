import { describe, it, expect } from "vitest";
import { buildMainMenuKeyboard } from "../../../src/bot/keyboards/mainMenu";

describe("buildMainMenuKeyboard", () => {
  it("shows only the create-presentation button for non-admins", () => {
    const keyboard = buildMainMenuKeyboard(false);
    const texts = keyboard.keyboard.flat().map((btn: any) => btn.text);
    expect(texts).toEqual(["🎨 Taqdimot yaratish"]);
  });

  it("adds the admin panel button for admins", () => {
    const keyboard = buildMainMenuKeyboard(true);
    const texts = keyboard.keyboard.flat().map((btn: any) => btn.text);
    expect(texts).toEqual(["🎨 Taqdimot yaratish", "⚙️ Admin panel"]);
  });
});
