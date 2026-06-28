import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mutable fake-provider state, shared with the mocked registry below.
const h = vi.hoisted(() => ({
  p1: { id: 'p1', calls: 0, fail: false, configured: true },
  p2: { id: 'p2', calls: 0, fail: false, configured: true },
}));

// Bypass the IndexedDB-backed cache: just run the producer.
vi.mock('./cache/cache', () => ({
  cached: (_key: string, _ttl: number, fn: () => unknown) => fn(),
  isNonEmpty: (v: unknown) => (Array.isArray(v) ? v.length > 0 : v != null),
  TTL: { fixtures: 1, live: 1, teamHistory: 1, h2h: 1 },
}));

// Inject two controllable fake providers in place of the real registry.
vi.mock('./providers/registry', () => {
  const make = (s: { id: string; calls: number; fail: boolean; configured: boolean }) => ({
    id: s.id,
    label: s.id,
    capabilities: {},
    isConfigured: () => s.configured,
    getFixturesByDate: async () => {
      s.calls += 1;
      if (s.fail) throw new Error('boom');
      return [{ id: `${s.id}-fx` }];
    },
    getTeamRecentMatches: async () => {
      s.calls += 1;
      if (s.fail) throw new Error('boom');
      return [{ id: `${s.id}-m` }];
    },
    getHeadToHead: async () => [],
  });
  const p1 = make(h.p1);
  const p2 = make(h.p2);
  return {
    PROVIDERS: [p1, p2],
    DEFAULT_PROVIDER_ID: 'p1',
    getProvider: (id: string) => (id === 'p2' ? p2 : p1),
    realProviders: () => [p1, p2],
  };
});

import { DataService } from './DataService';

const svc = (over: Partial<ConstructorParameters<typeof DataService>[0]> = {}) =>
  new DataService({ providerId: 'p1', apiKeys: {}, corsProxy: '', autoFallback: true, ...over });

beforeEach(() => {
  Object.assign(h.p1, { calls: 0, fail: false, configured: true });
  Object.assign(h.p2, { calls: 0, fail: false, configured: true });
});

describe('DataService fixtures chain (withChain)', () => {
  it('uses the primary and does not call the fallback when it succeeds', async () => {
    const r = await svc().getFixturesByDate('2026-01-01');
    expect(r).toEqual([{ id: 'p1-fx' }]);
    expect(h.p2.calls).toBe(0);
  });

  it('cascades to the next provider when the primary fails', async () => {
    h.p1.fail = true;
    const r = await svc().getFixturesByDate('2026-01-01');
    expect(r).toEqual([{ id: 'p2-fx' }]);
    expect(h.p1.calls).toBe(1);
    expect(h.p2.calls).toBe(1);
  });

  it('does not fall back when autoFallback is off (and surfaces the error)', async () => {
    h.p1.fail = true;
    await expect(svc({ autoFallback: false }).getFixturesByDate('x')).rejects.toThrow();
    expect(h.p2.calls).toBe(0);
  });

  it('throws when every provider in the chain fails (getFixturesByDate)', async () => {
    h.p1.fail = true;
    h.p2.fail = true;
    await expect(svc().getFixturesByDate('x')).rejects.toThrow();
  });

  it('returns empty when nothing is configured', async () => {
    h.p1.configured = false;
    h.p2.configured = false;
    expect(await svc().getFixturesByDate('x')).toEqual([]);
  });
});

describe('DataService team-scoped lookup (withPrimary)', () => {
  it('stays on the primary provider only (no fallback)', async () => {
    const r = await svc().getTeamRecentMatches('t');
    expect(r).toEqual([{ id: 'p1-m' }]);
    expect(h.p2.calls).toBe(0);
  });

  it('returns empty on failure by default (no throw)', async () => {
    h.p1.fail = true;
    expect(await svc().getTeamRecentMatches('t')).toEqual([]);
    expect(h.p2.calls).toBe(0); // never falls back for team-scoped data
  });

  it('surfaces the error when throwOnError is set', async () => {
    h.p1.fail = true;
    await expect(svc().getTeamRecentMatches('t', 10, true)).rejects.toThrow();
  });
});
