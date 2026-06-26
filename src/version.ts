/**
 * User-facing app version — format: 0.MAIOR.MENOR.CORREÇÃO
 *   - MAIOR     (2.x.x): grande alteração estrutural
 *   - MENOR     (x.1.x): nova funcionalidade
 *   - CORREÇÃO  (x.x.1): correção de erros
 * The leading "0." marks the app as pre-1.0. This is the single source of truth
 * for the version shown in the app (package.json keeps a 3-part semver mirror
 * for tooling, since npm requires valid semver).
 */
export const APP_VERSION = '0.2.3.0';

/** Highlights of the current version, shown in the "what's new" popup on entry. */
export const WHATS_NEW: string[] = [
  'Ao Vivo: passa a mostrar apenas os jogos que estão no teu histórico de previsões ou nas tuas apostas — em vez de todos os jogos da fonte.',
  'A hora de início do jogo passa a aparecer no histórico, no ecrã Ao Vivo e na análise (corrigida a hora errada nos jogos abertos a partir do Ao Vivo).',
];
