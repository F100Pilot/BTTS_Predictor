import { describe, it, expect } from 'vitest';
import { tierForProbability } from './classification';

describe('tierForProbability', () => {
  it('classifies on the thresholds', () => {
    expect(tierForProbability(0.85)).toBe('very-strong');
    expect(tierForProbability(0.72)).toBe('strong');
    expect(tierForProbability(0.64)).toBe('medium');
    expect(tierForProbability(0.55)).toBe('weak');
  });

  it('classifies on the rounded shown percentage (no off-by-one vs the displayed %)', () => {
    // 0.596 shows "60%" → must be Média, not Fraca.
    expect(tierForProbability(0.596)).toBe('medium');
    // 0.594 shows "59%" → still Fraca.
    expect(tierForProbability(0.594)).toBe('weak');
    // 0.798 shows "80%" → Muito Forte.
    expect(tierForProbability(0.798)).toBe('very-strong');
    // 0.696 shows "70%" → Forte.
    expect(tierForProbability(0.696)).toBe('strong');
  });
});
