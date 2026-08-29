export const SLIDE_COUNT_OPTIONS = [5, 10, 15, 20] as const;

/** Sentinel meaning "let AI decide the slide count" (chosen as -1, not 0, to avoid reading as "zero slides"). */
export const SLIDE_COUNT_AUTO = -1 as const;

export const PRESENTATION_LANGUAGES = [
  { code: "uz", label: "O'zbek" },
  { code: "ru", label: "Rus" },
  { code: "en", label: "Ingliz" },
] as const;
export type PresentationLanguageCode = (typeof PRESENTATION_LANGUAGES)[number]["code"];

export const THEME_NAMES = ["corporate", "creative", "minimal", "dark"] as const;
export type ThemeName = (typeof THEME_NAMES)[number];

export const THEME_LABELS: Record<ThemeName, string> = {
  corporate: "Corporate",
  creative: "Creative",
  minimal: "Minimal",
  dark: "Dark",
};

export const SANDBOX_TIMEOUT_MS = 5000;
export const SANDBOX_MEMORY_LIMIT_MB = 128;
