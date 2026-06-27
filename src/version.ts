/**
 * User-facing app version — format: 0.MAIOR.MENOR.CORREÇÃO
 *   - MAIOR     (2.x.x): grande alteração estrutural
 *   - MENOR     (x.1.x): nova funcionalidade
 *   - CORREÇÃO  (x.x.1): correção de erros
 * The leading "0." marks the app as pre-1.0. This is the single source of truth
 * for the version shown in the app (package.json keeps a 3-part semver mirror
 * for tooling, since npm requires valid semver).
 */
export const APP_VERSION = '0.2.9.0';

/** Highlights of the current version, shown in the "what's new" popup on entry. */
export const WHATS_NEW: string[] = [
  'Limite de análise removido: por defeito a app passa a analisar TODOS os jogos que passam pelos filtros (já não para nos primeiros 20).',
  'Se quiseres voltar a limitar para poupar pedidos à API, define um valor em Definições → "Jogos analisados por lote" (0 = todos).',
  'Lembrete: o contador "Pedidos restantes" depende da fonte de dados. No plano grátis da API-Football são 100 pedidos por DIA (reiniciam à meia-noite). Com tantos jogos, esgota depressa.',
];
