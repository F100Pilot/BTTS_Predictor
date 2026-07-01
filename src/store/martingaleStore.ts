import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Bet, BetResult } from '@/domain/types';
import type { MarketKey } from '@/core/markets/markets';
import { activeSeries, calculateStake, betsForMarket } from '@/core/martingale/martingale';
import { clearBets, listBets, putBet, removeBet } from '@/data/cache/repositories';
import { sanitizeNumber } from '@/services/sanitize';
import { useSettings } from '@/store/settingsStore';

// Re-exported so components can group bets by market from the store module.
export { betsForMarket };

export interface NewBetInput {
  matchLabel: string;
  market: string;
  /** Which market series this bet belongs to. */
  marketKey: MarketKey;
  selection: string;
  odds: number;
  fixtureId?: string;
  /** Flashscore match id, when the bet came from a Flashscore import. */
  flashMatchId?: string;
  /** Kickoff date-time (ISO) of the game, when known. */
  kickoff?: string;
}

interface MartingaleState {
  // Persisted settings
  initialBankroll: number;
  baseProfit: number;
  maxStakePct: number; // % of current bankroll above which the stake is flagged (0 = off)
  maxStep: number; // safety brake: block new bets once the series reaches this step (0 = off)
  /** Per-market "reset series" timestamps; bets before it are ignored. */
  seriesResetAt: Partial<Record<MarketKey, number>>;
  // Runtime
  bets: Bet[];
  loaded: boolean;

  refresh: () => Promise<void>;
  setSettings: (patch: {
    initialBankroll?: number;
    baseProfit?: number;
    maxStakePct?: number;
    maxStep?: number;
  }) => void;
  nextStake: (odds: number, market: MarketKey) => number;
  addBet: (input: NewBetInput) => Promise<void>;
  setResult: (id: string, result: BetResult, score?: string) => Promise<void>;
  deleteBet: (id: string) => Promise<void>;
  resetSeries: (market: MarketKey) => void;
  clearAll: () => Promise<void>;
}

function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `bet-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

export const useMartingale = create<MartingaleState>()(
  persist(
    (set, get) => ({
      initialBankroll: 100,
      baseProfit: 10,
      maxStakePct: 25,
      maxStep: 6,
      seriesResetAt: {},
      bets: [],
      loaded: false,

      refresh: async () => {
        const bets = await listBets();
        set({ bets, loaded: true });
      },

      setSettings: (patch) =>
        set((s) => ({
          initialBankroll:
            patch.initialBankroll != null
              ? sanitizeNumber(patch.initialBankroll, {
                  min: 0,
                  max: 1e9,
                  fallback: s.initialBankroll,
                })
              : s.initialBankroll,
          baseProfit:
            patch.baseProfit != null
              ? sanitizeNumber(patch.baseProfit, { min: 0, max: 1e9, fallback: s.baseProfit })
              : s.baseProfit,
          maxStakePct:
            patch.maxStakePct != null
              ? sanitizeNumber(patch.maxStakePct, { min: 0, max: 100, fallback: s.maxStakePct })
              : s.maxStakePct,
          maxStep:
            patch.maxStep != null
              ? sanitizeNumber(patch.maxStep, { min: 0, max: 50, fallback: s.maxStep })
              : s.maxStep,
        })),

      nextStake: (odds, market) => {
        const { currentLoss } = activeSeries(
          betsForMarket(get().bets, market),
          get().seriesResetAt[market] ?? 0,
        );
        return calculateStake(currentLoss, get().baseProfit, odds);
      },

      addBet: async (input) => {
        const { currentLoss, step } = activeSeries(
          betsForMarket(get().bets, input.marketKey),
          get().seriesResetAt[input.marketKey] ?? 0,
        );
        const bet: Bet = {
          id: uid(),
          createdAt: Date.now(),
          fixtureId: input.fixtureId,
          providerId: input.fixtureId ? useSettings.getState().providerId : undefined,
          flashMatchId: input.flashMatchId,
          matchLabel: input.matchLabel,
          kickoff: input.kickoff,
          market: input.market,
          marketKey: input.marketKey,
          selection: input.selection,
          odds: input.odds,
          stake: calculateStake(currentLoss, get().baseProfit, input.odds),
          step,
          result: 'pending',
        };
        await putBet(bet);
        await get().refresh();
      },

      setResult: async (id, result, score) => {
        const bet = get().bets.find((b) => b.id === id);
        if (!bet) return;
        await putBet({
          ...bet,
          result,
          // Keep an explicitly-passed score; clear it when the bet is reset.
          score: result === 'pending' ? undefined : (score ?? bet.score),
          settledAt: result === 'pending' ? undefined : Date.now(),
        });
        await get().refresh();
      },

      deleteBet: async (id) => {
        await removeBet(id);
        await get().refresh();
      },

      resetSeries: (market) =>
        set((s) => ({ seriesResetAt: { ...s.seriesResetAt, [market]: Date.now() } })),

      clearAll: async () => {
        await clearBets();
        set({ seriesResetAt: {} });
        await get().refresh();
      },
    }),
    {
      name: 'btts:martingale',
      version: 1,
      // v1: seriesResetAt went from a single number to a per-market map.
      migrate: (persisted, version) => {
        const s = (persisted ?? {}) as Record<string, unknown>;
        if (version < 1 && typeof s.seriesResetAt === 'number') {
          s.seriesResetAt = s.seriesResetAt ? { btts: s.seriesResetAt } : {};
        }
        return s as unknown as MartingaleState;
      },
      partialize: (s) => ({
        initialBankroll: s.initialBankroll,
        baseProfit: s.baseProfit,
        maxStakePct: s.maxStakePct,
        maxStep: s.maxStep,
        seriesResetAt: s.seriesResetAt,
      }),
    },
  ),
);
