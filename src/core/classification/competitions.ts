/**
 * Heuristic to flag amateur / youth / friendly / reserve competitions by name.
 * Used to keep the dashboard (and the costly analysis) focused on senior
 * professional football, so a day isn't flooded with hundreds of minor games.
 */
const MINOR_PATTERNS: RegExp[] = [
  /\bu-?\d{2}\b/i, // U20, U-19, U23
  /\bsub-?\d{2}\b/i, // Sub-20, Sub-23
  /\b(youth|junior|juniors|juvenil|primavera|academy)\b/i,
  /\bfriendl/i, // Friendlies / Friendly
  /\bamig[aá]ve/i, // Amigáveis
  /\b(amateur|amador|amadora)\b/i,
  /\b(reserve|reserves|reserva|reservas)\b/i,
];

/** True when a competition name looks amateur/youth/friendly/reserve/women. */
export function isMinorCompetition(name: string): boolean {
  if (!name) return false;
  return MINOR_PATTERNS.some((re) => re.test(name));
}
