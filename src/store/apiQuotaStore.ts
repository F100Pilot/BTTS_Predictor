import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/** Latest known API rate-limit info for a provider (from response headers/body). */
export interface QuotaInfo {
  remaining?: number;
  limit?: number;
  /** Human label for the window, e.g. 'hoje', 'este minuto', 'esta hora'. */
  label: string;
  updatedAt: number;
}

interface QuotaState {
  byProvider: Record<string, QuotaInfo>;
}

export const useApiQuota = create<QuotaState>()(
  persist(() => ({ byProvider: {} }), { name: 'btts:apiquota' }),
);

/** Record the latest quota for a provider (called by providers after a request). */
export function recordQuota(providerId: string, info: QuotaInfo): void {
  useApiQuota.setState((s) => ({ byProvider: { ...s.byProvider, [providerId]: info } }));
}
