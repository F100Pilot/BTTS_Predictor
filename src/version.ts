/**
 * User-facing app version — format: 0.MAIOR.MENOR.CORREÇÃO
 *   - MAIOR     (2.x.x): grande alteração estrutural
 *   - MENOR     (x.1.x): nova funcionalidade
 *   - CORREÇÃO  (x.x.1): correção de erros
 * The leading "0." marks the app as pre-1.0. This is the single source of truth
 * for the version shown in the app (package.json keeps a 3-part semver mirror
 * for tooling, since npm requires valid semver).
 */
export const APP_VERSION = '0.2.11.0';

/** Highlights of the current version, shown in the "what's new" popup on entry. */
export const WHATS_NEW: string[] = [
  'Fontes de dados simplificadas: ficam apenas a Football-Data.org e a API-Football (mais os dados de demonstração).',
  'O SofaScore foi removido — a proteção anti-bot (Cloudflare) devolvia sempre 403. A SportMonks (paga) e a TheSportsDB (cobertura fraca) também saíram.',
  'Se vires "dados insuficientes", é a fonte a não devolver histórico suficiente das equipas (mín. 3 jogos). A API-Football costuma ter histórico mais completo.',
];
