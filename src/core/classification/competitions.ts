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

/**
 * Allowlist heuristic for "big" football only: the top domestic leagues plus
 * world/continental tournaments (World Cup, Euro, Champions League, Libertadores,
 * etc.). When the user only wants the marquee games, this slashes a 400+ game
 * day down to a handful — so the analysis finishes within the API quota.
 */
const MAJOR_PATTERNS: RegExp[] = [
  // International — national teams
  /\bworld cup\b/i,
  /\bcopa do mundo\b/i,
  /\bmundial\b/i,
  /\b(uefa )?euro(pean)?\s*(championship|\d{4})\b/i,
  /\bcopa am[eé]rica\b/i,
  /\bnations league\b/i,
  /\bconfederations cup\b/i,
  /\b(africa cup of nations|afcon|copa africana)\b/i,
  /\b(afc )?asian cup\b/i,
  /\b(concacaf )?gold cup\b/i,
  // International — clubs
  /\bclub world cup\b/i,
  /\bchampions league\b/i,
  /\beuropa league\b/i,
  /\bconference league\b/i,
  /\bcopa libertadores\b/i,
  /\bcopa sudamericana\b/i,
  // Top domestic leagues (the recognised "grandes ligas")
  /\bpremier league\b/i,
  /\b(la\s?liga|primera divisi[oó]n)\b/i,
  /\bserie a\b/i,
  /\bs[eé]rie a\b/i, // Brazilian Série A
  /\bbundesliga\b/i,
  /\bligue 1\b/i,
  /\b(primeira liga|liga portugal)\b/i,
  /\beredivisie\b/i,
  /\b(efl )?championship\b/i,
];

/** True when a competition is a top league or a world/continental tournament. */
export function isMajorCompetition(name: string, country?: string): boolean {
  if (!name) return false;
  // Never treat youth/friendly/reserve variants as "major", even if the name
  // contains a big-league word (e.g. "Premier League U21", "World Cup U20").
  if (isMinorCompetition(name)) return false;
  const haystack = country ? `${country} ${name}` : name;
  return MAJOR_PATTERNS.some((re) => re.test(haystack));
}
