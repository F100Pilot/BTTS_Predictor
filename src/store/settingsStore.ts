import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEFAULT_PROVIDER_ID } from '@/data/providers/registry';
import { DEFAULT_WEIGHTS, type FactorKey } from '@/core/prediction/weights';
import { sanitizeApiKey } from '@/services/sanitize';

export type ThemeMode = 'light' | 'dark' | 'system';

interface SettingsState {
  providerId: string;
  apiKeys: Record<string, string>; // providerId -> key (device-local only)
  corsProxy: string; // optional CORS proxy for providers without CORS headers
  fallbackToMock: boolean;
  theme: ThemeMode;
  weights: Record<FactorKey, number>;
  /** Market-odds calibration weight (0 = pure model, 1 = pure market). */
  oddsCalibration: number;
  /** Auto-calibrate predictions from settled history (Platt recalibration). */
  autoCalibrate: boolean;
  setProvider: (id: string) => void;
  setApiKey: (providerId: string, key: string) => void;
  setCorsProxy: (value: string) => void;
  setFallbackToMock: (value: boolean) => void;
  setTheme: (theme: ThemeMode) => void;
  setWeights: (weights: Record<FactorKey, number>) => void;
  resetWeights: () => void;
  setOddsCalibration: (value: number) => void;
  setAutoCalibrate: (value: boolean) => void;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      providerId: DEFAULT_PROVIDER_ID,
      apiKeys: {},
      corsProxy: '',
      fallbackToMock: true,
      theme: 'system',
      weights: { ...DEFAULT_WEIGHTS },
      oddsCalibration: 0,
      autoCalibrate: false,
      setProvider: (id) => set({ providerId: id }),
      setApiKey: (providerId, key) =>
        set((s) => ({ apiKeys: { ...s.apiKeys, [providerId]: sanitizeApiKey(key) } })),
      setCorsProxy: (value) => set({ corsProxy: value.trim() }),
      setFallbackToMock: (value) => set({ fallbackToMock: value }),
      setTheme: (theme) => set({ theme }),
      setWeights: (weights) => set({ weights }),
      resetWeights: () => set({ weights: { ...DEFAULT_WEIGHTS } }),
      setOddsCalibration: (value) => set({ oddsCalibration: Math.min(1, Math.max(0, value)) }),
      setAutoCalibrate: (value) => set({ autoCalibrate: value }),
    }),
    { name: 'btts:settings' },
  ),
);
