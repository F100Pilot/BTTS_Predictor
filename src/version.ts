/**
 * User-facing app version — format: 0.MAIOR.MENOR.CORREÇÃO
 *   - MAIOR     (2.x.x): grande alteração estrutural
 *   - MENOR     (x.1.x): nova funcionalidade
 *   - CORREÇÃO  (x.x.1): correção de erros
 * The leading "0." marks the app as pre-1.0. This is the single source of truth
 * for the version shown in the app (package.json keeps a 3-part semver mirror
 * for tooling, since npm requires valid semver).
 */
export const APP_VERSION = '0.2.6.0';

/** Highlights of the current version, shown in the "what's new" popup on entry. */
export const WHATS_NEW: string[] = [
  'Novo filtro "Esconder ligas amadoras/juvenis" (ligado por defeito): remove amigáveis, equipas juvenis (U17–U23), reservas e amadoras ANTES da análise — assim a análise deixa de ser bloqueada por centenas de jogos menores.',
  'Isto poupa muito a quota da API e faz a análise do dia terminar.',
];
