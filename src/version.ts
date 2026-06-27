/**
 * User-facing app version — format: 0.MAIOR.MENOR.CORREÇÃO
 *   - MAIOR     (2.x.x): grande alteração estrutural
 *   - MENOR     (x.1.x): nova funcionalidade
 *   - CORREÇÃO  (x.x.1): correção de erros
 * The leading "0." marks the app as pre-1.0. This is the single source of truth
 * for the version shown in the app (package.json keeps a 3-part semver mirror
 * for tooling, since npm requires valid semver).
 */
export const APP_VERSION = '0.2.27.2';

/** Highlights of the current version, shown in the "what's new" popup on entry. */
export const WHATS_NEW: string[] = [
  'v0.2.27: Importar do FootyStats só com o link — cola o URL da equipa e a app vai buscar a página pelo teu Proxy CORS e preenche tudo. Ideal para telemóvel (sem copiar o conteúdo todo).',
  'v0.2.26: Na Calculadora podes guardar o jogo no histórico e/ou criar a aposta BTTS diretamente do resultado. Novo botão “Colar conteúdo” para importar do FootyStats no telemóvel (resolve o problema de só aparecer “preenchimento automático”).',
  'v0.2.25: Importar do FootyStats na Calculadora — cola o conteúdo da página de uma equipa e preenche automaticamente os golos, BTTS% e jogos (em casa/fora), sem CORS nem chamadas à API. Funciona no telemóvel: carrega longamente → Selecionar tudo → Copiar → colar (não precisa do código-fonte).',
  'v0.2.24: Barra de progresso no painel durante a análise em lote — mostra quantos jogos já foram analisados, quantos faltam e quantos estão em espera.',
  'v0.2.23: Melhorias internas de qualidade — constantes de previsão centralizadas, validação de tier no histórico, melhor tratamento de erros na análise (com botão de nova tentativa), e otimização de ordenação no painel.',
  'v0.2.22: Nova aba Calculadora: introduz as estatísticas das equipas manualmente e obtém um prognóstico BTTS instantâneo, sem chamadas à API. Inclui decomposição dos fatores e outros mercados (Over/Under 2.5, 1X2).',
];
