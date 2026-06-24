/**
 * Input sanitization helpers. The app never injects raw HTML, but external
 * data (team names, competition names) is escaped/trimmed defensively.
 */

// Control characters: U+0000–U+001F and U+007F. Stripping them is the point of
// this sanitizer, so the no-control-regex lint rule is intentionally disabled.
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\x00-\x1f\x7f]/g;

/** Strip control chars and trim. Use for any string coming from a data source. */
export function sanitizeText(input: unknown, maxLength = 120): string {
  if (typeof input !== 'string') return '';
  const cleaned = input.replace(CONTROL_CHARS, '').trim();
  return cleaned.slice(0, maxLength);
}

/** Clamp a numeric user input within bounds, returning fallback on NaN. */
export function sanitizeNumber(
  input: unknown,
  { min, max, fallback }: { min: number; max: number; fallback: number },
): number {
  const n = typeof input === 'number' ? input : Number(input);
  if (Number.isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/** Validate that a string looks like an API key (alphanumeric-ish). */
export function sanitizeApiKey(input: unknown): string {
  if (typeof input !== 'string') return '';
  return input.replace(/[^A-Za-z0-9._-]/g, '').slice(0, 200);
}
