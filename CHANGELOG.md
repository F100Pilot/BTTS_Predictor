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
