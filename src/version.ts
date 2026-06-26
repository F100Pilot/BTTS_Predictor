/**
 * User-facing app version — format: 0.MAIOR.MENOR.CORREÇÃO
 *   - MAIOR     (2.x.x): grande alteração estrutural
 *   - MENOR     (x.1.x): nova funcionalidade
 *   - CORREÇÃO  (x.x.1): correção de erros
 * The leading "0." marks the app as pre-1.0. This is the single source of truth
 * for the version shown in the app (package.json keeps a 3-part semver mirror
 * for tooling, since npm requires valid semver).
 */
export const APP_VERSION = '0.2.3.1';

/** Highlights of the current version, shown in the "what's new" popup on entry. */
export const WHATS_NEW: string[] = [
  'O painel passa a mostrar só os jogos já analisados — os jogos com "..." (ainda por analisar) deixam de aparecer (filtro "Mostrar só jogos analisados", ligado por defeito).',
  'Indicador de progresso "a analisar X/Y" enquanto as previsões são calculadas.',
];
