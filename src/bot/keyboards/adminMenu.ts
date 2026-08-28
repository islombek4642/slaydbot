import { Keyboard } from "grammy";
import { t } from "../../i18n/t";

export function buildAdminMenuKeyboard(isSuperAdmin: boolean): Keyboard {
  const keyboard = new Keyboard()
    .text(t("admin.addUser"))
    .text(t("admin.removeUser"))
    .row()
    .text(t("admin.listUsers"));
  if (isSuperAdmin) {
    keyboard.text(t("admin.promote"));
  }
  keyboard.row().text(t("menu.back"));
  return keyboard.resized();
}
