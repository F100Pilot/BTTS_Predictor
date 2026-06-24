/** Numeric helpers that never throw on empty input / division by zero. */

export function clamp(value: number, min = 0, max = 1): number {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export function safeDivide(numerator: number, denominator: number, fallback = 0): number {
  if (!denominator || Number.isNaN(denominator)) return fallback;
  return numerator / denominator;
}

export function average(values: number[], fallback = 0): number {
  if (values.length === 0) return fallback;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/** Percentage of values that satisfy the predicate (0..1). */
export function ratio<T>(items: T[], predicate: (item: T) => boolean, fallback = 0): number {
  if (items.length === 0) return fallback;
  const count = items.filter(predicate).length;
  return count / items.length;
}

/** Sample standard deviation (population), 0 for <2 values. */
export function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = average(values);
  const variance = average(values.map((v) => (v - mean) ** 2));
  return Math.sqrt(variance);
}

export function round(value: number, decimals = 0): number {
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
}

/** Format a 0..1 probability as a whole-number percentage string. */
export function toPercent(value: number, decimals = 0): string {
  return `${round(value * 100, decimals).toFixed(decimals)}%`;
}
