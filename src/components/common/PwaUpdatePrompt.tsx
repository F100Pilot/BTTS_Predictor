import { useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { createLogger } from '@/services/logger';

const log = createLogger('pwa');

// How often to check the server for a newer service worker (long-open sessions).
const UPDATE_CHECK_INTERVAL = 60 * 60 * 1000; // 1h

/**
 * Registers the service worker in auto-update mode: when a new version is
 * detected it is applied and the page reloads automatically — no user prompt.
 */
export function PwaUpdatePrompt() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;
      // Periodically poll for a newer SW so long-lived tabs/PWAs self-update.
      setInterval(() => {
        registration.update().catch((err) => log.warn('SW update check failed', err));
      }, UPDATE_CHECK_INTERVAL);
    },
    onRegisterError(err) {
      log.error('SW registration failed', err);
    },
  });

  useEffect(() => {
    if (needRefresh) {
      log.info('new version detected — applying and reloading');
      void updateServiceWorker(true); // activate new SW and reload
    }
  }, [needRefresh, updateServiceWorker]);

  return null;
}
