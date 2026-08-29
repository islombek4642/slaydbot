import {
  SLIDE_COUNT_OPTIONS,
  SLIDE_COUNT_AUTO,
  PRESENTATION_LANGUAGES,
  THEME_NAMES,
  THEME_LABELS,
  type PresentationLanguageCode,
  type ThemeName,
} from "../../config/constants";
import { t } from "../../i18n/t";

export function parseSlideCountText(text: string): number | undefined {
  if (text === t("wizard.slideCountAuto")) {
    return SLIDE_COUNT_AUTO;
  }
  const value = Number(text);
  return (SLIDE_COUNT_OPTIONS as readonly number[]).includes(value) ? value : undefined;
}

export function parseLanguageText(text: string): PresentationLanguageCode | undefined {
  return PRESENTATION_LANGUAGES.find((lang) => lang.label === text)?.code;
}

export function parseThemeText(text: string): ThemeName | undefined {
  return THEME_NAMES.find((themeName) => THEME_LABELS[themeName] === text);
}

export function formatSlideCount(slideCount: number): string {
  return slideCount === SLIDE_COUNT_AUTO ? t("wizard.slideCountAuto") : String(slideCount);
}

export function formatLanguage(code: PresentationLanguageCode): string {
  return PRESENTATION_LANGUAGES.find((lang) => lang.code === code)!.label;
}

export function formatTheme(themeName: ThemeName): string {
  return THEME_LABELS[themeName];
}

export function parseTelegramId(text: string): bigint {
  const trimmed = text.trim();
  if (!/^\d+$/.test(trimmed)) {
    throw new Error(`"${text}" is not a valid Telegram ID`);
  }
  return BigInt(trimmed);
}
