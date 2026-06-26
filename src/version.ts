/**
 * User-facing app version — format: 0.MAIOR.MENOR.CORREÇÃO
 *   - MAIOR     (2.x.x): grande alteração estrutural
 *   - MENOR     (x.1.x): nova funcionalidade
 *   - CORREÇÃO  (x.x.1): correção de erros
 * The leading "0." marks the app as pre-1.0. This is the single source of truth
 * for the version shown in the app (package.json keeps a 3-part semver mirror
 * for tooling, since npm requires valid semver).
 */
export const APP_VERSION = '0.2.7.0';

/** Highlights of the current version, shown in the "what's new" popup on entry. */
export const WHATS_NEW: string[] = [
  'Análise por lotes: em dias com muitos jogos, a app já não analisa tudo de uma vez (esgotava a quota da API). Analisa os próximos 20 a começar, ordenados por hora de início.',
  'Botão "Analisar mais 20" no painel para continuar quando quiseres — os jogos já analisados ficam guardados e não gastam pedidos.',
  'Podes mudar o tamanho do lote em Definições → "Jogos analisados por lote" (0 = analisar todos).',
];
