# CLAUDE.md

Guia para agentes (Claude Code) que trabalham neste repositório — **BTTS Analytics Pro**.

## O que é

PWA em React 18 + TypeScript (strict) + Vite 6 para análise e **previsões próprias** do
mercado **BTTS (Both Teams To Score)**. 100% estática (sem backend próprio), offline-first,
fonte de dados única: **Flashscore (RapidAPI)** via Proxy CORS (Cloudflare Worker).

## Documentação (ler antes de mexer)

| Ficheiro | Para quê |
|---|---|
| [`README.md`](./README.md) | Visão geral, scripts, motor de previsão, estrutura. |
| [`ARCHITECTURE.md`](./ARCHITECTURE.md) | Arquitetura completa e decisões técnicas. |
| [`CHANGELOG.md`](./CHANGELOG.md) | Histórico de versões (uma entrada por versão). |
| [`TODO.md`](./TODO.md) | **Trabalho por fazer / ideias / pedidos pendentes.** Manter atualizado. |
| [`TESTING.md`](./TESTING.md) | **Como testar + registo de BUGS (abertos e resolvidos).** Manter atualizado. |
| [`docs/ROADMAP.md`](./docs/ROADMAP.md) | Plano de evolução de mais alto nível. |
| [`docs/CORS-PROXY.md`](./docs/CORS-PROXY.md) | Proxy CORS + sincronização (KV). |

## Regras de trabalho

1. **Nunca fazer push direto para `main`** (está bloqueado). Fluxo: criar branch →
   commit → abrir PR (draft) → marcar ready → **squash-merge** → apagar branch local →
   `git pull origin main`.
2. **Versão**: a fonte de verdade é [`src/version.ts`](./src/version.ts)
   (`0.MAIOR.MENOR.CORREÇÃO`). Em cada alteração funcional:
   - bump `APP_VERSION` + nova entrada no topo de `WHATS_NEW`;
   - atualizar a _seed_ em [`src/version.test.ts`](./src/version.test.ts) (a versão de
     `WHATS_NEW[2]`, para que `whatsNewSince(seed)` devolva `[WHATS_NEW[0], WHATS_NEW[1]]`);
   - espelhar a versão 3-partes em `package.json` (npm exige semver válido — versões
     `CORREÇÃO` de 4 partes não sobem o `package.json`);
   - acrescentar entrada em `CHANGELOG.md`.
3. **Antes de cada commit**, correr e passar tudo:
   `npm run format:check && npm run typecheck && npm run lint && npm test && npm run build`.
4. **Documentação viva**: ao concluir trabalho, atualizar `TODO.md` (riscar/remover o que
   ficou feito, anotar o que surgir) e `TESTING.md` (registar bugs encontrados/resolvidos e
   novos casos de teste). Registar versões em `CHANGELOG.md`/`WHATS_NEW`.
5. **Modelo de previsão**: ao mudar a matemática, subir o `MODEL_VERSION` em
   [`src/services/dayPredictions.ts`](./src/services/dayPredictions.ts) para invalidar
   previsões em cache.

## Comandos úteis

```bash
npm run dev          # dev server (Vite)
npm test             # Vitest (ver TESTING.md)
npm run typecheck    # tsc --noEmit
npm run lint         # eslint --max-warnings=0
npm run build        # tsc -b + vite build
```
