# Changelog

Registo das versões do **BTTS Analytics Pro**.

## Esquema de versões (`0.MAIOR.MENOR.CORREÇÃO`)

A versão está em [`src/version.ts`](src/version.ts) e é mostrada na app em
**Definições** (rodapé). Começa sempre por `0.` (pré-1.0). A regra de incremento:

| Posição      | Exemplo     | Quando incrementar                              |
| ------------ | ----------- | ----------------------------------------------- |
| **MAIOR**    | 0.**2**.1.1 | Grande alteração estrutural (arquitetura/dados) |
| **MENOR**    | 0.2.**1**.1 | Nova funcionalidade                             |
| **CORREÇÃO** | 0.2.1.**1** | Correção de erros / ajustes pequenos            |

> Ao subir um nível, os níveis à direita voltam a `0`
> (ex.: nova funcionalidade sobre a `0.2.1.3` → `0.2.2.0`).

Sempre que mudar a versão em `src/version.ts`, acrescente uma entrada abaixo.

---

## 0.3.0.2

- **Fix**: no Histórico, em O/U 2.5 e 1X2, registos **sem** os mercados Poisson
  guardados (analisados antes do mercado existir) deixam de mostrar um resultado
  derivado do score no "Resultado real" — aparecem "—". O resultado/score do
  mercado só é mostrado quando existe prognóstico (`recordPick` não nulo), em
  linha com a card de desempenho (que já só conta jogos com `markets`).

## 0.3.0.1

- **Fix**: no Histórico, a **lista de jogos** passa a acompanhar o mercado
  selecionado. Antes a tabela mostrava sempre o prognóstico/resultado de BTTS
  mesmo com O/U 2.5 ou 1X2 escolhidos. Agora a coluna, o prognóstico (lado + %),
  a classificação e o "resultado real" refletem o mercado ativo (via `recordPick`
  + `marketActualSide`). Para O/U e 1X2 a liquidação continua a derivar do score.

## 0.3.0.0

- **Removidas as abas "Favoritos" e "Watchlist"** — navegação simplificada
  (Jogos, Ao Vivo, Martingale, Histórico, Calculadora, Definições). Removidas as
  rotas `/favorites` e `/watchlist`, as páginas correspondentes e os botões de
  favorito/watchlist nos banners de jogo e na análise. O `collectionsStore` e os
  hooks de notificação mantêm-se intactos (sem quebrar nada); o filtro "Liga
  favorita" (conceito distinto) também se mantém.

## 0.2.50.0

- **Desempenho por mercado no Histórico** (Fase 2): a card "Desempenho do modelo"
  ganhou um `MarketSelector`. BTTS mantém a vista detalhada (tabela por tier +
  curva + auto-calibração); Over/Under 2.5 e 1X2 mostram uma vista própria
  (`MarketPerformance`): acerto, Brier, gráfico de acerto por faixa e curva de
  fiabilidade (previsto vs acerto). Mercados nunca misturados.
- Para liquidar Over/Under e 1X2 deriva-se o resultado do **score** introduzido
  (`marketPickCorrect`); por isso `HistoryRecord` passa a guardar os mercados
  Poisson e o `AnalysisPage`/`GamesTable` gravam-nos.
- Novas funções puras genéricas em `core/backtest`: `evaluateOutcomes`,
  `confidenceBandsOutcomes`, `reliabilityOutcomes` (+ testes). O pop-up "Acerto
  por faixa" passou a ser sensível ao mercado.

## 0.2.49.0

- **Seletor de mercado na página de Jogos** (Fase 1): BTTS / Mais-Menos 2.5 /
  1X2. O banner de cada jogo mostra o prognóstico do mercado escolhido (lado +
  % + classificação) e a lista é reordenada por esse mercado. Mercados não são
  misturados.
- Novos: `core/markets/markets.ts` (`marketPick`, `marketActualSide`,
  `marketPickCorrect` + testes), `store/marketStore.ts` (seleção partilhada),
  `components/common/MarketSelector.tsx`. A cache do dia passa a guardar os
  mercados Poisson (`SavedPrediction`); `MODEL_VERSION` → `m4`.
- _Fase 2 (a seguir): gráficos de acerto por mercado no Histórico._

## 0.2.48.4

- **Cartão "Valor vs mercado" mais claro** (`ValueCard`): cada lado mostra
  "Valor +X%" (verde) ou "Sem valor (−X%)" em texto, a probabilidade do modelo e
  a **odd justa** (`1/prob`, a odd mínima para ter valor). Descrição reescrita em
  linguagem simples.

