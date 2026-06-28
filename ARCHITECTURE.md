# BTTS Analytics Pro — Documento de Arquitetura

> Versão: 1.0 · Última atualização: 2026-06-24
> Estado: Documento vivo. Deve ser atualizado sempre que decisões arquiteturais relevantes forem tomadas.

Este documento descreve a arquitetura completa da aplicação **BTTS Analytics Pro**, identifica os principais problemas técnicos previstos e propõe soluções concretas. Segue a abordagem **"plan first, code later"** exigida no pedido inicial.

---

## 1. Visão Geral

**BTTS Analytics Pro** é uma *Progressive Web App* (PWA) que recolhe dados estatísticos de futebol a partir de fontes públicas/APIs e gera previsões próprias para o mercado **BTTS (Both Teams To Score)** — ou seja, "ambas as equipas marcam".

Pontos-chave do design:

- **100% estática** — funciona em GitHub Pages, sem servidor próprio. Toda a lógica (recolha, cálculo, armazenamento) corre no browser.
- **Motor de previsão próprio** — não se limita a copiar odds; calcula probabilidades internas a partir de um modelo ponderado.
- **Camada de dados modular** — fontes de dados são *plugins* substituíveis sem tocar na aplicação.
- **Offline-first** — IndexedDB + Service Worker permitem usar a app sem ligação após a primeira carga.
- **Instalável** — Android/iPhone via PWA, e preparada para empacotamento APK via Capacitor.

---

## 2. Stack Tecnológica

| Camada | Tecnologia | Justificação |
|---|---|---|
| Build/Bundler | **Vite** | Arranque rápido, HMR, suporte nativo a PWA via plugin. |
| Linguagem | **TypeScript (strict)** | Segurança de tipos, manutenção, SOLID. |
| UI Framework | **React 18** | Ecossistema maduro, componível. |
| Routing | **react-router-dom** (HashRouter) | HashRouter evita 404 em GitHub Pages (ver §9.1). |
| Estilos | **Tailwind CSS** | Utility-first, mobile-first, tree-shaking. |
| Componentes | **Shadcn/UI** (padrão, copy-in) | Componentes acessíveis sem dependência pesada de runtime. |
| Estado | **Zustand** | Simples, sem boilerplate, persistência fácil. |
| Gráficos | **Recharts** | Declarativo, responsivo, integra com React. |
| Persistência | **IndexedDB** (via `idb`) + **LocalStorage** | IndexedDB para dados/caché; LocalStorage para preferências leves. |
| Datas | **date-fns** | Leve, tree-shakeable. |
| Exportação | **SheetJS (xlsx)**, **PapaParse (csv)**, **jsPDF + autotable (pdf)** | Geração de ficheiros no cliente. |
| PWA | **vite-plugin-pwa** (Workbox) | Manifest + Service Worker + estratégias de cache. |
| Mobile | **Capacitor** | Conversão futura para APK/IPA. |
| Qualidade | **ESLint + Prettier + tsc** | Lint, formatação, type-check. |
| Testes | **Vitest + Testing Library** | Unitários do motor de previsão e utilitários. |

---

## 3. Estrutura de Pastas

```
btts-analytics-pro/
├── public/                      # Assets estáticos (ícones PWA, robots.txt)
│   └── icons/
├── src/
│   ├── app/                     # Bootstrap, router, providers globais
│   ├── components/
│   │   ├── ui/                  # Primitivos Shadcn (button, card, table...)
│   │   ├── layout/              # Header, nav, shell responsivo
│   │   ├── dashboard/           # Tabela de jogos, filtros, badges
│   │   ├── analysis/            # Página de análise, gráficos
│   │   └── common/              # ErrorBoundary, EmptyState, Loaders
│   ├── core/
│   │   ├── prediction/          # Motor BTTS (algoritmo ponderado)
│   │   ├── statistics/          # Agregação de estatísticas por equipa/H2H
│   │   └── classification/      # Muito Forte / Forte / Média / Fraca
│   ├── data/
│   │   ├── providers/           # Adaptadores de fontes (interface + impls)
│   │   ├── normalize/           # Normalização para o modelo de domínio
│   │   ├── cache/               # Cache inteligente (TTL, IndexedDB)
│   │   └── rateLimit/           # Rate limiting / token bucket
│   ├── domain/                  # Tipos de domínio (Team, Match, Prediction...)
│   ├── store/                   # Stores Zustand (settings, favorites, watchlist)
│   ├── services/                # Export, logging, sanitização
│   ├── hooks/                   # React hooks reutilizáveis
│   ├── lib/                     # Utilitários puros (cn, math, format)
│   ├── pages/                   # Páginas (Dashboard, Analysis, Favorites...)
│   └── styles/                  # CSS global / Tailwind
├── docs/                        # Guias (instalação, deploy, APK)
├── .github/workflows/           # CI + deploy GitHub Pages
├── capacitor.config.ts          # Config Capacitor
├── vite.config.ts
├── tailwind.config.js
├── tsconfig.json
├── ARCHITECTURE.md              # (este documento)
└── README.md
```

