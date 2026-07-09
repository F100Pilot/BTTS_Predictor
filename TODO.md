# TODO — BTTS Analytics Pro

> Lista de trabalho por fazer, ideias e pedidos pendentes.
> Manter atualizada: ao concluir um item, marcá-lo `[x]` (ou removê-lo) e registar a
> versão no `CHANGELOG.md`. Para bugs, ver [`TESTING.md`](./TESTING.md).
> Plano de mais alto nível em [`docs/ROADMAP.md`](./docs/ROADMAP.md).

_Última atualização: 2026-07-09 (v0.3.7.0)._

## Em curso / próximo

- [ ] Nada agendado de momento — ver as ideias abaixo.

## Melhorias ao modelo de previsão (discutidas, não selecionadas)

Vindas de uma revisão externa (Gemini). Já implementado: recência (time-decay) +
Empirical-Bayes shrinkage (v0.2.46); Dixon-Coles nos mercados O/U 2.5 + 1X2
(v0.3.7.0). Por decidir:

- [ ] **Dixon-Coles para o BTTS**: derivar o BTTS da grelha de resultados
      (`P(casa≥1 E fora≥1)`) em vez do modelo de fatores — hoje o DC só afeta
      Over/Under e 1X2.
- [ ] **Regressão logística** a substituir a soma ponderada linear — só com
      regularização (ridge) e dataset suficiente, para não fazer overfitting com
      poucas amostras por utilizador.
- [ ] **Confiança via standard error** das previsões (bootstrap/variância) em vez da
      métrica composta atual.

## Funcionalidades (ideias)

- [ ] **i18n** (PT/EN/ES) com `react-i18next`.
- [ ] **Notificações push** para jogos da watchlist com confiança elevada.
- [ ] **Dashboard de performance** do utilizador (ROI simulado a partir do histórico).
- [ ] **Modo "value bet"** mais destacado (comparar probabilidade interna vs odds).
- [ ] **xG (expected goals)** quando a fonte o fornecer.

## Qualidade / dívida técnica

- [ ] **Testes de componentes** (Testing Library) para Dashboard, Analysis e Ao Vivo.
- [ ] Cobertura de testes do `DataService` (fallback, cache, rate limit) — alargar.
- [ ] Auditoria de acessibilidade (a11y) completa.
- [ ] Avaliar substituir/isolar `xlsx` (vulnerabilidades conhecidas; já em import dinâmico).

## Tarefas do utilizador (fora do alcance do agente)

- [ ] Apagar o branch remoto `claude/ui-redesign-experimental-d3rllf` (o servidor bloqueia
      o delete-push; tem de ser feito na UI do GitHub).
- [ ] Apagar o projeto Cloudflare Pages `btts-predictor` (sem acesso a partir do agente).

## Concluído recentemente

- [x] **Dixon-Coles** nos mercados Over/Under 2.5 e 1X2 (v0.3.7.0).
- [x] **Renovação visual** (FotMob/Sofascore): Inter + cores com significado,
      cartões com emblemas/barra de resultado/mini-probabilidade, navegação
      inferior em grelha, seletor de mercado sticky, skeletons de carregamento em
      todas as páginas, toolbar do Histórico reorganizado (v0.3.5.0 → v0.3.6.4).
- [x] Martingale por jogo com perda **partilhada** entre mercados; liquidação de
      apostas O/U 2.5 e 1X2 pelo resultado; análise a abrir a partir de apostas/
      histórico; apagar apostas (v0.3.3–v0.3.4).
- [x] Histórico separado por mercado + análise que segue o mercado selecionado
      (v0.3.0 → v0.3.4).
- [x] Seletor de mercado (BTTS/O-U 2.5/1X2) na página de Jogos + desempenho por
      mercado no Histórico, sem misturar (v0.2.49 / v0.2.50).
- [x] Liquidação de Histórico/Apostas por score; "Acerto por faixa" (v0.2.47/0.2.48).
- [x] Liquidação automática no Ao Vivo + remoção ao atingir o resultado (v0.2.45).
- [x] Recência (time-decay) + Empirical-Bayes shrinkage no modelo (v0.2.46).
- [x] Confirmação antes de reanalisar (v0.2.44.1).
- [x] Martingale associado ao jogo via pop-up (v0.2.44).
