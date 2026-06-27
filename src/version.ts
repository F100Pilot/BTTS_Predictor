/**
 * User-facing app version — format: 0.MAIOR.MENOR.CORREÇÃO
 *   - MAIOR     (2.x.x): grande alteração estrutural
 *   - MENOR     (x.1.x): nova funcionalidade
 *   - CORREÇÃO  (x.x.1): correção de erros
 * The leading "0." marks the app as pre-1.0. This is the single source of truth
 * for the version shown in the app (package.json keeps a 3-part semver mirror
 * for tooling, since npm requires valid semver).
 */
export const APP_VERSION = '0.2.29.1';

/** Highlights of the current version, shown in the "what's new" popup on entry. */
export const WHATS_NEW: string[] = [
  'v0.2.29.1: Importação do Flashscore mais robusta — a pré-visualização passa a mostrar os golos/BTTS/jogos calculados antes de preencheres (para confires que os dados foram lidos), aceita respostas embrulhadas ({data:[…]}) ou em secções, e ignora espaços nos nomes das equipas.',
  'v0.2.29: Importar do Flashscore na Calculadora — cola o link (ou o id) de um jogo e a app preenche as duas equipas e o H2H com um só pedido (RapidAPI). Define a chave RapidAPI e o Proxy CORS em Definições. Inclui botão “Trocar casa/fora”.',
  'v0.2.28: Sincronização entre dispositivos — o histórico e as apostas passam a ficar guardados no teu Worker (Cloudflare KV). Define o mesmo “código de sincronização” em Definições no PC e no telemóvel e os dados aparecem em todo o lado. (Requer criar um KV namespace uma vez — ver worker/README.)',
  'v0.2.27: Barra inferior deslizável (sem letras sobrepostas), correção do “Failed to fetch” na API-Football quando se usa o proxy {url}, e importação do FootyStats só com o link.',
  'v0.2.26: Na Calculadora podes guardar o jogo no histórico e/ou criar a aposta BTTS diretamente do resultado. Novo botão “Colar conteúdo” para importar do FootyStats no telemóvel (resolve o problema de só aparecer “preenchimento automático”).',
  'v0.2.25: Importar do FootyStats na Calculadora — cola o conteúdo da página de uma equipa e preenche automaticamente os golos, BTTS% e jogos (em casa/fora), sem CORS nem chamadas à API. Funciona no telemóvel: carrega longamente → Selecionar tudo → Copiar → colar (não precisa do código-fonte).',
  'v0.2.24: Barra de progresso no painel durante a análise em lote — mostra quantos jogos já foram analisados, quantos faltam e quantos estão em espera.',
  'v0.2.23: Melhorias internas de qualidade — constantes de previsão centralizadas, validação de tier no histórico, melhor tratamento de erros na análise (com botão de nova tentativa), e otimização de ordenação no painel.',
  'v0.2.22: Nova aba Calculadora: introduz as estatísticas das equipas manualmente e obtém um prognóstico BTTS instantâneo, sem chamadas à API. Inclui decomposição dos fatores e outros mercados (Over/Under 2.5, 1X2).',
];
