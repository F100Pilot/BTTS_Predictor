# Changelog

Registo das versões do **BTTS Analytics Pro**.

## Esquema de versões (`MAIOR.MENOR.CORREÇÃO`)

A versão está em [`package.json`](package.json) e é mostrada na app em **Definições**
(rodapé). A regra de incremento:

| Posição    | Exemplo | Quando incrementar                                            |
| ---------- | ------- | ------------------------------------------------------------ |
| **MAIOR**  | **2**.0.0 | Grande alteração estrutural (mudança de arquitetura, dados). |
| **MENOR**  | 2.**0**.0 | Nova funcionalidade.                                         |
| **CORREÇÃO** | 2.0.**0** | Correções de erros / ajustes pequenos.                      |

> Ao subir um nível, os níveis à direita voltam a `0`
> (ex.: nova funcionalidade sobre a `2.0.3` → `2.1.0`).

Sempre que mudar a versão em `package.json`, acrescente uma entrada abaixo.

---

## 2.1.1

- Correção importante: jogos **sem histórico** já não aparecem como "Muito
  Forte 93% NÃO". Sem dados, os fatores ficam neutros (~50/50), a previsão é
  marcada como **"Fraca / dados insuficientes"** e mostra um aviso na análise.
- "Atualizar resultados" passa a fechar o **BTTS=SIM** ainda com o jogo a
  decorrer, assim que ambas as equipas marcam (antes só fechava no final).
- Ao Vivo: etiqueta mais clara — "Ambas marcaram ✓ (BTTS SIM)" em vez de só
  "BTTS ✓".

## 2.1.0

- Novas fontes de dados: **API-Football**, **SportMonks** e **TheSportsDB**
  (escolhidas em Definições, cada uma com a sua chave).
- **Fonte de reserva automática**: se a fonte principal falhar ou esgotar o
  limite, a app tenta as outras fontes configuradas (jogos e ao vivo).
- **Odds automáticas**: quando a fonte as fornece (ex.: API-Football), as odds
  BTTS são preenchidas sozinhas na análise (valor/calibração).
- **Estratégias de stake**: calculadora que compara aposta fixa, % da banca e
  Kelly, com o valor esperado (EV) de cada uma.

## 2.0.0

- Filtro "só jogos com valor" e coluna de valor (edge) na tabela de jogos.
- Pesquisa por equipa/competição e liga favorita no painel.
- Auto-tuning dos pesos do modelo a partir dos resultados (minimiza o Brier).
- Dashboard financeiro nas apostas: evolução da banca, ROI e lucro por mês.
- Versionamento da app: a versão passa a ser mostrada nas Definições.