---

## 4. Modelo de Domínio (resumo)

Entidades centrais (ver `src/domain/`):

- **Team** — id, nome, país, crest.
- **MatchResult** — jogo passado normalizado (golos casa/fora, data, local).
- **Fixture** — jogo agendado (hoje/futuro) com equipas, competição, hora, odds opcionais.
- **TeamStats** — estatísticas agregadas (últimos 5/10, casa/fora): golos marcados/sofridos, BTTS%, Over2.5%, CleanSheet%, FailedToScore%.
- **HeadToHead** — confrontos diretos, BTTS%, média de golos.
- **BttsPrediction** — `probYes`, `probNo`, `confidence` (0-10), `tier`, *breakdown* por fator.
- **AnalysisBundle** — agregação de tudo o que a página de análise precisa.

---

## 5. Camada de Dados (Data Layer)

### 5.1 Interface `DataProvider`

Todas as fontes implementam um contrato comum (Strategy Pattern):

```ts
interface DataProvider {
  readonly id: string;
  readonly label: string;
  readonly capabilities: ProviderCapabilities;
  isConfigured(): boolean;
  getFixturesByDate(date: string): Promise<Fixture[]>;
  getTeamRecentMatches(teamId: string, limit: number): Promise<MatchResult[]>;
  getHeadToHead(homeId: string, awayId: string, limit: number): Promise<MatchResult[]>;
}
```

Implementação atual:

- **`FlashscoreProvider`** (RapidAPI) — **a única fonte**. Cobre quase todas as
  ligas e suporta o pipeline completo: jogos por data, forma das duas equipas +
  H2H num só pedido por jogo (`getFixtureMatches`, endpoint `h2h`), jogos ao vivo
  e resultados. Custo típico: 1 pedido/dia para a lista + ~1 pedido por jogo
  analisado.
- As fontes `FootballDataProvider` e `ApiFootballProvider` foram **removidas na
  v0.2.37** (planos grátis com pouco retorno útil); a `MockProvider` (demo) foi
  removida na v0.2.34. Histórico em [`CHANGELOG.md`](./CHANGELOG.md).

`getFixtureMatches` é o método-chave para fontes indexadas por jogo (não por
equipa): devolve a forma de ambas as equipas + H2H de um só pedido, evitando dois
`getTeamRecentMatches`. O `analysisService` usa-o quando existe.

Um **`ProviderRegistry`** mantém os providers disponíveis; um **`DataService`**
orquestra: escolhe o provider ativo (config), aplica cache e (quando há mais de
uma fonte) *fallback* para lookups independentes (jogos/ao vivo).

### 5.2 Estratégia de chaves de API

**Problema:** numa app estática não há backend para esconder chaves. Expor chaves no bundle é inaceitável.

**Solução:** a chave (RapidAPI) é fornecida pelo **próprio utilizador** na página de *Settings* e guardada em `localStorage` (apenas no dispositivo dele). O browser não pode chamar o RapidAPI diretamente (CORS + cabeçalho da chave), por isso os pedidos passam por um **Proxy CORS** (um Cloudflare Worker do utilizador — ver [`docs/CORS-PROXY.md`](./docs/CORS-PROXY.md)). Cada utilizador usa a sua própria chave/quota.

---

## 6. Motor de Previsão BTTS

Localização: `src/core/prediction/`.

### 6.1 Fatores e pesos

