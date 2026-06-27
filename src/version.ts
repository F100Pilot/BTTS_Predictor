/**
 * User-facing app version — format: 0.MAIOR.MENOR.CORREÇÃO
 *   - MAIOR     (2.x.x): grande alteração estrutural
 *   - MENOR     (x.1.x): nova funcionalidade
 *   - CORREÇÃO  (x.x.1): correção de erros
 * The leading "0." marks the app as pre-1.0. This is the single source of truth
 * for the version shown in the app (package.json keeps a 3-part semver mirror
 * for tooling, since npm requires valid semver).
 */
export const APP_VERSION = '0.2.19.0';

/** Highlights of the current version, shown in the "what's new" popup on entry. */
export const WHATS_NEW: string[] = [
  'Jogos sem histórico suficiente para análise passam a desaparecer sempre do painel (já não voltam a aparecer nem a ser analisados).',
  'A marca "insuficiente" fica guardada — na API-Football (modo manual), depois de analisares um jogo sem dados, ele some e não gasta mais pedidos.',
];
