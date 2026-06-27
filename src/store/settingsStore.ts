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
  /** RapidAPI key for Flashscore import in the Calculator (device-local only). */
  rapidApiKey: string;
  /** Shared secret that namespaces this user's synced history/bets in the
   * worker's KV. Empty = sync off. Same code on every device = same data. */
  syncCode: string;
  /** Try other configured providers automatically when the primary fails. */
  autoFallback: boolean;
  theme: ThemeMode;
  favoriteCompetition: string; // pinned league name ('' = none)
  /** Exclude amateur/youth/friendly/reserve competitions before analysis. */
  hideAmateur: boolean;
  /** Keep only top leagues + world/continental tournaments before analysis. */
  majorOnly: boolean;
  /** Hide (and skip analysing) fixtures whose kickoff is already in the past. */
  hideStarted: boolean;
  /** How many fixtures to analyse per batch (kickoff order). 0 = analyse all. */
  analysisBatchSize: number;
  weights: Record<FactorKey, number>;
  /** Market-odds calibration weight (0 = pure model, 1 = pure market). */
  oddsCalibration: number;
  /** Auto-calibrate predictions from settled history (Platt recalibration). */
  autoCalibrate: boolean;
  /** Live notifications master switch + per-type toggles. */
  notifyEnabled: boolean;
  notifyGoals: boolean;
  notifyWatchlistBtts: boolean;
  notifyPregame: boolean;
  notifyPregameMinutes: number;
  setProvider: (id: string) => void;
  setApiKey: (providerId: string, key: string) => void;
  setCorsProxy: (value: string) => void;
  setRapidApiKey: (value: string) => void;
  setSyncCode: (value: string) => void;
  setAutoFallback: (value: boolean) => void;
  setTheme: (theme: ThemeMode) => void;
  setFavoriteCompetition: (name: string) => void;
  setHideAmateur: (value: boolean) => void;
  setMajorOnly: (value: boolean) => void;
  setHideStarted: (value: boolean) => void;
  setAnalysisBatchSize: (value: number) => void;
  setWeights: (weights: Record<FactorKey, number>) => void;
  resetWeights: () => void;
  setOddsCalibration: (value: number) => void;
  setAutoCalibrate: (value: boolean) => void;
  setNotify: (patch: {
    notifyEnabled?: boolean;
    notifyGoals?: boolean;
    notifyWatchlistBtts?: boolean;
    notifyPregame?: boolean;
    notifyPregameMinutes?: number;
  }) => void;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      providerId: DEFAULT_PROVIDER_ID,
      apiKeys: {},
      corsProxy: '',
      rapidApiKey: '',
      syncCode: '',
      autoFallback: true,
      theme: 'system',
      favoriteCompetition: '',
      hideAmateur: true,
      majorOnly: true,
      hideStarted: true,
      analysisBatchSize: 0, // 0 = analyse all (no per-day limit)
      weights: { ...DEFAULT_WEIGHTS },
      oddsCalibration: 0,
      autoCalibrate: false,
      notifyEnabled: false,
      notifyGoals: true,
      notifyWatchlistBtts: true,
      notifyPregame: true,
      notifyPregameMinutes: 30,
      setProvider: (id) => set({ providerId: id }),
      setApiKey: (providerId, key) =>
        set((s) => ({ apiKeys: { ...s.apiKeys, [providerId]: sanitizeApiKey(key) } })),
      setCorsProxy: (value) => set({ corsProxy: value.trim() }),
      setRapidApiKey: (value) => set({ rapidApiKey: sanitizeApiKey(value) }),
      setSyncCode: (value) => set({ syncCode: value.trim() }),
      setAutoFallback: (value) => set({ autoFallback: value }),
      setTheme: (theme) => set({ theme }),
      setFavoriteCompetition: (name) => set({ favoriteCompetition: name }),
      setHideAmateur: (value) => set({ hideAmateur: value }),
      setMajorOnly: (value) => set({ majorOnly: value }),
      setHideStarted: (value) => set({ hideStarted: value }),
      setAnalysisBatchSize: (value) => set({ analysisBatchSize: Math.max(0, Math.round(value)) }),
      setWeights: (weights) => set({ weights }),
      resetWeights: () => set({ weights: { ...DEFAULT_WEIGHTS } }),
      setOddsCalibration: (value) => set({ oddsCalibration: Math.min(1, Math.max(0, value)) }),
      setAutoCalibrate: (value) => set({ autoCalibrate: value }),
      setNotify: (patch) =>
        set((s) => ({
          notifyEnabled: patch.notifyEnabled ?? s.notifyEnabled,
          notifyGoals: patch.notifyGoals ?? s.notifyGoals,
          notifyWatchlistBtts: patch.notifyWatchlistBtts ?? s.notifyWatchlistBtts,
          notifyPregame: patch.notifyPregame ?? s.notifyPregame,
          notifyPregameMinutes:
            patch.notifyPregameMinutes != null
              ? Math.min(180, Math.max(5, patch.notifyPregameMinutes))
              : s.notifyPregameMinutes,
        })),
    }),
    {
      name: 'btts:settings',
      version: 2,
      // v1: drop the per-day analysis cap — analyse all matching fixtures by
      //     default. Reset existing installs that still carry the old 20 limit.
      // v2: the demo ("mock") source was removed — migrate anyone still on it to
      //     the default real provider so the picker isn't left blank.
      migrate: (persisted, version) => {
        const state = persisted as (Partial<SettingsState> & { providerId?: string }) | undefined;
        if (state && version < 1) state.analysisBatchSize = 0;
        if (state && version < 2 && state.providerId === 'mock') {
          state.providerId = DEFAULT_PROVIDER_ID;
        }
        return state as SettingsState;
      },
    },
  ),
);
