import { describe, it, expect } from 'vitest';
import { computeValue } from './value';

describe('computeValue', () => {
  it('computes positive edge when model prob beats the odds', () => {
    // model 60% YES at odd 2.0 → edge = 0.6*2 - 1 = 0.2
    const v = computeValue(0.6, { bttsYes: 2.0, bttsNo: 2.0 });
    expect(v.yes?.edge).toBeCloseTo(0.2, 5);
    expect(v.no?.edge).toBeCloseTo(-0.2, 5); // 0.4*2 - 1
    expect(v.best).toBe('yes');
  });

  it('picks NÃO when only that side has value', () => {
    const v = computeValue(0.3, { bttsYes: 2.0, bttsNo: 2.0 }); // no = 0.7*2-1 = 0.4
    expect(v.best).toBe('no');
  });

  it('returns no best when neither side has positive edge', () => {
    const v = computeValue(0.5, { bttsYes: 1.8, bttsNo: 1.8 }); // both 0.5*1.8-1=-0.1
    expect(v.best).toBeUndefined();
  });

  it('omits sides without usable odds', () => {
    const v = computeValue(0.6, { bttsYes: 2.0 });
    expect(v.yes).toBeDefined();
    expect(v.no).toBeUndefined();
  });
});
