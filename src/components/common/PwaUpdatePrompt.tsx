import { useRegisterSW } from 'virtual:pwa-register/react';
import { Button } from '@/components/ui/button';

/** Non-intrusive prompt shown when a new service-worker version is available. */
export function PwaUpdatePrompt() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!offlineReady && !needRefresh) return null;

  const close = (): void => {
    setOfflineReady(false);
    setNeedRefresh(false);
  };

  return (
    <div className="fixed bottom-20 left-1/2 z-50 w-[92%] max-w-sm -translate-x-1/2 rounded-lg border bg-card p-4 shadow-lg md:bottom-6">
      <p className="mb-3 text-sm">
        {needRefresh ? 'Nova versão disponível.' : 'Aplicação pronta para funcionar offline.'}
      </p>
      <div className="flex justify-end gap-2">
        {needRefresh && (
          <Button size="sm" onClick={() => updateServiceWorker(true)}>
            Atualizar
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={close}>
          Fechar
        </Button>
      </div>
    </div>
  );
}
