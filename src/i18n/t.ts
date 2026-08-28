import uz from "./locales/uz.json";

type Locale = typeof uz;
export type TranslationKey = keyof Locale;

const locales: Record<string, Locale> = { uz };

export function t(
  key: TranslationKey,
  params?: Record<string, string | number>,
  locale = "uz"
): string {
  const dict = locales[locale] ?? locales.uz;
  let text: string | undefined = dict[key];
  if (text === undefined) {
    throw new Error(`Missing translation for key "${key}" in locale "${locale}"`);
  }
  if (params) {
    for (const [paramKey, value] of Object.entries(params)) {
      text = text.replaceAll(`{{${paramKey}}}`, String(value));
    }
  }
  return text;
}
