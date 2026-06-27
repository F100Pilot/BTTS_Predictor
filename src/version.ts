/**
 * User-facing app version — format: 0.MAIOR.MENOR.CORREÇÃO
 *   - MAIOR     (2.x.x): grande alteração estrutural
 *   - MENOR     (x.1.x): nova funcionalidade
 *   - CORREÇÃO  (x.x.1): correção de erros
 * The leading "0." marks the app as pre-1.0. This is the single source of truth
 * for the version shown in the app (package.json keeps a 3-part semver mirror
 * for tooling, since npm requires valid semver).
 */
export const APP_VERSION = '0.2.21.0';

/** Highlights of the current version, shown in the "what's new" popup on entry. */
export const WHATS_NEW: string[] = [
  'Os filtros do painel ficam guardados quando abres um jogo e voltas — data, campeonato, país e pesquisa mantêm-se.',
  'Melhoria da API-Football: quando o histórico recente é insuficiente (ex.: seleções no início de um torneio), a análise usa automaticamente as estatísticas da época atual para produzir uma previsão em vez de mostrar "dados insuficientes".',
];
