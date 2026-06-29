# ⚽ BTTS Analytics Pro

> Progressive Web App para análise estatística e **previsões próprias** do mercado **BTTS (Both Teams To Score)** — "ambas as equipas marcam".

BTTS Analytics Pro recolhe dados estatísticos de futebol, calcula probabilidades **internamente** (não se limita a copiar odds) e classifica os jogos por força da previsão. Funciona offline, é instalável em Android/iPhone e está pronta para alojamento gratuito no **GitHub Pages**.

![Stack](https://img.shields.io/badge/React-18-61dafb) ![TS](https://img.shields.io/badge/TypeScript-strict-3178c6) ![Vite](https://img.shields.io/badge/Vite-6-646cff) ![PWA](https://img.shields.io/badge/PWA-offline-5a0fc8)

---

## ✨ Funcionalidades

- **Motor de previsão próprio** com pesos configuráveis (Forma 30%, BTTS histórico 25%, Ataque 15%, Defesa 15%, H2H 10%, Casa/Fora 5%).
- **Probabilidades BTTS SIM/NÃO** + **Confidence Score (0-10)** + classificação automática (**Muito Forte / Forte / Média / Fraca**).
- **Dashboard** "Jogos de Hoje" ordenado por probabilidade, com filtros (campeonato, data, BTTS mínimo, odds min/máx, país).
- **Página de análise** detalhada: forma, estatísticas (últimos 5/10, casa/fora), head-to-head, decomposição do modelo e **gráficos** (tendência BTTS, golos marcados/sofridos).
- **Página Ao Vivo**: acompanha os teus jogos (histórico/apostas), liquida-os automaticamente quando atingem o resultado BTTS e remove-os da lista.
- **Martingale** associado ao jogo (pop-up na análise) + aba de gestão de banca com staking recuperativo.
- **Calculadora** de prognóstico manual (sem chamadas à API).
- **Histórico** de previsões (IndexedDB), com sincronização opcional entre dispositivos (Cloudflare KV).
- **Exportação** para Excel (.xlsx), CSV e PDF.
- **PWA**: instalável, offline-first, Service Worker com aviso de atualização.
- **Camada de dados modular** (Strategy Pattern): a fonte é o **Flashscore (RapidAPI)** — cobre quase todas as ligas e faz a análise diária com ~1 pedido por jogo. Adicionar outra fonte é criar uma classe `DataProvider` e registá-la.
- **Tema claro/escuro**, responsivo (mobile-first).

---

## 🚀 Início Rápido

Pré-requisitos: **Node.js ≥ 20** e npm.

```bash
git clone <repo-url>
cd btts-analytics-pro
npm install
npm run dev          # http://localhost:5173
```

A app usa o **Flashscore (RapidAPI)** como fonte de dados. Em _Definições_, indica a tua **chave RapidAPI** e um **Proxy CORS** (o teu Cloudflare Worker — ver [`docs/CORS-PROXY.md`](./docs/CORS-PROXY.md)).

### Scripts

| Comando | Descrição |
|---|---|
| `npm run dev` | Servidor de desenvolvimento (Vite + HMR) |
| `npm run build` | Type-check + build de produção (`dist/`) |
| `npm run preview` | Pré-visualiza o build de produção |
| `npm test` | Testes unitários (Vitest) |
| `npm run lint` | ESLint (0 warnings) |
| `npm run format` | Formata com Prettier |
| `npm run typecheck` | Verificação de tipos |
| `node scripts/generate-icons.mjs` | (Re)gera os ícones PWA |

---

## 🧠 Como funciona o motor de previsão

Cada fator produz um sub-score em `[0,1]` (probabilidade de BTTS=SIM segundo aquela dimensão). O resultado é a **soma ponderada**:

```
P(BTTS=SIM) = 0.30·Forma + 0.25·BTTS_hist + 0.15·Ataque + 0.15·Defesa + 0.10·H2H + 0.05·Casa/Fora
P(BTTS=NÃO) = 1 − P(BTTS=SIM)
```

- **Forma**: modelo de Poisson sobre golos recentes vs fragilidade defensiva do adversário.
- **Confidence Score**: combina quantidade de dados, concordância entre fatores e extremidade da probabilidade.
- **Classificação**: ≥80% Muito Forte · 70-79% Forte · 60-69% Média · <60% Fraca.

Os dados que alimentam os fatores são **ponderados por recência** (time-decay, meia-vida
~6 meses) e **regularizados** com _Empirical-Bayes shrinkage_ para a média da liga em
amostras pequenas (início de época, seleções) — só no cálculo; as estatísticas mostradas
continuam a ser as reais. Os pesos são **ajustáveis** em *Definições* (e podem ser
**afinados automaticamente** pelos teus resultados), há **calibração** de probabilidades
(Platt) e o motor é uma **função pura** coberta por testes. Ver detalhes em
[`ARCHITECTURE.md`](./ARCHITECTURE.md) e [`TESTING.md`](./TESTING.md).

---

## 🔌 Fontes de dados

A app define uma interface `DataProvider` (Strategy Pattern). Fonte ativa:

| Provider | Chave necessária | Notas |
|---|---|---|
| **Flashscore (RapidAPI)** | Sim (RapidAPI) | Única fonte. Cobre quase todas as ligas; faz a análise diária com ~1 pedido por jogo (forma das duas equipas + H2H no mesmo pedido `h2h`), mais 1 pedido para a lista do dia. Também alimenta o Ao Vivo e os resultados. Requer Proxy CORS (Worker). |

> As fontes **Football-Data.org** e **API-Football** foram removidas na v0.2.37 (os planos grátis davam pouco retorno útil para os cálculos).

> **Adicionar uma fonte**: crie uma classe que implemente `DataProvider` em `src/data/providers/` e registe-a em `src/data/providers/registry.ts`. Nada mais precisa de mudar.

> **Chave de API**: numa app estática não há backend para a esconder. Cada utilizador insere a **sua própria chave RapidAPI**, guardada apenas no dispositivo (LocalStorage). O browser não pode chamar o RapidAPI diretamente (CORS + cabeçalho da chave), por isso os pedidos passam pelo **Proxy CORS** (o teu Cloudflare Worker) — ver [`docs/CORS-PROXY.md`](./docs/CORS-PROXY.md).

---

## 📚 Documentação

- [`CLAUDE.md`](./CLAUDE.md) — guia para agentes (regras de trabalho, versão, docs vivas).
- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — arquitetura completa, problemas técnicos e soluções.
- [`TODO.md`](./TODO.md) — trabalho por fazer, ideias e pedidos pendentes.
- [`TESTING.md`](./TESTING.md) — como testar **e** registo de bugs (abertos/resolvidos).
- [`CHANGELOG.md`](./CHANGELOG.md) — histórico de versões.
- [`docs/INSTALLATION.md`](./docs/INSTALLATION.md) — guia de instalação detalhado.
- [`docs/DEPLOYMENT.md`](./docs/DEPLOYMENT.md) — deploy no GitHub Pages.
- [`docs/CORS-PROXY.md`](./docs/CORS-PROXY.md) — Proxy CORS para o RapidAPI/Flashscore (Cloudflare Worker) + sincronização (KV).
- [`docs/APK.md`](./docs/APK.md) — conversão para APK/IPA com Capacitor.
- [`docs/ROADMAP.md`](./docs/ROADMAP.md) — plano de evolução futura.

---

## 🗂️ Estrutura do projeto

```
src/
├── app/          Bootstrap + router
├── components/   ui (shadcn), layout, dashboard, analysis, martingale, common
├── core/         prediction (motor), statistics, classification, backtest, value, martingale, staking
├── data/         providers (Flashscore), cache (IndexedDB), rateLimit
├── domain/       tipos de domínio
├── services/     analysisService, autoTune, flashscore*, settlement, sync, export, logger, sanitize
├── store/        Zustand (settings, collections, fixtureCache, martingale, calibration, dashboardFilters)
├── hooks/        hooks reutilizáveis
├── lib/          utilitários puros (math, format, cn)
└── pages/        Dashboard, Analysis, LiveScore, Martingale, Calculator, History, Settings
```

---

## ⚠️ Aviso

Esta aplicação destina-se a **fins informativos e estatísticos**. As previsões não constituem aconselhamento de apostas. Aposte com responsabilidade.

## 📄 Licença

MIT.
