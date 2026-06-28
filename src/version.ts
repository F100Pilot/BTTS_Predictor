/**
 * User-facing app version — format: 0.MAIOR.MENOR.CORREÇÃO
 *   - MAIOR     (2.x.x): grande alteração estrutural
 *   - MENOR     (x.1.x): nova funcionalidade
 *   - CORREÇÃO  (x.x.1): correção de erros
 * The leading "0." marks the app as pre-1.0. This is the single source of truth
 * for the version shown in the app (package.json keeps a 3-part semver mirror
 * for tooling, since npm requires valid semver).
 */
export const APP_VERSION = '0.2.37.2';

/** Highlights of the current version, shown in the "what's new" popup on entry. */
export const WHATS_NEW: string[] = [
  'v0.2.37.2: Na página Ao Vivo, cada jogo passa a mostrar a hora de início e o tempo decorrido (minuto da partida). Quando o feed do Flashscore não traz o minuto exato, é estimado a partir da hora de início (marcado com “~”).',
  'v0.2.37.1: Na página de Jogos, os jogos que já guardaste no histórico ficam marcados com um “check” verde (ao lado do nome e no botão), mesmo depois de recarregar a app — para veres num relance quais já adicionaste.',
  'v0.2.37: Removidas as fontes Football-Data e API-Football — o Flashscore (RapidAPI) passa a ser a única fonte para tudo: jogos do dia, análise, página Ao Vivo e resultados. Em Definições já não há seletor de fonte; basta a chave RapidAPI + Proxy CORS. Quem estava noutra fonte é migrado automaticamente para o Flashscore. O painel de Jogos analisa a jornada automaticamente (~1 pedido por jogo).',
  'v0.2.36.1: O aviso de “Novidades” passa a mostrar só as atualizações que este dispositivo ainda não viu (as mais recentes do que a última versão aberta aqui), em vez da lista completa de todas as versões.',
  'v0.2.36: Nova fonte de dados Flashscore (RapidAPI), agora a fonte recomendada e por omissão. Faz a análise diária quase só com o Flashscore — a lista de jogos do dia (1 pedido) e, por jogo, a forma das duas equipas + H2H num só pedido. Com ~1000 pedidos/dia cobres uma jornada inteira. Em Definições, escolhe “Flashscore (RapidAPI)” como fornecedor e usa a chave RapidAPI já existente (a Football-Data e a API-Football continuam disponíveis como alternativa).',
  'v0.2.35.1: Mais testes internos (pipeline de análise e cadeia de fontes de dados) — sem alterações visíveis; só robustez. Total 115 testes.',
  'v0.2.35: Melhorias da auditoria — app mais leve no telemóvel (instalação ~1,4 MB menor), página Ao Vivo poupa quota (pausa quando o separador está oculto), limpeza automática de marcas de eliminação antigas, botão “Gerar” código de sincronização seguro, aviso ao exportar o perfil (contém chaves), e mais testes internos.',
  'v0.2.34.3: Ao Vivo volta a combinar Football-Data + Flashscore. O plano grátis da Football-Data só cobre as grandes ligas, por isso os jogos importados do Flashscore (ligas menores) só aparecem ao vivo via Flashscore. Agora usam-se as duas fontes em simultâneo.',
  'v0.2.34.2: Nova chave “Football-Data — resultados ao vivo” em Definições (visível quando a análise usa outra fonte), para o Ao Vivo funcionar com qualquer fonte de análise. Barra inferior do telemóvel voltou à deslocação horizontal.',
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

/** Parse a "0.2.36" / "v0.2.35.1" version string into numeric segments. */
export function parseVersion(v: string): number[] {
  return v
    .replace(/^v/, '')
    .split('.')
    .map((n) => Number.parseInt(n, 10) || 0);
}

/** Compare two version strings segment-by-segment. <0 if a<b, 0 if equal, >0 if a>b. */
export function compareVersions(a: string, b: string): number {
  const pa = parseVersion(a);
  const pb = parseVersion(b);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

/** Extract the leading version from a WHATS_NEW entry ("v0.2.36: …" → "0.2.36"). */
function entryVersion(entry: string): string {
  return entry.match(/^v([\d.]+):/)?.[1] ?? '0';
}

/**
 * The WHATS_NEW entries newer than the version the device last saw — i.e. only
 * the updates this device doesn't yet know about. When `seen` is null (first
 * launch ever) only the latest entry is shown, not the whole changelog.
 */
export function whatsNewSince(seen: string | null): string[] {
  if (!seen) return WHATS_NEW.slice(0, 1);
  return WHATS_NEW.filter((entry) => compareVersions(entryVersion(entry), seen) > 0);
}
