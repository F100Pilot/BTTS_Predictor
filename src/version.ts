/**
 * User-facing app version — format: 0.MAIOR.MENOR.CORREÇÃO
 *   - MAIOR     (2.x.x): grande alteração estrutural
 *   - MENOR     (x.1.x): nova funcionalidade
 *   - CORREÇÃO  (x.x.1): correção de erros
 * The leading "0." marks the app as pre-1.0. This is the single source of truth
 * for the version shown in the app (package.json keeps a 3-part semver mirror
 * for tooling, since npm requires valid semver).
 */
export const APP_VERSION = '0.2.13.0';

/** Highlights of the current version, shown in the "what's new" popup on entry. */
export const WHATS_NEW: string[] = [
  'Novo botão "Adicionar ao histórico" (ícone +) em cada jogo do painel — guarda o jogo no Histórico sem teres de abrir a análise.',
  'Liquidação automática de apostas: "Atualizar resultados" marca as apostas como ganhas/perdidas (e o lucro), não só as previsões.',
  'Menos "dados insuficientes" e previsões mais realistas (Poisson casa/fora). Atualizações da app deixam de recarregar a meio.',
];