## 0.2.48.3

- **Classificação coerente com a % mostrada**: `tierForProbability` passa a
  classificar sobre a percentagem **arredondada** (a mesma que aparece no ecrã),
  eliminando casos como "60% mas Fraca" (a prob. real era ~0.596). `MODEL_VERSION`
  → `m3` para recalcular previsões em cache. Novo teste de classificação.

## 0.2.48.2

- **Curva de fiabilidade com contagem de jogos**: cada ponto da linha "Real"
  mostra um rótulo `Nj` (nº de jogos da faixa) e o tooltip passa a incluir
  "… · N jogo(s)". Deixa claro que pontos têm poucos dados (e por isso picos
  enganadores, como 100% com 1 jogo).

## 0.2.48.1

- **Banner de jogo reorganizado (mobile-first)** em `GamesTable`: passou de uma
  linha horizontal (hora · nome · pill · ações) para um cartão vertical — hora +
  competição em cima, **nome das duas equipas em largura total** (sem corte), e
  prognóstico + classificação + confiança + ações em baixo. Resolve os nomes
  truncados no telemóvel.

## 0.2.48.0

- **"Acerto por faixa"** no Histórico (Previsões): pop-up (`Dialog`) com um
  gráfico de barras horizontal (Recharts) da taxa de acerto das previsões
  liquidadas, agrupada pela percentagem mostrada (lado dominante, 50–100%).
- Nova função pura `accuracyByConfidence` em `core/backtest` (bandas de 10%,
  topo fechado em 100%), coberta por teste. `isCorrect` passou a exportada.

## 0.2.47.0

- **Liquidação por resultado (score)** no Histórico e nas Apostas: novo
  `ScoreInput` (golos casa–fora) que deriva o BTTS via `bttsFromGoals` e
  liquida automaticamente — no histórico grava o resultado + score
  (`setHistoryResult`), nas apostas calcula ganha/perdida com
  `settleBetAgainstBtts` e grava (`setResult` com o score).
- `Bet` ganhou um campo opcional `score`; o `setResult` do store passa a
  aceitar/limpar o score. As apostas mostram o score ao lado do resultado e
  têm um botão para limpar (volta a pendente). Os botões rápidos BTTS SIM/NÃO
  mantêm-se no histórico.

## 0.2.46.0

Melhorias ao modelo de previsão (sugeridas numa revisão externa), aplicadas só
ao cálculo — as estatísticas mostradas continuam a ser as reais.

- **Ponderação por recência (time-decay)**: cada jogo é pesado por
  `0.5^(idade/meia-vida)` com meia-vida de `FORM_HALF_LIFE_DAYS = 180` dias, nas
  janelas de forma e no H2H (`HeadToHead.bttsPctWeighted`). Jogos recentes pesam
  mais que os antigos.
- **Empirical-Bayes shrinkage**: as taxas/médias de cada equipa são "encolhidas"
  para os priors da liga (`LEAGUE_PRIORS`) com força `PRIOR_STRENGTH = 4`
  pseudo-jogos — `(n·obs + k·prior)/(n+k)`. Amostras pequenas (início de época,
  seleções) deixam de gerar previsões exageradas.
- Implementado em `computeTeamStats`/`computeHeadToHead` (novo bundle `adjusted`
  em `TeamStats`, sem mexer nas janelas em bruto); o motor (`engine.ts`) lê o
  `adjusted` quando existe. `predictionSignature` ganhou um token de versão de
  modelo (`m2`) para recalcular previsões em cache.

## 0.2.45.0

- **Liquidação automática no Ao Vivo**: durante a atualização (cada 10 min) a
  página Ao Vivo passa a liquidar os jogos seguidos — quando um jogo do histórico
  ou das apostas atinge o resultado BTTS (ambas marcam, que tranca o "sim"
  antecipado), grava o resultado via `setHistoryResult` / `setResult` (apostas) e
  remove-o da vista. Só ficam à vista os jogos ainda por decidir
  (`flashOutcome(f) == null`).
- Após liquidar, o mapa de prognósticos e as estatísticas de calibração são
  atualizados de imediato (`refreshCalibration`).

## 0.2.44.1

