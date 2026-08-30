import { Keyboard } from "grammy";
import { SLIDE_COUNT_OPTIONS, PRESENTATION_LANGUAGES, THEME_NAMES, THEME_LABELS } from "../../config/constants";
import { t } from "../../i18n/t";

export function buildCancelKeyboard(): Keyboard {
  return new Keyboard().text(t("wizard.cancel")).resized();
}

export function buildSlideCountKeyboard(): Keyboard {
  const keyboard = new Keyboard();
  for (const count of SLIDE_COUNT_OPTIONS) {
    keyboard.text(String(count));
  }
  keyboard.row().text(t("wizard.slideCountAuto")).text(t("wizard.cancel"));
  return keyboard.resized();
}

export function buildLanguageKeyboard(): Keyboard {
  const keyboard = new Keyboard();
  PRESENTATION_LANGUAGES.forEach((lang, index) => {
    keyboard.text(lang.label);
    if (index % 2 === 1) {
      keyboard.row();
    }
  });
  keyboard.text(t("wizard.cancel"));
  return keyboard.resized();
}

export function buildThemeKeyboard(): Keyboard {
  const keyboard = new Keyboard();
  THEME_NAMES.forEach((themeName, index) => {
    keyboard.text(THEME_LABELS[themeName]);
    if (index % 2 === 1) {
      keyboard.row();
    }
  });
  keyboard.text(t("wizard.cancel"));
  return keyboard.resized();
}

export function buildConfirmKeyboard(): Keyboard {
  return new Keyboard().text(t("wizard.confirm.yes")).text(t("wizard.cancel")).resized();
}
