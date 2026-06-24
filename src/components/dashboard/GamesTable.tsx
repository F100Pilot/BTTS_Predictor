import { useNavigate } from 'react-router-dom';
import { Star, Eye } from 'lucide-react';
import type { DashboardRow } from '@/domain/types';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { TierBadge, ConfidenceMeter } from '@/components/common/PredictionWidgets';
import { formatTime } from '@/lib/format';
import { toPercent } from '@/lib/math';
import { useCollections } from '@/store/collectionsStore';
import { cn } from '@/lib/utils';

export function GamesTable({ rows }: { rows: DashboardRow[] }) {
  const navigate = useNavigate();
  const { toggleFavorite, toggleWatchlist, isFavorite, isWatched } = useCollections();

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-14">Hora</TableHead>
          <TableHead className="hidden sm:table-cell">Competição</TableHead>
          <TableHead>Jogo</TableHead>
          <TableHead className="w-28">BTTS</TableHead>
          <TableHead className="hidden md:table-cell">Classificação</TableHead>
          <TableHead className="hidden lg:table-cell">Confiança</TableHead>
          <TableHead className="w-20 text-right">Ações</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => {
          const fav = isFavorite(row.fixture.id);
          const watched = isWatched(row.fixture.id);
          return (
            <TableRow
              key={row.fixture.id}
              className="cursor-pointer"
              onClick={() => navigate(`/analysis/${encodeURIComponent(row.fixture.id)}`)}
            >
              <TableCell className="font-medium">{formatTime(row.fixture.date)}</TableCell>
              <TableCell className="hidden text-muted-foreground sm:table-cell">
                {row.fixture.competition.name}
              </TableCell>
              <TableCell>
                <div className="font-medium">
                  {row.fixture.home.name} <span className="text-muted-foreground">vs</span>{' '}
                  {row.fixture.away.name}
                </div>
                <div className="text-xs text-muted-foreground sm:hidden">
                  {row.fixture.competition.name}
                </div>
              </TableCell>
              <TableCell>
                <span className="font-semibold text-primary">
                  {toPercent(row.prediction.probYes)}
                </span>
              </TableCell>
              <TableCell className="hidden md:table-cell">
                <TierBadge tier={row.prediction.tier} />
              </TableCell>
              <TableCell className="hidden lg:table-cell">
                <ConfidenceMeter confidence={row.prediction.confidence} />
              </TableCell>
              <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                <div className="flex justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Favorito"
                    onClick={() => toggleFavorite(row)}
                  >
                    <Star className={cn('h-4 w-4', fav && 'fill-warning text-warning')} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Watchlist"
                    onClick={() => toggleWatchlist(row)}
                  >
                    <Eye className={cn('h-4 w-4', watched && 'text-primary')} />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
