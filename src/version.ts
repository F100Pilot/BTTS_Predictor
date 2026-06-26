/**
 * User-facing app version — format: 0.MAIOR.MENOR.CORREÇÃO
 *   - MAIOR     (2.x.x): grande alteração estrutural
 *   - MENOR     (x.1.x): nova funcionalidade
 *   - CORREÇÃO  (x.x.1): correção de erros
 * The leading "0." marks the app as pre-1.0. This is the single source of truth
 * for the version shown in the app (package.json keeps a 3-part semver mirror
 * for tooling, since npm requires valid semver).
 */
export const APP_VERSION = '0.2.4.0';

/** Highlights of the current version, shown in the "what's new" popup on entry. */
export const WHATS_NEW: string[] = [
  'As análises de cada dia ficam guardadas: ao voltar a um dia já analisado, os jogos aparecem de imediato, sem voltar a gastar pedidos à API.',
  'Novo botão "Reanalisar" no painel, para forçar uma nova análise do dia quando quiseres.',
  'Os jogos sem dados continuam a não gastar análises, e os falhados por limite de pedidos (429) voltam a ser tentados na próxima visita.',
];
