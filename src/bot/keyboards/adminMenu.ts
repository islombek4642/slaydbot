import { Keyboard } from "grammy";
import { t } from "../../i18n/t";

export function buildAdminMenuKeyboard(): Keyboard {
  return new Keyboard()
    .text(t("admin.adminsButton"))
    .row()
    .text(t("admin.modelButton"))
    .row()
    .text(t("menu.back"))
    .resized();
}
