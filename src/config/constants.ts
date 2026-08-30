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

/** Widescreen deck canvas (pptxgenjs "LAYOUT_WIDE") - the AI is told these exact dimensions so its x/y/w/h coordinates land inside the slide. */
export const CANVAS_WIDTH_IN = 13.33;
export const CANVAS_HEIGHT_IN = 7.5;

/** Idle limit for a paused conversation (wizard, add-admin) before its next reply is treated as stale and falls back to the main menu instead of resuming. */
export const CONVERSATION_TIMEOUT_MS = 10 * 60 * 1000;

export const AI_MODELS = [
  { id: "claude-sonnet-5", label: "Sonnet 5" },
  { id: "claude-opus-5", label: "Opus 5" },
] as const;
export type AiModelId = (typeof AI_MODELS)[number]["id"];
export const DEFAULT_AI_MODEL: AiModelId = "claude-sonnet-5";
export const AI_MODEL_SETTING_KEY = "aiModel";

/** DPI for the .pptx -> JPEG slide renders used for visual QA. */
export const SLIDE_RENDER_DPI = 150;
/** Per-command (soffice / pdftoppm) timeout, so a wedged LibreOffice process can't hang a request forever. */
export const RENDER_TIMEOUT_MS = 60_000;

/**
 * Safety ceiling on generate-render-review rounds per presentation, not a
 * product limit - there is no target attempt count yet. generate() logs
 * every attempt (requestId, attempt number, what failed) specifically so
 * real usage data can inform what this should actually be set to later.
 */
export const MAX_GENERATION_ATTEMPTS = 10;
