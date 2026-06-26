import { Gauge } from 'lucide-react';
import { useApiQuota } from '@/store/apiQuotaStore';
import { useSettings } from '@/store/settingsStore';
import { cn } from '@/lib/utils';

/**
 * Shows the remaining API requests for the active provider's current window,
 * as reported by the source (headers/body). Hidden when unknown or on demo data.
 */
export function QuotaBadge({ className }: { className?: string }) {
  const providerId = useSettings((s) => s.providerId);
  const info = useApiQuota((s) => s.byProvider[providerId]);

  if (providerId === 'mock' || !info || info.remaining == null) return null;

  const low = info.limit ? info.remaining / info.limit < 0.2 : info.remaining <= 2;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs',
        low ? 'border-warning/50 bg-warning/10 text-warning' : 'text-muted-foreground',
        className,
      )}
      title="Pedidos à API ainda disponíveis na janela atual (reportado pela fonte)"
    >
      <Gauge className="h-3.5 w-3.5" />
      Pedidos restantes: {info.remaining}
      {info.limit ? `/${info.limit}` : ''} ({info.label})
    </span>
  );
}
