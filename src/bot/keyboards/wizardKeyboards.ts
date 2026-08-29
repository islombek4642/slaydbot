import { InlineKeyboard } from "grammy";
import { SLIDE_COUNT_OPTIONS, PRESENTATION_LANGUAGES, THEME_NAMES, type ThemeName } from "../../config/constants";
import { t } from "../../i18n/t";

export function buildSlideCountKeyboard(): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  for (const count of SLIDE_COUNT_OPTIONS) {
    keyboard.text(String(count), `slideCount:${count}`);
  }
  keyboard.row().text(t("wizard.slideCountAuto"), "slideCount:auto");
  return keyboard;
}

export function buildLanguageKeyboard(): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  for (const lang of PRESENTATION_LANGUAGES) {
    keyboard.text(lang.label, `language:${lang.code}`).row();
  }
  return keyboard;
}

const THEME_LABELS: Record<ThemeName, string> = {
  corporate: "Corporate",
  creative: "Creative",
  minimal: "Minimal",
  dark: "Dark",
};

export function buildThemeKeyboard(): InlineKeyboard {
  const keyboard = new InlineKeyboard();
  for (const themeName of THEME_NAMES) {
    keyboard.text(THEME_LABELS[themeName], `theme:${themeName}`).row();
  }
  return keyboard;
}

export function buildCancelKeyboard(): InlineKeyboard {
  return new InlineKeyboard().text(t("wizard.cancel"), "cancel");
}
