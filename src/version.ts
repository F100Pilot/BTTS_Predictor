/**
 * User-facing app version — format: 0.MAIOR.MENOR.CORREÇÃO
 *   - MAIOR     (2.x.x): grande alteração estrutural
 *   - MENOR     (x.1.x): nova funcionalidade
 *   - CORREÇÃO  (x.x.1): correção de erros
 * The leading "0." marks the app as pre-1.0. This is the single source of truth
 * for the version shown in the app (package.json keeps a 3-part semver mirror
 * for tooling, since npm requires valid semver).
 */
export const APP_VERSION = '0.2.2.0';

/** Highlights of the current version, shown in the "what's new" popup on entry. */
export const WHATS_NEW: string[] = [
  'Jogos sem dados suficientes deixam de ser considerados — o painel passa a esconder os jogos sem histórico (filtro "Esconder jogos sem dados", ligado por defeito).',
  'Novo botão "Adicionar jogo" no Histórico → Previsões, para registar um jogo manualmente, mesmo sem aposta.',
  'Esta janela: passa a aparecer um resumo sempre que a app é atualizada.',
];
