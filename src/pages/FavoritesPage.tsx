import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Star, Trash2 } from 'lucide-react';
import { useCollections } from '@/store/collectionsStore';
import { removeFavorite } from '@/data/cache/repositories';
import { EmptyState } from '@/components/common/States';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatDateTime } from '@/lib/format';
import { toPercent } from '@/lib/math';

export function FavoritesPage() {
  const { favorites, refresh } = useCollections();

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const remove = async (id: string): Promise<void> => {
    await removeFavorite(id);
    await refresh();
  };

  if (favorites.length === 0)
    return (
      <EmptyState
        icon={<Star className="h-8 w-8 text-muted-foreground" />}
        title="Sem favoritos"
        description="Marque jogos como favoritos no painel para os encontrar aqui."
      />
    );

  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-bold">Favoritos</h1>
      {favorites.map((f) => (
        <Card key={f.id}>
          <CardContent className="flex items-center justify-between gap-3 p-4">
            <Link to={`/analysis/${encodeURIComponent(f.id)}`} className="min-w-0 flex-1">
              <p className="truncate font-medium">{f.fixtureName}</p>
              <p className="text-xs text-muted-foreground">
                {f.competition} · {formatDateTime(f.date)} · BTTS {toPercent(f.probYes)}
              </p>
            </Link>
            <Button variant="ghost" size="icon" aria-label="Remover" onClick={() => remove(f.id)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
