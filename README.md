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
- **Favoritos**, **Watchlist** e **Histórico** de previsões (IndexedDB).
- **Exportação** para Excel (.xlsx), CSV e PDF.
- **PWA**: instalável, offline-first, Service Worker com aviso de atualização.
- **Camada de dados modular**: troque/adicione fontes (Football-Data.org incluído) sem alterar a app. **Dados de demonstração** funcionam sem qualquer chave.
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

A app arranca com a fonte **"Dados de Demonstração"** (offline, determinística) — nenhuma chave de API é necessária para experimentar.

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

Os pesos são **ajustáveis** em *Definições* e o motor é uma **função pura** coberta por testes. Ver detalhes em [`ARCHITECTURE.md`](./ARCHITECTURE.md).

---

## 🔌 Fontes de dados

A app define uma interface `DataProvider` (Strategy Pattern). Estão incluídos:

| Provider | Chave necessária | Notas |
|---|---|---|
| **Dados de Demonstração** (`mock`) | Não | Offline, determinístico, por defeito. |
| **Football-Data.org** | Sim (grátis) | Configure a chave em *Definições*. Ver nota CORS abaixo. |

> **Adicionar uma fonte** (API-Football, SportMonks, FBref, …): crie uma classe que implemente `DataProvider` em `src/data/providers/` e registe-a em `src/data/providers/registry.ts`. Nada mais precisa de mudar.

> **Chaves de API**: numa app estática não há backend para as esconder. Cada utilizador insere a **sua própria chave**, guardada apenas no dispositivo (LocalStorage). Algumas APIs (ex.: Football-Data.org) não enviam cabeçalhos CORS, pelo que funcionam melhor no invólucro nativo (Capacitor) ou atrás de um proxy — ver [`ARCHITECTURE.md`](./ARCHITECTURE.md) §9.2.

---

## 📚 Documentação

- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — arquitetura completa, problemas técnicos e soluções.
- [`docs/INSTALLATION.md`](./docs/INSTALLATION.md) — guia de instalação detalhado.
- [`docs/DEPLOYMENT.md`](./docs/DEPLOYMENT.md) — deploy no GitHub Pages.
- [`docs/CORS-PROXY.md`](./docs/CORS-PROXY.md) — resolver o CORS da Football-Data.org (proxy / Cloudflare Worker).
- [`docs/APK.md`](./docs/APK.md) — conversão para APK/IPA com Capacitor.
- [`docs/ROADMAP.md`](./docs/ROADMAP.md) — plano de evolução futura.

---

## 🗂️ Estrutura do projeto

```
src/
├── app/          Bootstrap + router
├── components/   ui (shadcn), layout, dashboard, analysis, common
├── core/         prediction (motor), statistics, classification
├── data/         providers (fontes), cache (IndexedDB), rateLimit
├── domain/       tipos de domínio
├── services/     export, logger, sanitize, analysisService
├── store/        Zustand (settings, collections, fixtureCache)
├── hooks/        hooks reutilizáveis
├── lib/          utilitários puros (math, format, cn)
└── pages/        Dashboard, Analysis, Favorites, Watchlist, History, Settings
```

---

## ⚠️ Aviso

Esta aplicação destina-se a **fins informativos e estatísticos**. As previsões não constituem aconselhamento de apostas. Aposte com responsabilidade.

## 📄 Licença

MIT.
