import { useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { RefreshCw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createLogger } from '@/services/logger';

const log = createLogger('pwa');

// How often to check the server for a newer service worker (long-open sessions).
const UPDATE_CHECK_INTERVAL = 60 * 60 * 1000; // 1h

/**
 * Registers the service worker and, when a new version is available, shows a
 * non-intrusive banner so the user updates on THEIR terms. Previously the page
 * reloaded automatically, which could interrupt work mid-session — hence the
 * repeated "had to force refresh" experience.
 */
export function PwaUpdatePrompt() {
  const [dismissed, setDismissed] = useState(false);
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;
      // Periodically poll for a newer SW so long-lived tabs/PWAs notice updates.
      setInterval(() => {
        registration.update().catch((err) => log.warn('SW update check failed', err));
      }, UPDATE_CHECK_INTERVAL);
    },
    onRegisterError(err) {
      log.error('SW registration failed', err);
    },
  });

  if (!needRefresh || dismissed) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 flex justify-center p-3">
      <div className="flex w-full max-w-md items-center gap-3 rounded-lg border bg-card p-3 shadow-lg">
        <RefreshCw className="h-5 w-5 shrink-0 text-primary" />
        <div className="flex-1 text-sm">
          <p className="font-medium">Nova versão disponível</p>
          <p className="text-xs text-muted-foreground">
            Atualiza para obteres as últimas correções.
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => {
            log.info('user accepted update — reloading');
            void updateServiceWorker(true); // activate new SW and reload
          }}
        >
          Atualizar
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Mais tarde"
          onClick={() => setDismissed(true)}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