| Fator | Peso | Fonte |
|---|---|---|
| Forma recente | **30%** | golos marcados/sofridos recentes (últimos 5/10) |
| BTTS histórico | **25%** | % de jogos com BTTS de ambas as equipas |
| Ataque | **15%** | média de golos marcados |
| Defesa | **15%** | propensão a sofrer golos (inverso de clean sheets) |
| Head-to-head | **10%** | BTTS% nos confrontos diretos |
| Fator casa/fora | **5%** | BTTS casa (equipa da casa) vs BTTS fora (visitante) |

Cada fator produz um sub-score normalizado em `[0,1]` representando a probabilidade de BTTS=SIM segundo aquela dimensão. O score final é a **soma ponderada**:

```
P(BTTS=SIM) = Σ (peso_i × score_i)
P(BTTS=NÃO) = 1 − P(BTTS=SIM)
```

### 6.2 Confidence Score (0-10)

A confiança **não** é a probabilidade. Mede a *fiabilidade* da previsão e considera:

- **Quantidade de dados** (nº de jogos disponíveis vs ideal) — penaliza amostras pequenas.
- **Concordância entre fatores** — baixa variância entre sub-scores ⇒ maior confiança.
- **Extremidade da probabilidade** — probabilidades perto de 0/100% (longe de 50%) são mais "acionáveis".

`confidence = round( 10 × (w_data·dataScore + w_agree·agreementScore + w_extreme·extremeScore) )`.

### 6.3 Classificação automática

| Tier | Critério (sobre a probabilidade dominante) |
|---|---|
| **Muito Forte** | ≥ 80% |
| **Forte** | 70% – 79% |
| **Média** | 60% – 69% |
| **Fraca** | < 60% |

### 6.4 Determinismo e testabilidade

O motor é uma **função pura** sem efeitos colaterais: `predict(input): BttsPrediction`. Totalmente coberto por testes unitários (Vitest), incluindo casos extremos (amostras vazias, dados em falta, divisões por zero).

---

## 7. Armazenamento

| Dado | Mecanismo | Razão |
|---|---|---|
| Cache de respostas das fontes | IndexedDB (`cache` store, TTL) | Volume potencialmente grande; reduz chamadas à API. |
| Histórico de previsões | IndexedDB (`history` store) | Crescimento ao longo do tempo. |
| Favoritos / Watchlist | IndexedDB (`favorites`, `watchlist`) | Persistência estruturada. |
| Preferências (tema, provider, filtros) | LocalStorage (via Zustand persist) | Pequeno, acesso síncrono. |
| Chaves de API | LocalStorage | Apenas no dispositivo do utilizador. |

Wrapper `idb` encapsula migrações de schema e versões da base de dados.

---

## 8. Funcionalidades de Aplicação

- **Dashboard** — "Jogos de Hoje" ordenados por probabilidade BTTS desc.; tabela (Hora, Competição, Equipas, BTTS% previsto, Confiança); filtros (campeonato, data, BTTS mínimo, odds min/max, país).
- **Análise** — resumo (probabilidade + confiança), estatísticas (últimos jogos, forma, BTTS histórico, H2H) e gráficos (tendência BTTS, golos marcados, golos sofridos).
- **Favoritos / Watchlist / Histórico** — geridos via IndexedDB.
- **Exportação** — Excel (.xlsx), CSV, PDF.
- **Settings** — provider ativo, chaves, tema, parâmetros do modelo.

---

## 9. Problemas Técnicos Identificados e Soluções

### 9.1 Routing em GitHub Pages (404 em refresh)
**Problema:** GitHub Pages não tem rewrite de SPA; rotas profundas dão 404.
**Solução:** `HashRouter` (`/#/analysis/...`). Adicionalmente fornece-se `404.html` de fallback. `base` do Vite configurado para o nome do repositório.

### 9.2 CORS no browser
**Problema:** o browser não pode chamar o RapidAPI diretamente (sem cabeçalhos CORS e a chave teria de ir no pedido).
**Solução:** um **Cloudflare Worker** do utilizador serve de Proxy CORS — reencaminha os cabeçalhos `x-rapidapi-*` e responde com CORS para a origem da app. O mesmo Worker expõe ainda o endpoint `/sync` (Cloudflare KV) para a sincronização entre dispositivos. Ver [`docs/CORS-PROXY.md`](./docs/CORS-PROXY.md) e [`worker/`](./worker).

### 9.3 Segredos numa app estática
**Problema:** não há onde esconder chaves. (Ver §5.2.)
**Solução:** chave (RapidAPI) por utilizador em LocalStorage + Proxy CORS (Cloudflare Worker) que reencaminha os cabeçalhos da chave.

