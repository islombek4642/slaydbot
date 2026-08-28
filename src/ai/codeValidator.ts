const BANNED_PATTERNS: RegExp[] = [
  /\brequire\s*\(/,
  /\bimport\s+/,
  /\bprocess\s*\./,
  /\beval\s*\(/,
  /\bFunction\s*\(/,
  /\bfetch\s*\(/,
  /\bXMLHttpRequest\b/,
  /__proto__/,
  /constructor\s*\.\s*constructor/,
];

export interface ValidationResult {
  valid: boolean;
  reason?: string;
}

export function validateGeneratedCode(code: string): ValidationResult {
  for (const pattern of BANNED_PATTERNS) {
    if (pattern.test(code)) {
      return { valid: false, reason: `Code contains a banned pattern: ${pattern.source}` };
    }
  }
  return { valid: true };
}
