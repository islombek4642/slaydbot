import { describe, it, expect } from "vitest";
import {
  buildAdminDeleteConfirmKeyboard,
  buildAdminListInlineKeyboard,
} from "../../../src/bot/keyboards/adminListInline";

function flatten(keyboard: { inline_keyboard: { text: string; callback_data?: string }[][] }) {
  return keyboard.inline_keyboard.flat().map((btn) => ({ text: btn.text, data: btn.callback_data }));
}

describe("buildAdminListInlineKeyboard", () => {
  it("shows only the delete button when there is a single manageable admin", () => {
    const keyboard = buildAdminListInlineKeyboard(111n, 0, 1);
    const buttons = flatten(keyboard);
    expect(buttons).toEqual([{ text: "❌", data: "adminList:askDelete:111:0" }]);
  });

  it("shows wrap-around arrows around delete at the first page of three", () => {
    const keyboard = buildAdminListInlineKeyboard(111n, 0, 3);
    const buttons = flatten(keyboard);
    expect(buttons).toEqual([
      { text: "◀", data: "adminList:page:2" },
      { text: "❌", data: "adminList:askDelete:111:0" },
      { text: "▶", data: "adminList:page:1" },
    ]);
  });

  it("shows wrap-around arrows around delete at the last page of three", () => {
    const keyboard = buildAdminListInlineKeyboard(333n, 2, 3);
    const buttons = flatten(keyboard);
    expect(buttons).toEqual([
      { text: "◀", data: "adminList:page:1" },
      { text: "❌", data: "adminList:askDelete:333:2" },
      { text: "▶", data: "adminList:page:0" },
    ]);
  });
});

describe("buildAdminDeleteConfirmKeyboard", () => {
  it("produces confirm and cancel buttons with the expected callback data", () => {
    const keyboard = buildAdminDeleteConfirmKeyboard(555n, 1);
    const buttons = flatten(keyboard);
    expect(buttons).toEqual([
      { text: "✅ Ha, o'chirish", data: "adminList:confirmDelete:555:1" },
      { text: "❌ Bekor qilish", data: "adminList:cancelDelete:1" },
    ]);
  });
});
