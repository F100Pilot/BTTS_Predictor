/**
 * User-facing app version — format: 0.MAIOR.MENOR.CORREÇÃO
 *   - MAIOR     (2.x.x): grande alteração estrutural
 *   - MENOR     (x.1.x): nova funcionalidade
 *   - CORREÇÃO  (x.x.1): correção de erros
 * The leading "0." marks the app as pre-1.0. This is the single source of truth
 * for the version shown in the app (package.json keeps a 3-part semver mirror
 * for tooling, since npm requires valid semver).
 */
export const APP_VERSION = '0.2.34.1';

/** Highlights of the current version, shown in the "what's new" popup on entry. */
export const WHATS_NEW: string[] = [
  'v0.2.34.1: Página Ao Vivo passa a usar a API Football-Data (limite por minuto, não gasta a quota diária da API-Football) e deixou de depender do Flashscore. Mostra os teus jogos do histórico/apostas, associados por id ou pelo nome das equipas.',
  'v0.2.34: Removida a fonte de demonstração (dados fictícios) — a app passa a usar só fontes reais. Removida também a importação do FootyStats na Calculadora. Menu inferior do telemóvel reorganizado em grelha (2 linhas) para caber tudo no ecrã sem deslizar.',
  'v0.2.33: Correção da sincronização ao apagar — quando apagas um jogo (ou limpas o histórico/apostas), a eliminação passa a propagar-se a todos os dispositivos (tombstones) e deixa de reaparecer no refresh. A fonte de dados em uso ficou explícita no painel de Jogos e na página Ao Vivo.',
  'v0.2.32.1: Em Definições, botão “Verificar quota” para o Flashscore — mostra quantos pedidos RapidAPI te restam (lido dos cabeçalhos da resposta). Útil para dimensionar a futura análise diária via Flashscore.',
  'v0.2.32: “Via Flashscore” no Histórico passa a liquidar também jogos já terminados — vai buscar a lista de jogos por data (resultado final) dos dias dos jogos pendentes e liquida Sim/Não. A página Ao Vivo passa a mostrar também os jogos ao vivo do Flashscore que estão no teu histórico/apostas.',
  'v0.2.31: Atualizar resultados via Flashscore — no Histórico, o botão “Via Flashscore” liquida previsões e apostas a partir do feed do Flashscore. Jogos importados na Calculadora guardam o id do Flashscore (associação exata); os restantes são associados pelo nome das equipas. Jogos terminados liquidam Sim/Não; ao vivo fixam “Sim” assim que ambas marcam.',
  'v0.2.30: Importar do Flashscore passa a trazer também as odds BTTS do mercado — ao importar um jogo, os campos “Odds BTTS Sim/Não” são preenchidos com a média das casas de apostas (mercado FULL_TIME), entrando diretamente na calibração da previsão.',
  'v0.2.29.4: Limpeza da importação do FootyStats — removida a opção de “colar só o link” (busca por URL), que era bloqueada pelo site. Fica só o “Colar conteúdo” (texto da página), mais fiável.',
  'v0.2.29.3: Correção da importação do Flashscore — passa a ler os resultados no formato novo da API (campo “scores” no topo e estado nulo). As estatísticas das equipas voltam a preencher (ex.: Croácia, Gana).',
  'v0.2.29.2: Importação do Flashscore — nova caixa “Resposta da API (debug)” com botão “Copiar resposta”, para quando as estatísticas vierem a 0 poderes partilhar o JSON real e alinharmos a leitura ao formato desse jogo.',
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
