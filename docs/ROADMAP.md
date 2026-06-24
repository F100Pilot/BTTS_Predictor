# Plano de Evolução Futura

## Curto prazo
- [ ] **Mais providers** de Prioridade 1: API-Football e SportMonks (classes que implementam `DataProvider`).
- [ ] **Proxy serverless opcional** (Cloudflare Workers / Vercel) para esconder chaves e contornar CORS de FBref/Understat/Soccerway.
- [ ] **Testes de componentes** (Testing Library) para Dashboard e Analysis.
- [ ] **i18n** (PT/EN/ES) com `react-i18next`.

## Médio prazo
- [ ] **Backtesting** do modelo contra resultados históricos e relatório de acerto por tier.
- [ ] **Auto-tuning de pesos** via otimização sobre dados passados.
- [ ] **Novos mercados** reutilizando a arquitetura de fatores: Over/Under 2.5, 1X2, cantos.
- [ ] **Notificações push** para jogos da watchlist com confiança elevada.
- [ ] **Sincronização** de perfil entre dispositivos via export/import (JSON encriptado).

## Longo prazo
- [ ] **Modelo ML** treinado (ex.: gradient boosting / rede neuronal) substituível atrás da mesma interface `predict()`.
- [ ] **xG (expected goals)** incorporado quando a fonte o fornecer.
- [ ] **Modo "value bet"** comparando probabilidade interna com odds de mercado.
- [ ] **Dashboard de performance** do utilizador (ROI simulado a partir do histórico).

## Dívida técnica / qualidade
- [ ] Substituir `xlsx` por alternativa sem vulnerabilidades conhecidas, ou isolar a exportação atrás de import dinâmico (já feito) + verificação.
- [ ] Cobertura de testes do `DataService` (fallback, cache, rate limit).
- [ ] Auditoria de acessibilidade (a11y) completa.