- **Reanalisar pede confirmação**: o botão "Reanalisar" (na lista de Jogos e na
  análise de um jogo) passa a abrir um pop-up (`ConfirmDialog`) a avisar que vai
  descartar a análise guardada e consumir novos pedidos à API, evitando
  reanálises acidentais.
- Novo componente reutilizável `src/components/common/ConfirmDialog.tsx`.

## 0.2.44.0

- **Martingale associado ao jogo**: na página de análise, o botão "Martingale"
  passa a abrir um pop-up (`MartingaleDialog`) em vez de navegar para a aba.
  No pop-up escolhe-se a seleção BTTS (SIM/NÃO), a odd (pré-preenchida com a do
  jogo) e vê-se a stake sugerida para o step atual da série, registando a aposta
  via `addBet` sem sair do jogo. Inclui informação da série ativa (step, perda
  acumulada, banca), aviso de step máximo e atalho "Abrir Martingale completo".
- O pop-up carrega as apostas do IndexedDB (`refresh`) na primeira abertura, para
  o step/perda da série estarem corretos mesmo sem ter visitado a aba Martingale.

## 0.2.43.0

- **Otimização automática dos pesos**: com a auto-calibração ligada e ~20+ jogos
  com resultado real, os pesos do modelo (Forma, BTTS, …) são reotimizados pelos
  resultados ao abrir a app (`maybeAutoTuneWeights`), guardando os pesos
  anteriores.
- **Sliders dos pesos** mostram o valor **atual a verde** e o **anterior à última
  otimização a vermelho** (tracejado quando coincide). `applyWeights` regista o
  conjunto anterior; "Repor pesos" limpa o marcador.

## 0.2.42.1

- **Ao Vivo**: atualização automática passa de 60s para **10 minutos**.
- **Popup da auto-calibração**: passa a indicar o **item afetado** — a
  "Probabilidade final de BTTS SIM" (calibração global; não mexe nos pesos).

## 0.2.42.0

- **Aviso de auto-calibração**: sempre que a calibração automática muda (novos
  resultados reais reajustam o Platt), surge um pop-up a explicar o que mudou —
  exemplos do efeito numa previsão (ex.: 70% → 64%) e uma justificação simples
  (modelo a sobrestimar/subestimar o BTTS). Guarda a calibração mostrada e só
  reaparece quando volta a mudar (`CalibrationNoticeDialog`).

## 0.2.41.0

- **Página Ao Vivo redesenhada** no mesmo estilo da Jogos: cada jogo num
  **banner** com emblema (iniciais) das equipas, resultado ao vivo, **barra de
  forma** (últimos 5 resultados de cada equipa), **prognóstico BTTS com %** e
  estado "ambas marcaram". Opções num pop-up de ícones + atalho para Definições.
  A forma é obtida do pedido por jogo já em cache (sem novos pedidos no caso
  comum).
- **Jogos**: botão de **Definições** alinhado à direita do título.

## 0.2.40.0

- **Redesign da página de Jogos** (minimalista): cada jogo passa a ser um
  **banner** (hora, competição, equipas, selo BTTS e classificação) que abre a
  análise ao toque.
- **Opções da página num pop-up discreto** — controlos só com **ícones** (sem
  texto); o nome aparece ao passar o rato (desktop) ou ao **manter premido**
  (toque). Inclui Filtros, Reanalisar, Analisar mais, exportações (CSV/Excel/PDF)
  e os atalhos "Só grandes ligas" / "Esconder começados".
- As ações por jogo (favorito, watchlist, histórico) seguem o mesmo padrão
  icon-only com rótulo ao passar/premir. Novo componente `IconAction`.

## 0.2.39.1

- **Ao Vivo poupa pedidos RapidAPI**: o feed do Flashscore só é consultado quando
  existe um jogo acompanhado (não liquidado) dentro da janela de jogo (de ~10 min
  antes do início até ao full-time). Sem nada a decorrer → zero pedidos. Intervalo
  de atualização 30s → 60s.

## 0.2.39.0

- **Histórico → Apostas**: clicar numa aposta abre a análise do jogo (quando tem
  id de jogo Flashscore); nova coluna "Início do jogo" a par de "Aposta feita". As
  apostas passam a guardar a hora de início (da análise → martingale); apostas
  antigas usam a data da previsão correspondente.

## 0.2.38.2

- **Ao Vivo** deixa de mostrar jogos já terminados que o feed ainda marca como
  "em jogo" (lag em ligas menores): sem minuto real e com início há mais de 130
  min, o jogo sai do Ao Vivo (liquida no Histórico).

