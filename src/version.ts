/**
 * User-facing app version — format: 0.MAIOR.MENOR.CORREÇÃO
 *   - MAIOR     (2.x.x): grande alteração estrutural
 *   - MENOR     (x.1.x): nova funcionalidade
 *   - CORREÇÃO  (x.x.1): correção de erros
 * The leading "0." marks the app as pre-1.0. This is the single source of truth
 * for the version shown in the app (package.json keeps a 3-part semver mirror
 * for tooling, since npm requires valid semver).
 */
export const APP_VERSION = '0.2.10.0';

/** Highlights of the current version, shown in the "what's new" popup on entry. */
export const WHATS_NEW: string[] = [
  'Nova fonte de dados experimental: SofaScore (sem chave de API). Seleciona-a em Definições → Fonte de dados.',
  'Aviso: o SofaScore tem proteção anti-bot (Cloudflare) e pode responder 403 — pode simplesmente não funcionar. Precisa do mesmo proxy CORS (Worker) já configurado, que foi atualizado para encaminhar os pedidos do SofaScore.',
  'Alternativa recomendada e estável: Football-Data.org (grátis, cobre as grandes ligas, limite por minuto em vez de por dia).',
];
