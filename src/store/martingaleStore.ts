import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Bet, BetResult } from '@/domain/types';
import { activeSeries, calculateStake } from '@/core/martingale/martingale';
import { clearBets, listBets, putBet, removeBet } from '@/data/cache/repositories';
import { sanitizeNumber } from '@/services/sanitize';

export interface NewBetInput {
  matchLabel: string;
  market: string;
  selection: string;
  odds: number;
  fixtureId?: string;
}

interface MartingaleState {
  // Persisted settings
  initialBankroll: number;
  baseProfit: number;
  seriesResetAt: number;
  // Runtime
  bets: Bet[];
  loaded: boolean;

  refresh: () => Promise<void>;
  setSettings: (patch: { initialBankroll?: number; baseProfit?: number }) => void;
  nextStake: (odds: number) => number;
  addBet: (input: NewBetInput) => Promise<void>;
  setResult: (id: string, result: BetResult) => Promise<void>;
  deleteBet: (id: string) => Promise<void>;
  resetSeries: () => void;
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
      seriesResetAt: 0,
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
        })),

      nextStake: (odds) => {
        const { currentLoss } = activeSeries(get().bets, get().seriesResetAt);
        return calculateStake(currentLoss, get().baseProfit, odds);
      },

      addBet: async (input) => {
        const { currentLoss, step } = activeSeries(get().bets, get().seriesResetAt);
        const bet: Bet = {
          id: uid(),
          createdAt: Date.now(),
          fixtureId: input.fixtureId,
          matchLabel: input.matchLabel,
          market: input.market,
          selection: input.selection,
          odds: input.odds,
          stake: calculateStake(currentLoss, get().baseProfit, input.odds),
          step,
          result: 'pending',
        };
        await putBet(bet);
        await get().refresh();
      },

      setResult: async (id, result) => {
        const bet = get().bets.find((b) => b.id === id);
        if (!bet) return;
        await putBet({
          ...bet,
          result,
          settledAt: result === 'pending' ? undefined : Date.now(),
        });
        await get().refresh();
      },

      deleteBet: async (id) => {
        await removeBet(id);
        await get().refresh();
      },

      resetSeries: () => set({ seriesResetAt: Date.now() }),

      clearAll: async () => {
        await clearBets();
        set({ seriesResetAt: Date.now() });
        await get().refresh();
      },
    }),
    {
      name: 'btts:martingale',
      partialize: (s) => ({
        initialBankroll: s.initialBankroll,
        baseProfit: s.baseProfit,
        seriesResetAt: s.seriesResetAt,
      }),
    },
  ),
);