## 0.2.38.1

- **Sincronização mais poupada no Cloudflare KV**: escreve só quando os dados
  mudam mesmo (antes reescrevia os 3 blobs a cada sync) e o intervalo passou para
  5 min. Resolve o aviso de "limite diário do Workers KV" sem upgrade.

## 0.2.38.0

- **Histórico (Previsões)** agrupado por dia, com colapsar/expandir por dia e
  botão "Expandir/Colapsar tudo". Atualização de resultados unificada num só botão
  "Atualizar resultados" (via Flashscore), removido o botão duplicado.

## 0.2.37.4

- Na página de Jogos, o "check" de jogo-no-histórico aparece só uma vez (no botão
  da coluna Ações); removida a marca duplicada ao lado do nome.

## 0.2.37.3

- "Testar ligação" corrigido para o Flashscore: verifica a forma das equipas pelo
  pedido por jogo (h2h), como a análise faz, em vez do histórico por equipa (que o
  Flashscore não usa). Deixa de dar falso erro com a chave correta.

## 0.2.37.2

- **Ao Vivo** mostra a hora de início e o tempo decorrido (minuto). Quando o feed
  não traz o minuto exato, é estimado a partir da hora de início (marcado "~").

## 0.2.37.1

- Na página de Jogos, os jogos já no histórico ficam marcados com um "check"
  verde, persistente após recarregar.

## 0.2.37.0

- **Removidas as fontes Football-Data e API-Football** — o **Flashscore
  (RapidAPI)** passa a ser a única fonte para tudo: jogos, análise, Ao Vivo e
  resultados. Removido o seletor de fonte (basta a chave RapidAPI + Proxy CORS);
  migração automática de quem estava noutra fonte. O painel de Jogos analisa a
  jornada automaticamente (~1 pedido por jogo).

## 0.2.36.1

- O aviso de "Novidades" mostra só as atualizações que o dispositivo ainda não
  viu, em vez da lista completa.

## 0.2.36.0

- **Nova fonte Flashscore (RapidAPI)**, recomendada e por omissão: análise diária
  quase só com o Flashscore — lista de jogos do dia (1 pedido) e, por jogo, a
  forma das duas equipas + H2H num só pedido. (Football-Data e API-Football ainda
  selecionáveis nesta versão.)

## 0.2.35.1

- Mais testes internos (pipeline de análise e cadeia de fontes). Total 115 testes.

## 0.2.35.0

- Melhorias da auditoria: instalação mais leve (~1,4 MB menos), Ao Vivo pausa
  quando o separador está oculto, limpeza automática de tombstones antigas, botão
  "Gerar" código de sincronização seguro, aviso ao exportar o perfil (contém
  chaves) e mais testes.

## 0.2.34.3

- Ao Vivo volta a combinar Football-Data + Flashscore (o grátis da Football-Data
  só cobre as grandes ligas; jogos de ligas menores aparecem via Flashscore).

## 0.2.34.2

- Nova chave "Football-Data — resultados ao vivo" em Definições. Barra inferior do
  telemóvel voltou à deslocação horizontal.

## 0.2.34.1

- Página Ao Vivo passa a usar a Football-Data (limite por minuto) e deixa de
  depender do Flashscore. Mostra os jogos do histórico/apostas por id ou nome.

## 0.2.34.0

- Removida a fonte de demonstração (dados fictícios) — só fontes reais. Removida a
  importação do FootyStats na Calculadora. Menu inferior reorganizado em grelha.

## 0.2.33.0

- Correção da sincronização ao apagar: as eliminações propagam-se a todos os
  dispositivos (tombstones) e deixam de reaparecer no refresh. Fonte de dados em
  uso ficou explícita no painel de Jogos e no Ao Vivo.

## 0.2.32.1

- Botão "Verificar quota" para o Flashscore em Definições (lê os pedidos RapidAPI
  restantes dos cabeçalhos da resposta).

## 0.2.32.0

- "Via Flashscore" no Histórico liquida também jogos já terminados (lista por
  data). Ao Vivo mostra também os jogos ao vivo do Flashscore do histórico/apostas.

## 0.2.31.0

- Atualizar resultados via Flashscore: o botão "Via Flashscore" liquida previsões
  e apostas a partir do feed do Flashscore (por id do Flashscore, ou nome).

## 0.2.30.0

