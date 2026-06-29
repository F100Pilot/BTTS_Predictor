import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { MarketKey } from '@/core/markets/markets';

interface MarketState {
  /** Currently selected betting market, shared by Jogos and Histórico. */
  market: MarketKey;
  setMarket: (market: MarketKey) => void;
}

export const useMarket = create<MarketState>()(
  persist(
    (set) => ({
      market: 'btts',
      setMarket: (market) => set({ market }),
    }),
    { name: 'btts:market' },
  ),
);
