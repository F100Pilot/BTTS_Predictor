import { describe, it, expect } from 'vitest';
import { chunkDateRange } from './DataService';

describe('chunkDateRange', () => {
  it('returns a single window when the range fits', () => {
    expect(chunkDateRange('2026-06-01', '2026-06-05', 10)).toEqual([
      { from: '2026-06-01', to: '2026-06-05' },
    ]);
  });

  it('splits a month into ≤10-day windows', () => {
    const windows = chunkDateRange('2026-06-01', '2026-06-30', 10);
    expect(windows).toEqual([
      { from: '2026-06-01', to: '2026-06-10' },
      { from: '2026-06-11', to: '2026-06-20' },
      { from: '2026-06-21', to: '2026-06-30' },
    ]);
  });

  it('handles a single-day range', () => {
    expect(chunkDateRange('2026-06-15', '2026-06-15', 10)).toEqual([
      { from: '2026-06-15', to: '2026-06-15' },
    ]);
  });
});