- Importar do Flashscore traz também as odds BTTS do mercado (média das casas),
  preenchendo "Odds BTTS Sim/Não" e entrando na calibração.

## 0.2.29.4

- Importação do FootyStats: removida a busca por URL (bloqueada pelo site); fica
  só "Colar conteúdo".

## 0.2.29.3

- Correção da importação do Flashscore para o formato novo da API (campo "scores"
  no topo e estado nulo).

## 0.2.29.2

- Importação do Flashscore: caixa "Resposta da API (debug)" com "Copiar resposta"
  para alinhar a leitura ao formato real.

## 0.2.29.1

- Importação do Flashscore mais robusta: pré-visualização dos golos/BTTS/jogos,
  aceita respostas embrulhadas/em secções e ignora espaços nos nomes.

## 0.2.29.0

- Importar do Flashscore na Calculadora: colar o link (ou id) de um jogo preenche
  as duas equipas e o H2H num só pedido (RapidAPI). Botão "Trocar casa/fora".

## 0.2.28.0

- Sincronização entre dispositivos: histórico e apostas guardados no Worker
  (Cloudflare KV), partilhados por um "código de sincronização".

## 0.2.27.0

- Barra inferior deslizável (sem sobreposição), correção do "Failed to fetch" na
  API-Football com proxy `{url}`, e importação do FootyStats por link.

## 0.2.26.0

- Na Calculadora: guardar o jogo no histórico e/ou criar a aposta BTTS a partir do
  resultado. Botão "Colar conteúdo" para importar do FootyStats no telemóvel.

## 0.2.25.0

- Importar do FootyStats na Calculadora: colar o conteúdo da página preenche
  golos, BTTS% e jogos (casa/fora), sem CORS nem API.

## 0.2.24.0

- Barra de progresso no painel durante a análise em lote.

## 0.2.23.0

- Melhorias internas de qualidade: constantes de previsão centralizadas, validação
  de tier no histórico, melhor tratamento de erros na análise (com nova tentativa)
  e otimização de ordenação no painel.

## 0.2.22.0

- **Calculadora manual**: nova aba que permite introduzir as estatísticas das
  equipas (médias de golos, BTTS%, jogos disputados) e calcular um prognóstico
  BTTS sem qualquer chamada à API. Inclui secção opcional para confrontos diretos
  (H2H) e para calibração com as odds da casa de apostas. Resultados em tempo
  real: veredicto BTTS, barra de probabilidade, confiança, decomposição dos
  fatores e mercados Poisson (Over/Under 2.5, 1X2).

## 0.2.21.0

- **API-Football: estatísticas da época** (`/teams/statistics`) usadas como
  alternativa quando o histórico recente é insuficiente (< 3 jogos). Afeta
  principalmente seleções no início de torneios (Mundial, Europeu): em vez de
  mostrar "dados insuficientes", o motor usa as médias da época atual — golos
  marcados/sofridos por jogo em casa e fora — para calcular uma previsão real.
- O motor de previsão passa a considerar "suficiente" qualquer equipa com ≥ 3
  jogos recentes **ou** com estatísticas da época disponíveis. O aviso
  "insuficiente" aparece apenas quando nenhum dos dois conjuntos de dados
  está disponível.
- Na página de análise, uma nota discreta informa quando a previsão foi
  complementada com dados da época.

## 0.2.20.0

- Os filtros do painel (data, campeonato, país, pesquisa, etc.) ficam
  **guardados em memória** durante a sessão. Abrir um jogo e voltar com o
  botão "Voltar" (ou o botão nativo do browser) repõe os filtros exatamente
  como estavam — não é preciso voltar a selecionar tudo.

## 0.2.19.0

- Jogos com **dados insuficientes** (menos de 3 jogos de histórico por equipa)
  passam a ser **sempre escondidos** do painel, em qualquer modo (antes só com
  "Mostrar só jogos analisados"). O `hideNoData` passa a controlar apenas os
  jogos ainda não analisados.
- A página de análise guarda a previsão no cache do dia **mesmo quando é
  insuficiente**, para que o painel a esconda e **não a volte a analisar**
  (poupa pedidos — relevante no modo manual da API-Football).

## 0.2.18.0

- Filtros do painel: o **Campeonato** passa a estar **limitado ao País** escolhido
  (lista filtrada por país; mudar de país repõe o campeonato). Pesquisa por jogo
  continua na barra (equipa/competição), com placeholder mais claro.
