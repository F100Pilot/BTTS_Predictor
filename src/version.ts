/**
 * User-facing app version — format: 0.MAIOR.MENOR.CORREÇÃO
 *   - MAIOR     (2.x.x): grande alteração estrutural
 *   - MENOR     (x.1.x): nova funcionalidade
 *   - CORREÇÃO  (x.x.1): correção de erros
 * The leading "0." marks the app as pre-1.0. This is the single source of truth
 * for the version shown in the app (package.json keeps a 3-part semver mirror
 * for tooling, since npm requires valid semver).
 */
export const APP_VERSION = '0.2.16.0';

/** Highlights of the current version, shown in the "what's new" popup on entry. */
export const WHATS_NEW: string[] = [
  'Correção importante: os resultados deixam de ser obtidos da fonte errada. Cada jogo guardado fica associado à fonte de dados que o criou e só é liquidado por essa fonte (os IDs são diferentes entre fontes — era isso que dava scores trocados).',
  'Jogos antigos (sem fonte associada) ou de outra fonte são ignorados ao "Atualizar resultados" — apaga-os e volta a adicioná-los com a fonte atual.',
];
