import { Keyboard } from "grammy";
import { t } from "../../i18n/t";

export function buildMainMenuKeyboard(isSuperAdmin: boolean): Keyboard {
  const keyboard = new Keyboard().text(t("menu.createPresentation"));
  if (isSuperAdmin) {
    keyboard.text(t("menu.adminPanel"));
  }
  return keyboard.resized();
}