- **Removidos os campos Odds mín./máx.** (e a lógica associada) — não funcionavam
  no painel porque as odds não são obtidas na listagem.
- Página de análise: novo botão **"Reanalisar"** que limpa o histórico em cache
  das duas equipas e recalcula a previsão com dados frescos.

## 0.2.17.0

- **Modo manual para API-Football**: quando a fonte ativa é a API-Football, o
  painel lista **todos** os jogos do dia (todas as competições) **sem analisar**,
  para poupar a quota diária. O utilizador pesquisa e clica num jogo para o
  analisar individualmente; a previsão fica guardada no cache do dia
  (`saveDayPrediction` na página de análise) e reaparece na tabela.
  - Esconde a UI de lotes ("Analisar mais"/"Reanalisar") e mostra jogos não
    analisados (ignora "Mostrar só jogos analisados") neste modo.
- Football-Data.org mantém o comportamento automático (sem alterações).

## 0.2.16.0 — correção de resultados trocados

- **Bug corrigido:** os resultados podiam vir da fonte errada. Os IDs de jogo são
  **específicos de cada fornecedor**, por isso liquidar um jogo guardado numa
  fonte usando outra fonte ia buscar um **jogo diferente** (score trocado, ex.:
  2-1 num jogo que acabou 0-0).
- Cada `HistoryRecord` e `Bet` passa a guardar o `providerId` que o criou. O
  "Atualizar resultados" só liquida jogos da **fonte ativa**; jogos de outra
  fonte (ou antigos sem fonte) são ignorados e reportados na mensagem.
- Limpar o resultado de uma previsão também limpa o score guardado.

## 0.2.15.0

- Painel: a coluna BTTS mostra agora o **lado dominante com etiqueta** (ex.:
  "NÃO 68%") em vez da probabilidade de SIM crua ("32%"), eliminando a ambiguidade.
- Histórico: **apagar jogos individualmente** (botão por linha) e nova coluna
  **Score** com o resultado final, guardado ao liquidar via "Atualizar
  resultados" (`actualScore` em `HistoryRecord`; `removeHistory` no repositório).

## 0.2.14.1

- Definições → Fonte de Dados: nota a explicar **qual fornecedor usar** em cada
  altura (API-Football para seleções/Mundial, Football-Data.org para clubes) e
  porque deve usar-se **uma fonte de cada vez** (IDs de equipa são por-fornecedor,
  por isso jogos e histórico têm de vir da mesma fonte — um esquema híbrido
  "jogos numa fonte, histórico noutra" trocaria equipas).

## 0.2.14.0

- Painel: jogos **já começados/terminados** deixam de aparecer e de ser
  analisados (não faz sentido prever um jogo a decorrer e gastava quota). Nova
  definição/filtro **"Esconder jogos já começados"** (ligado por defeito,
  `hideStarted`); o estado vazio oferece um botão para os voltar a mostrar.

## 0.2.13.0

- Painel: novo botão de ação **"Adicionar ao histórico"** (ícone +) em cada
  jogo analisado, para guardar no Histórico sem abrir a análise. Mostra ✓ depois
  de adicionado; desativado enquanto o jogo não tem previsão.

## 0.2.12.0 — correções da auditoria

**Ciclo de apostas (o que faltava para a app servir):**

- "Atualizar resultados" passa a **liquidar automaticamente as apostas**
  (ganha/perdida + lucro) por `fixtureId`, além das previsões, e marca também
  BTTS "NÃO" em jogos terminados. Lógica pura testada em `settlementService`.
- O Histórico lê as apostas do `martingaleStore` (uma só fonte de verdade), por
  isso as liquidações ficam sincronizadas entre páginas; botão "Atualizar
  resultados" também no separador Apostas.

**Camada de dados (menos "dados insuficientes"):**

- Football-Data: removido o filtro `status=FINISHED` (rejeitado no plano grátis),
  passa a sobre-obter e filtrar os terminados no cliente.
- H2H calculado localmente a partir do histórico já obtido → **1 pedido a menos
  por jogo** e fim do duplo fetch da equipa da casa.
- Resultados vazios/erros temporários **deixam de ser gravados em cache** como
  "sem dados" (histórico de equipas e H2H).

**Motor de previsão:**

- `formScore` agora é **Poisson casa/fora** (ataque em casa vs defesa fora, com
  vantagem de casa), o split mais previsível para BTTS, com recurso à forma
  recente quando há poucos jogos casa/fora.
