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
