/**
 * User-facing app version — format: 0.MAIOR.MENOR.CORREÇÃO
 *   - MAIOR     (2.x.x): grande alteração estrutural
 *   - MENOR     (x.1.x): nova funcionalidade
 *   - CORREÇÃO  (x.x.1): correção de erros
 * The leading "0." marks the app as pre-1.0. This is the single source of truth
 * for the version shown in the app (package.json keeps a 3-part semver mirror
 * for tooling, since npm requires valid semver).
 */
export const APP_VERSION = '0.2.23.0';

/** Highlights of the current version, shown in the "what's new" popup on entry. */
export const WHATS_NEW: string[] = [
  'v0.2.23: Melhorias internas de qualidade — constantes de previsão centralizadas, validação de tier no histórico, melhor tratamento de erros na análise (com botão de nova tentativa), e otimização de ordenação no painel.',
  'v0.2.22: Nova aba Calculadora: introduz as estatísticas das equipas manualmente e obtém um prognóstico BTTS instantâneo, sem chamadas à API. Inclui decomposição dos fatores e outros mercados (Over/Under 2.5, 1X2).',
];
