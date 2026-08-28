export const SLIDE_COUNT_OPTIONS = [5, 10, 15, 20] as const;
export type SlideCountOption = (typeof SLIDE_COUNT_OPTIONS)[number];

export const PRESENTATION_LANGUAGES = [
  { code: "uz", label: "O'zbek" },
  { code: "ru", label: "Rus" },
  { code: "en", label: "Ingliz" },
] as const;
export type PresentationLanguageCode = (typeof PRESENTATION_LANGUAGES)[number]["code"];

export const THEME_NAMES = ["corporate", "creative", "minimal", "dark"] as const;
export type ThemeName = (typeof THEME_NAMES)[number];

export const SANDBOX_TIMEOUT_MS = 5000;
export const SANDBOX_MEMORY_LIMIT_MB = 128;
