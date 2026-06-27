/**
 * User-facing app version — format: 0.MAIOR.MENOR.CORREÇÃO
 *   - MAIOR     (2.x.x): grande alteração estrutural
 *   - MENOR     (x.1.x): nova funcionalidade
 *   - CORREÇÃO  (x.x.1): correção de erros
 * The leading "0." marks the app as pre-1.0. This is the single source of truth
 * for the version shown in the app (package.json keeps a 3-part semver mirror
 * for tooling, since npm requires valid semver).
 */
export const APP_VERSION = '0.2.18.0';

/** Highlights of the current version, shown in the "what's new" popup on entry. */
export const WHATS_NEW: string[] = [
  'Filtros do painel: o "Campeonato" fica agora limitado ao "País" selecionado, e a pesquisa por jogo (equipa/competição) está na barra de pesquisa.',
  'Removidos os campos de Odds mín./máx. (não funcionavam no painel).',
  'Ao abrir um jogo passas a ter um botão "Reanalisar" que vai buscar dados novos e recalcula a previsão.',
];