- Guarda de insuficiência consistente (`< 3 jogos` em todos os fatores).
- Calibração protegida: previsões já liquidadas deixam de ser reescritas; jogos
  "insuficientes" não entram no histórico/estatísticas.

**Fiabilidade e segurança:**

- PWA: a atualização passa a **avisar** ("Nova versão") em vez de recarregar a
  meio da sessão. Removida a runtimeCaching de API obsoleta.
- Worker CORS: deixou de ser um **proxy aberto** — só encaminha caminhos
  `/v4/...` da Football-Data e só responde à origem da app; rota `/sofa` morta
  removida.
- Dashboard: a atualização da calibração já não apaga/recarrega a lista do dia.

## 0.2.11.1

- O aviso de "dados insuficientes" (página de análise) passa a indicar o número
  de jogos de histórico devolvidos por equipa (`last10.played`), tornando óbvio
  quando a causa são seleções/competições com pouca cobertura.

## 0.2.11.0

- **Fontes de dados reduzidas a Football-Data.org + API-Football** (mais o
  `mock` de demonstração). Removidos os providers SportMonks (pago), TheSportsDB
  (cobertura fraca) e SofaScore (bloqueado por Cloudflare com 403). Ficheiros
  apagados; registo limpo.
- Nota sobre "dados insuficientes": a previsão precisa de ≥3 jogos de histórico
  por equipa (`last10.played < 3`). Se a fonte não devolver histórico suficiente
  (ex.: seleções em fase de Mundial, ou cobertura limitada do plano), o jogo é
  marcado como insuficiente. A API-Football tende a ter histórico mais completo.

## 0.2.10.0

- **Nova fonte de dados experimental: SofaScore** (`SofascoreProvider`, sem
  chave). Usa a API JSON pública do SofaScore (`api.sofascore.com`) para jogos,
  resultados, histórico de equipas e jogos ao vivo.
  - ⚠️ Experimental: o SofaScore está protegido por anti-bot (Cloudflare) e pode
    devolver **403** mesmo via proxy. Pode simplesmente não funcionar — a
    alternativa estável continua a ser a Football-Data.org.
  - Capability `keyless` nas fontes que não precisam de chave (esconde o campo de
    chave em Definições, mantendo o campo de proxy).
- **Worker CORS** atualizado para encaminhar dois upstreams por prefixo de
  caminho: `/sofa/...` → `api.sofascore.com` (com cabeçalhos tipo-browser) e o
  resto → `api.football-data.org`. Deploy automático via GitHub Actions.

## 0.2.9.0

- **Limite de análise removido por defeito**: `analysisBatchSize` passa a `0`
  (analisar todos os jogos filtrados). A análise por lotes continua disponível
  como opção em Definições para quem quiser poupar pedidos à API.
- Migração do estado persistido (`btts:settings` v1): instalações antigas com o
  limite de 20 são repostas para `0` automaticamente.

## 0.2.8.0

- Novo filtro **"Só grandes competições"** (ligado por defeito): allowlist que
  mantém apenas as grandes ligas (Premier League, La Liga, Serie A, Bundesliga,
  Ligue 1, Liga Portugal, Eredivisie, Championship) e os torneios
  mundiais/continentais (Mundial, Euro, Champions League, Europa League,
  Copa América, Copa Libertadores, Nations League, Club World Cup, etc.).
  Aplicado **antes** da análise — reduz dias de 400+ jogos a uma mão-cheia, para
  a análise terminar dentro da quota da API.
- Heurística `isMajorCompetition(name, country)` por nome de competição, com
  testes; exclui variantes juvenis/amigáveis mesmo que contenham o nome de uma
  grande competição (ex.: "World Cup U20").
- Quando o filtro deixa o dia vazio, o estado vazio explica como desligá-lo.

## 0.2.7.0

- **Análise por lotes** no painel: em dias com muitos jogos (centenas), a app
  deixou de analisar tudo de uma vez — esgotava a quota da API. Agora analisa
  apenas os próximos N jogos a começar, **ordenados por hora de início** (jogos
  já iniciados/terminados ficam no fim da fila de prioridade).
- Botão **"Analisar mais N"** no painel para estender a janela de análise quando
  o utilizador quiser; jogos já analisados ficam em cache e não voltam a gastar
  pedidos.
