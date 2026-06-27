/**
 * User-facing app version — format: 0.MAIOR.MENOR.CORREÇÃO
 *   - MAIOR     (2.x.x): grande alteração estrutural
 *   - MENOR     (x.1.x): nova funcionalidade
 *   - CORREÇÃO  (x.x.1): correção de erros
 * The leading "0." marks the app as pre-1.0. This is the single source of truth
 * for the version shown in the app (package.json keeps a 3-part semver mirror
 * for tooling, since npm requires valid semver).
 */
export const APP_VERSION = '0.2.12.0';

/** Highlights of the current version, shown in the "what's new" popup on entry. */
export const WHATS_NEW: string[] = [
  'Liquidação automática de apostas: "Atualizar resultados" passa a marcar as apostas como ganhas/perdidas (e o lucro) além das previsões — fecha o ciclo previsão → aposta → resultado.',
  'Menos "dados insuficientes": corrigida a obtenção de histórico na Football-Data, deixou de gastar pedidos a dobrar, e erros temporários já não ficam gravados como "sem dados".',
  'Previsões mais realistas: o modelo passa a usar Poisson com estatísticas casa/fora (o fator mais previsível para o BTTS).',
  'Atualizações da app deixam de recarregar a meio — aparece um aviso "Nova versão" para atualizares quando quiseres.',
];
