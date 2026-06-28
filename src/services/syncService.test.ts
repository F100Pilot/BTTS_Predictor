import { describe, it, expect } from 'vitest';
import { mergeHistory, mergeBets, mergeTombstones, generateSyncCode } from './syncService';
import type { BetRecord, HistoryRecord, TombstoneRecord } from '@/data/cache/db';

const hist = (id: string, over: Partial<HistoryRecord> = {}): HistoryRecord => ({
  id,
  fixtureId: id,
  fixtureName: 'A vs B',
  competition: 'X',
  date: '2026-01-01T00:00:00Z',
  probYes: 0.5,
  probNo: 0.5,
  confidence: 5,
  tier: 'medium',
  createdAt: 1,
  ...over,
});

const bet = (id: string, over: Partial<BetRecord> = {}): BetRecord => ({
  id,
  createdAt: 1,
  matchLabel: 'A vs B',
  market: 'BTTS',
  selection: 'SIM',
  odds: 1.8,
  stake: 10,
  step: 0,
  result: 'pending',
  ...over,
});

const tomb = (id: string, at: number, kind: 'history' | 'bets' = 'history'): TombstoneRecord => ({
  key: `${kind}:${id}`,
  id,
  kind,
  at,
});

describe('mergeHistory', () => {
  it('unions by id and keeps a settled record over an unsettled one', () => {
    const local = [hist('a'), hist('b', { actual: 'yes' })];
    const remote = [hist('a', { actual: 'no', actualScore: '1-1' }), hist('c')];
    const out = mergeHistory(local, remote);
    const byId = Object.fromEntries(out.map((r) => [r.id, r]));
    expect(Object.keys(byId).sort()).toEqual(['a', 'b', 'c']);
    expect(byId.a!.actual).toBe('no'); // remote settled beats local unsettled
    expect(byId.b!.actual).toBe('yes'); // local settled kept (remote absent)
  });

  it('keeps the local record when it is already settled', () => {
    const local = [hist('a', { actual: 'yes' })];
    const remote = [hist('a', { actual: 'no' })];
    expect(mergeHistory(local, remote)[0]!.actual).toBe('yes');
  });
});

describe('mergeBets', () => {
  it('keeps the more-recently-settled bet, unions the rest', () => {
    const local = [bet('a', { result: 'won', settledAt: 100 }), bet('b')];
    const remote = [bet('a', { result: 'lost', settledAt: 200 }), bet('c')];
    const byId = Object.fromEntries(mergeBets(local, remote).map((b) => [b.id, b]));
    expect(Object.keys(byId).sort()).toEqual(['a', 'b', 'c']);
    expect(byId.a!.result).toBe('lost'); // newer settledAt wins
  });

  it('treats a missing settledAt as oldest (pending does not clobber settled)', () => {
    const local = [bet('a', { result: 'won', settledAt: 100 })];
    const remote = [bet('a')]; // pending, no settledAt
    expect(mergeBets(local, remote)[0]!.result).toBe('won');
  });
});

describe('mergeTombstones', () => {
  it('unions by key and keeps the newest deletion time', () => {
    const local = [tomb('a', 100), tomb('b', 50)];
    const remote = [tomb('a', 300), tomb('c', 10)];
    const byKey = Object.fromEntries(mergeTombstones(local, remote).map((t) => [t.key, t]));
    expect(Object.keys(byKey).sort()).toEqual(['history:a', 'history:b', 'history:c']);
    expect(byKey['history:a']!.at).toBe(300);
  });
});

describe('generateSyncCode', () => {
  it('produces a 16-char code from the safe alphabet, unique each call', () => {
    const a = generateSyncCode();
    const b = generateSyncCode();
    expect(a).toMatch(/^[abcdefghijkmnpqrstuvwxyz23456789]{16}$/);
    expect(a).not.toBe(b);
  });
});
