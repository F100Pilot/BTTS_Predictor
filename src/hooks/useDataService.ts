import { useMemo } from 'react';
import { DataService } from '@/data/DataService';
import { useSettings } from '@/store/settingsStore';

/** Build a DataService bound to the current settings (provider + key). */
export function useDataService(): DataService {
  const providerId = useSettings((s) => s.providerId);
  const apiKeys = useSettings((s) => s.apiKeys);
  const corsProxy = useSettings((s) => s.corsProxy);
  const autoFallback = useSettings((s) => s.autoFallback);
  const rapidApiKey = useSettings((s) => s.rapidApiKey);

  return useMemo(
    () =>
      new DataService({
        providerId,
        // The Flashscore provider's key IS the dedicated RapidAPI key, so feed it
        // into the provider context under the 'flashscore' id (a generic key field
        // for it is redundant — Settings hides it).
        apiKeys: { ...apiKeys, flashscore: rapidApiKey || apiKeys.flashscore || '' },
        corsProxy,
        autoFallback,
      }),
    [providerId, apiKeys, corsProxy, autoFallback, rapidApiKey],
  );
}
