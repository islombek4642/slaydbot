import { Keyboard } from "grammy";
import { t } from "../../i18n/t";

export function buildAdminListMenuKeyboard(): Keyboard {
  return new Keyboard().text(t("admin.addUser")).text(t("menu.back")).resized();
}
