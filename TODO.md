# TODO — BTTS Analytics Pro

> Lista de trabalho por fazer, ideias e pedidos pendentes.
> Manter atualizada: ao concluir um item, marcá-lo `[x]` (ou removê-lo) e registar a
> versão no `CHANGELOG.md`. Para bugs, ver [`TESTING.md`](./TESTING.md).
> Plano de mais alto nível em [`docs/ROADMAP.md`](./docs/ROADMAP.md).

_Última atualização: 2026-06-28 (v0.2.46)._

## Em curso / próximo

- [ ] Nada agendado de momento — ver as ideias abaixo.

## Melhorias ao modelo de previsão (discutidas, não selecionadas)

Vindas de uma revisão externa (Gemini). Já implementado: recência (time-decay) +
Empirical-Bayes shrinkage (v0.2.46). Por decidir:

- [ ] **Dixon-Coles**: ajuste de correlação de resultados baixos (0-0, 1-0, 1-1).
      Maior impacto nos mercados Over/Under e 1X2; para o BTTS implicaria calcular a
      partir da grelha de resultados `P(casa≥1 E fora≥1)`. _(próximo passo natural)_
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

- [x] Seletor de mercado (BTTS/O-U 2.5/1X2) na página de Jogos + desempenho por
      mercado no Histórico, sem misturar (v0.2.49 / v0.2.50).
- [x] Liquidação de Histórico/Apostas por score; "Acerto por faixa" (v0.2.47/0.2.48).
- [x] Liquidação automática no Ao Vivo + remoção ao atingir o resultado (v0.2.45).
- [x] Recência (time-decay) + Empirical-Bayes shrinkage no modelo (v0.2.46).
- [x] Confirmação antes de reanalisar (v0.2.44.1).
- [x] Martingale associado ao jogo via pop-up (v0.2.44).
