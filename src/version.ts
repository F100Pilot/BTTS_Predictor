/**
 * User-facing app version — format: 0.MAIOR.MENOR.CORREÇÃO
 *   - MAIOR     (2.x.x): grande alteração estrutural
 *   - MENOR     (x.1.x): nova funcionalidade
 *   - CORREÇÃO  (x.x.1): correção de erros
 * The leading "0." marks the app as pre-1.0. This is the single source of truth
 * for the version shown in the app (package.json keeps a 3-part semver mirror
 * for tooling, since npm requires valid semver).
 */
export const APP_VERSION = '0.2.8.0';

/** Highlights of the current version, shown in the "what's new" popup on entry. */
export const WHATS_NEW: string[] = [
  'Novo filtro "Só grandes competições" (ligado por defeito): mostra apenas as grandes ligas (Premier League, La Liga, Serie A, Bundesliga, Ligue 1, Liga Portugal, Eredivisie, Championship) e competições mundiais/continentais (Mundial, Euro, Champions, Libertadores, etc.).',
  'Isto reduz dias de centenas de jogos a uma mão-cheia, para a análise terminar dentro da quota da API.',
  'Podes desligá-lo nos filtros do painel se quiseres ver todos os jogos.',
];
