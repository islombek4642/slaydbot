import { InlineKeyboard } from "grammy";
import { t } from "../../i18n/t";

export function buildAdminListInlineKeyboard(userId: bigint, page: number, total: number): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  if (total > 1) {
    const previousPage = (page - 1 + total) % total;
    keyboard.text("◀", `adminList:page:${previousPage}`);
  }
  keyboard.text("❌", `adminList:askDelete:${userId}:${page}`);
  if (total > 1) {
    const nextPage = (page + 1) % total;
    keyboard.text("▶", `adminList:page:${nextPage}`);
  }
  return keyboard;
}

export function buildAdminDeleteConfirmKeyboard(userId: bigint, page: number): InlineKeyboard {
  return new InlineKeyboard()
    .text(t("admin.list.confirmYes"), `adminList:confirmDelete:${userId}:${page}`)
    .text(t("admin.list.confirmNo"), `adminList:cancelDelete:${page}`);
}