### 9.4 Limites de quota / Rate limiting
**Problema:** o plano RapidAPI tem um teto diário de pedidos (ex.: ~1000/dia).
**Solução:** **cache** com TTL por tipo de dado (fixtures: curto; histórico/H2H: longo) e desenho que minimiza pedidos — 1 pedido por jogo (forma + H2H juntos), o Ao Vivo só consulta o feed quando há um jogo na janela de jogo, e a sincronização só escreve no KV quando os dados mudam. Botão "Verificar quota" em Definições lê os pedidos restantes dos cabeçalhos da resposta.

### 9.5 Dados em falta / amostras pequenas
**Problema:** equipas com poucos jogos enviesam o modelo.
**Solução:** sub-scores com *fallback* neutro (0.5) e penalização no Confidence Score; nunca lançar exceção por divisão por zero (helpers seguros).

### 9.6 Qualidade/consistência entre fontes
**Problema:** formatos e IDs diferentes por fonte.
**Solução:** camada `normalize/` converte tudo para o modelo de domínio canónico antes de chegar ao core.

### 9.7 Performance (Lighthouse > 90, < 2s)
**Solução:** code-splitting por rota (lazy), tree-shaking, `vite-plugin-pwa` (precache + runtime cache), imagens/ícones otimizados, evitar dependências pesadas no caminho crítico (xlsx/jsPDF carregados *on-demand* via import dinâmico).

### 9.8 Segurança (XSS / inputs)
**Solução:** sanitização de inputs (sem `dangerouslySetInnerHTML`), validação com schemas (zod) nas fronteiras de dados, CSP recomendada, escape de conteúdo de fontes externas.

### 9.9 Offline e atualizações do Service Worker
**Problema:** SW pode servir versão obsoleta.
**Solução:** `registerType: 'prompt'` com aviso de "nova versão disponível" e *skipWaiting* controlado.

### 9.10 Erros e observabilidade
**Solução:** `ErrorBoundary` por rota, logger estruturado (`services/logger`) com níveis, e captura central de erros de rede do `DataService`.

---

## 10. Qualidade de Código

- **TypeScript strict** (`strict: true`, `noUncheckedIndexedAccess`).
- **ESLint** (regras TS + React + import order) e **Prettier**.
- **SOLID**: interfaces (DataProvider), inversão de dependência (DataService recebe providers), responsabilidade única por módulo.
- **Clean Code**: funções pequenas, nomes expressivos, sem lógica no JSX.
- **Testes** do motor de previsão, estatísticas e utilitários.

---

## 11. Deploy e Mobile

- **GitHub Pages** via GitHub Actions (`.github/workflows/deploy.yml`): build + publicação do `dist/`.
- **Capacitor**: `capacitor.config.ts` aponta `webDir: dist`; guia em `docs/APK.md`.

---

## 12. Plano de Evolução Futura

1. **Proxy serverless opcional** (Cloudflare Workers / Vercel) para esconder chaves e habilitar FBref/Understat com CORS.
2. **Mais mercados** (Over/Under, 1X2, cantos) reutilizando a arquitetura de fatores.
3. **Backtesting** do modelo contra histórico e auto-tuning de pesos.
4. **Notificações push** para jogos da watchlist com alta confiança.
5. **Sincronização opcional** entre dispositivos (export/import de perfil).
6. **i18n** (PT/EN/ES).
7. **Modelo ML** treinado (substituível atrás da mesma interface `predict`).

---

## 13. Decisões Registadas (ADR resumido)

| # | Decisão | Alternativa rejeitada | Motivo |
|---|---|---|---|
| 1 | HashRouter | BrowserRouter | Evita 404 no GitHub Pages sem servidor. |
| 2 | Chaves no LocalStorage do utilizador | Chave embebida | Segurança; app estática. |
| 3 | Flashscore (RapidAPI) como única fonte + Proxy CORS | Football-Data/API-Football (grátis) | Cobertura de ligas e ~1 pedido por jogo (forma + H2H juntos); os planos grátis davam pouco retorno útil. |
| 4 | Zustand | Redux | Menos boilerplate para o âmbito atual. |
| 5 | `idb` | Dexie | Dependência mínima, controlo de schema. |
| 6 | Import dinâmico de xlsx/jsPDF | Bundle único | Performance/Lighthouse. |
