export function parseCallbackValue(data: string, expectedPrefix: string): string {
  const [prefix, value] = data.split(":");
  if (prefix !== expectedPrefix || value === undefined) {
    throw new Error(`Invalid callback data "${data}" for prefix "${expectedPrefix}"`);
  }
  return value;
}

export function parseTelegramId(text: string): bigint {
  const trimmed = text.trim();
  if (!/^\d+$/.test(trimmed)) {
    throw new Error(`"${text}" is not a valid Telegram ID`);
  }
  return BigInt(trimmed);
}
