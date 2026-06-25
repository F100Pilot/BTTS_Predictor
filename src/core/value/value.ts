import { round } from '@/lib/math';

export interface SideValue {
  odd: number;
  prob: number; // model probability for this side (0..1)
  edge: number; // expected value per unit staked: prob*odd - 1
}

export interface ValueResult {
  yes?: SideValue;
  no?: SideValue;
  /** The side with positive edge and the higher edge, if any. */
  best?: 'yes' | 'no';
}

function side(prob: number, odd?: number): SideValue | undefined {
  if (typeof odd !== 'number' || odd <= 1) return undefined;
  return { odd, prob, edge: round(prob * odd - 1, 4) };
}

/**
 * Betting value (edge) of BTTS=YES/NO: compares the model probability with the
 * bookmaker odds. edge = prob*odd - 1 > 0 means positive expected value.
 */
export function computeValue(
  probYes: number,
  odds?: { bttsYes?: number; bttsNo?: number },
): ValueResult {
  const yes = side(probYes, odds?.bttsYes);
  const no = side(1 - probYes, odds?.bttsNo);
  let best: 'yes' | 'no' | undefined;
  const yesEdge = yes && yes.edge > 0 ? yes.edge : -Infinity;
  const noEdge = no && no.edge > 0 ? no.edge : -Infinity;
  if (yesEdge > -Infinity || noEdge > -Infinity) best = yesEdge >= noEdge ? 'yes' : 'no';
  return { yes, no, best };
}
