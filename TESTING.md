# TESTING & BUGS — BTTS Analytics Pro

> Como testar a aplicação **e** registo de bugs (abertos e resolvidos).
> Manter atualizado: ao encontrar um bug regista-o em [Bugs abertos](#bugs-abertos); ao
> resolvê-lo, move-o para [Bugs resolvidos](#bugs-resolvidos) com a versão da correção.

_Última atualização: 2026-06-29 (v0.2.47) · 129 testes._

---

## 1. Como correr os testes

```bash
npm test             # Vitest (uma passagem) — gate obrigatório antes de commit
npm run test:watch   # modo watch durante o desenvolvimento
npm run typecheck    # tsc --noEmit
npm run lint         # eslint --max-warnings=0
npm run format:check # prettier --check
npm run build        # tsc -b + vite build (verificação final)
```

**Gate de CI / antes de cada commit** (tem de passar tudo):

```bash
npm run format:check && npm run typecheck && npm run lint && npm test && npm run build
```

> O CI corre `format:check`, `typecheck`, `lint` e `test`. O build deteta erros que o
> `typecheck` isolado por vezes não apanha (ex.: PWA/Workbox).

## 2. Estrutura dos testes

Testes unitários com **Vitest** (+ jsdom e Testing Library disponíveis). Ficam ao lado do
código (`*.test.ts`). Cobertura atual (núcleo lógico — funções puras):

| Área | Ficheiro |
|---|---|
| Motor de previsão | `src/core/prediction/engine.test.ts` |
| Calibração (Platt) | `src/core/prediction/calibration.test.ts` |
| Mercados (Over/Under, 1X2) | `src/core/prediction/markets.test.ts` |
| Estatísticas (+ recência/shrinkage) | `src/core/statistics/statistics.test.ts` |
| Backtest / afinação de pesos | `src/core/backtest/backtest.test.ts`, `tuneWeights.test.ts` |
| Classificação de competições | `src/core/classification/competitions.test.ts` |
| Martingale / staking | `src/core/martingale/martingale.test.ts`, `src/core/staking/staking.test.ts` |
| Value bets | `src/core/value/value.test.ts` |
| Pipeline de análise | `src/services/analysisService.test.ts` |
| Flashscore (análise, H2H, jogos, odds, settle) | `src/services/flashscore*.test.ts` |
| Liquidação de resultados | `src/services/settlementService.test.ts` |
| Sincronização (KV) | `src/services/syncService.test.ts` |
| Camada de dados | `src/data/DataService.test.ts`, `src/data/chunkDateRange.test.ts` |
| Versão / what's new | `src/version.test.ts` |

### Convenções

- **Determinismo**: nada de `Date.now()`/`Math.random()` _implícitos_ em testes — injeta
  `now`/datas fixas (ex.: as opções `adjust` de `computeTeamStats`/`computeHeadToHead`).
- **Funções puras primeiro**: o `core/` é testável sem mocks; preferir lá a lógica.
- **`src/version.test.ts`**: a _seed_ tem de acompanhar cada bump (ver `CLAUDE.md` §2).

## 3. Teste manual (smoke) recomendado

Após mudanças de UI/dados, verificar no browser (`npm run dev`):

1. **Jogos de Hoje** — lista carrega, ordenada por BTTS, filtros funcionam.
2. **Análise de um jogo** — o destaque segue o mercado selecionado (BTTS / O-U 2.5 / 1X2)
   com seletor no topo; fatores, gráficos, Reanalisar (pede confirmação), Martingale (pop-up).
3. **Ao Vivo** — só mostra jogos do histórico/apostas; liquida e remove ao atingir BTTS.
4. **Histórico / Apostas** — agrupado por dia; clicar num jogo (Previsões ou Apostas) abre a
   sua análise; "Atualizar resultados" liquida via Flashscore; introduzir o score (golos
   casa–fora) deriva o BTTS e liquida a aposta (ganha/perdida).
5. **Definições** — chave RapidAPI + Proxy CORS, "Testar ligação", pesos, calibração.
6. **PWA** — instala, funciona offline, aviso de atualização.

---

## Bugs abertos

> Formato: `**[#id] Título** — descrição · _reportado: vX.Y.Z_ · estado.`

_Nenhum bug aberto conhecido._

## Bugs resolvidos

Histórico resumido (detalhe completo no `CHANGELOG.md`):

- **Martingale não acautelava perdas de outros mercados**: ao apostar em O/U 2.5 ou 1X2,
  a série ignorava as perdas do BTTS (e vice-versa) e o pop-up mostrava sempre stake "—".
  A perda/série passou a ser **global partilhada** por todos os mercados (`globalSeries`,
  `seriesResetAt` global com migração v2) — v0.3.3.1.
- **Ao Vivo mostrava jogos já terminados** que o feed marcava como "em jogo" — corrigido
  com janela de tempo máxima desde o início (v0.2.38.2).
- **"Testar ligação" dava falso erro** no Flashscore — passou a verificar pela via h2h,
  como a análise (v0.2.37.3).
- **"Check" duplicado** de jogo no histórico na página de Jogos (v0.2.37.4).
- **Limite diário do Workers KV**: sincronização reescrevia tudo a cada 45s — passou a
  escrever só quando muda, intervalo 5 min (v0.2.38.1).
- **Importação do Flashscore** lia formato antigo (estatísticas a 0) — alinhada ao novo
  formato `scores` (v0.2.29.3).
