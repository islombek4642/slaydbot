import { Keyboard } from "grammy";
import { t } from "../../i18n/t";

export function buildMainMenuKeyboard(isSuperAdmin: boolean): Keyboard {
  const keyboard = new Keyboard().text(t("menu.createPresentation")).row();
  if (isSuperAdmin) {
    keyboard.text(t("menu.adminPanel")).row();
  }
  return keyboard.resized();
}
