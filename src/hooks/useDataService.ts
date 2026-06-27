import { useMemo } from 'react';
import { DataService } from '@/data/DataService';
import { useSettings } from '@/store/settingsStore';

/** Build a DataService bound to the current settings (provider + key). */
export function useDataService(): DataService {
  const providerId = useSettings((s) => s.providerId);
  const apiKeys = useSettings((s) => s.apiKeys);
  const corsProxy = useSettings((s) => s.corsProxy);
  const autoFallback = useSettings((s) => s.autoFallback);

  return useMemo(
    () =>
      new DataService({
        providerId,
        apiKeys,
        corsProxy,
        autoFallback,
      }),
    [providerId, apiKeys, corsProxy, autoFallback],
  );
}
