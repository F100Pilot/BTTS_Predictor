/**
 * User-facing app version — format: 0.MAIOR.MENOR.CORREÇÃO
 *   - MAIOR     (2.x.x): grande alteração estrutural
 *   - MENOR     (x.1.x): nova funcionalidade
 *   - CORREÇÃO  (x.x.1): correção de erros
 * The leading "0." marks the app as pre-1.0. This is the single source of truth
 * for the version shown in the app (package.json keeps a 3-part semver mirror
 * for tooling, since npm requires valid semver).
 */
export const APP_VERSION = '0.2.14.0';

/** Highlights of the current version, shown in the "what's new" popup on entry. */
export const WHATS_NEW: string[] = [
  'O painel deixa de mostrar (e de analisar) jogos que já começaram — só vês jogos por disputar. Novo filtro "Esconder jogos já começados" (ligado por defeito).',
  'Isto também poupa pedidos à API, já que jogos passados deixam de ser analisados.',
  'Novo botão "Adicionar ao histórico" (+) em cada jogo do painel.',
];
