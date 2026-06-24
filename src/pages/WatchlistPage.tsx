import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Eye, Trash2 } from 'lucide-react';
import { useCollections } from '@/store/collectionsStore';
import { removeWatchlist } from '@/data/cache/repositories';
import { EmptyState } from '@/components/common/States';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatDateTime } from '@/lib/format';
import { toPercent } from '@/lib/math';

export function WatchlistPage() {
  const { watchlist, refresh } = useCollections();

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const remove = async (id: string): Promise<void> => {
    await removeWatchlist(id);
    await refresh();
  };

  if (watchlist.length === 0)
    return (
      <EmptyState
        icon={<Eye className="h-8 w-8 text-muted-foreground" />}
        title="Watchlist vazia"
        description="Adicione jogos à lista de observação para acompanhar a evolução."
      />
    );

  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-bold">Watchlist</h1>
      {watchlist.map((w) => (
        <Card key={w.id}>
          <CardContent className="flex items-center justify-between gap-3 p-4">
            <Link to={`/analysis/${encodeURIComponent(w.id)}`} className="min-w-0 flex-1">
              <p className="truncate font-medium">{w.fixtureName}</p>
              <p className="text-xs text-muted-foreground">
                {w.competition} · {formatDateTime(w.date)} · BTTS {toPercent(w.probYes)}
              </p>
            </Link>
            <Button variant="ghost" size="icon" aria-label="Remover" onClick={() => remove(w.id)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