- Nova definição **"Jogos analisados por lote"** (Definições → Análise), por
  defeito **20**. `0` = analisar todos de uma vez (comportamento antigo).
- Indicador de estado no cabeçalho mostra `a analisar X/Y` e `Z em espera`.

## 0.2.6.0

- Novo filtro **"Esconder ligas amadoras/juvenis"** (ligado por defeito): exclui
  amigáveis, equipas juvenis (U17–U23/Sub-XX), reservas e amadoras **antes** da
  análise. Evita que centenas de jogos menores esgotem a quota e bloqueiem a
  análise do dia. Heurística por nome da competição, com testes.

## 0.2.5.0

- **Pedidos restantes da API**: o painel e as Definições mostram quantos pedidos
  ainda tens na janela atual da fonte ativa (lido dos cabeçalhos/corpo da
  resposta — Football-Data: por minuto; API-Football: por dia; SportMonks: por
  hora). Fica destacado a amarelo quando está perto do limite.
- Na web com proxy, é preciso expor o cabeçalho de quota no Worker
  (`Access-Control-Expose-Headers`); no APK aparece sempre. Doc atualizada.

## 0.2.4.0

- **Análises guardadas por dia**: ao voltar a um dia já analisado, os jogos
  aparecem de imediato e não se gasta novamente pedidos à API. A cache é por dia
  e é invalidada se mudares os pesos / calibração.
- Novo botão **"Reanalisar"** para forçar nova análise do dia.
- Jogos sem dados não são reanalisados; jogos falhados por limite (429) são
  retentados na próxima visita (não ficam gravados como "sem dados").

## 0.2.3.1

- O painel mostra apenas jogos **já analisados**: as linhas com "..." (ainda por
  analisar) deixam de aparecer (filtro "Mostrar só jogos analisados", por defeito).
- Indicador de progresso "a analisar X/Y" enquanto as previsões são calculadas.

## 0.2.3.0

- **Ao Vivo** mostra apenas os jogos que estás a acompanhar (no histórico de
  previsões ou nas apostas), em vez de todos os jogos da fonte.
- **Hora de início** do jogo passa a estar visível no histórico, no Ao Vivo e na
  análise. Os jogos `LiveMatch` passam a transportar a data de início, corrigindo
  a hora errada nos jogos abertos a partir do Ao Vivo.

## 0.2.2.0

- Jogos **sem dados suficientes** deixam de ser considerados: o painel esconde-os
  por defeito (filtro "Esconder jogos sem dados"). Só são analisados jogos com
  histórico real das equipas.
- Novo botão **"Adicionar jogo"** no Histórico → Previsões: regista um jogo
  manualmente (equipas, competição, data, previsão e resultado), mesmo sem aposta.
- **Popup de novidades**: ao atualizar a app, aparece um resumo do que mudou.

## 0.2.1.1

- Correção importante: jogos **sem histórico** já não aparecem como "Muito
  Forte 93% NÃO". Sem dados, os fatores ficam neutros (~50/50), a previsão é
  marcada como **"Fraca / dados insuficientes"** e mostra um aviso na análise.
- "Atualizar resultados" passa a fechar o **BTTS=SIM** ainda com o jogo a
  decorrer, assim que ambas as equipas marcam (antes só fechava no final).
- Ao Vivo: etiqueta mais clara — "Ambas marcaram ✓ (BTTS SIM)" em vez de só
  "BTTS ✓".

## 0.2.1.0

- Novas fontes de dados: **API-Football**, **SportMonks** e **TheSportsDB**
  (escolhidas em Definições, cada uma com a sua chave).
- **Fonte de reserva automática**: se a fonte principal falhar ou esgotar o
  limite, a app tenta as outras fontes configuradas (jogos e ao vivo).
- **Odds automáticas**: quando a fonte as fornece (ex.: API-Football), as odds
  BTTS são preenchidas sozinhas na análise (valor/calibração).
- **Estratégias de stake**: calculadora que compara aposta fixa, % da banca e
  Kelly, com o valor esperado (EV) de cada uma.

## 0.2.0.0

- Filtro "só jogos com valor" e coluna de valor (edge) na tabela de jogos.
- Pesquisa por equipa/competição e liga favorita no painel.
- Auto-tuning dos pesos do modelo a partir dos resultados (minimiza o Brier).
- Dashboard financeiro nas apostas: evolução da banca, ROI e lucro por mês.
- Versionamento da app: a versão passa a ser mostrada nas Definições.
