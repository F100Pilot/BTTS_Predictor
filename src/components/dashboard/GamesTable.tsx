import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Star, Eye, ListPlus, Check } from 'lucide-react';
import type { DashboardRow } from '@/domain/types';
import type { HistoryRecord } from '@/data/cache/db';
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
import { bttsVerdict } from '@/core/classification/classification';
import { formatTime } from '@/lib/format';
import { toPercent, round } from '@/lib/math';
import { useCollections } from '@/store/collectionsStore';
import { useSettings } from '@/store/settingsStore';
import { upsertHistory } from '@/data/cache/repositories';
import { rowEdge } from '@/components/dashboard/filters';
import { createLogger } from '@/services/logger';
import { cn } from '@/lib/utils';

const log = createLogger('GamesTable');

/** Build a history record from an analysed dashboard row. */
function toHistoryRecord(row: DashboardRow, providerId: string): HistoryRecord | null {
  const { fixture, prediction } = row;
  if (!prediction) return null;
  return {
    id: fixture.id,
    fixtureId: fixture.id,
    fixtureName: `${fixture.home.name} vs ${fixture.away.name}`,
    competition: fixture.competition.name,
    date: fixture.date,
    probYes: prediction.probYes,
    probNo: prediction.probNo,
    confidence: prediction.confidence,
    tier: prediction.tier,
    createdAt: Date.now(),
    providerId,
    factorScores: Object.fromEntries(prediction.factors.map((f) => [f.key, f.score])),
  };
}

export function GamesTable({ rows }: { rows: DashboardRow[] }) {
  const navigate = useNavigate();
  const { toggleFavorite, toggleWatchlist, isFavorite, isWatched } = useCollections();
  const providerId = useSettings((s) => s.providerId);
  const [added, setAdded] = useState<Set<string>>(new Set());

  const addToHistory = (row: DashboardRow): void => {
    const record = toHistoryRecord(row, providerId);
    if (!record) return;
    void upsertHistory(record)
      .then(() => setAdded((prev) => new Set(prev).add(row.fixture.id)))
      .catch((err) => log.warn('add to history failed', err));
  };

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
          <TableHead className="hidden sm:table-cell">Valor</TableHead>
          <TableHead className="w-28 text-right">Ações</TableHead>
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
                {row.prediction ? (
                  (() => {
                    // Show the dominant side with its (higher) probability so it's
                    // unambiguous whether the model leans SIM or NÃO.
                    const v = bttsVerdict(row.prediction.probYes);
                    return (
                      <span
                        className={
                          v.side === 'SIM' ? 'font-semibold text-primary' : 'font-semibold'
                        }
                      >
                        {v.side} {toPercent(v.probability)}
                      </span>
                    );
                  })()
                ) : (
                  <span className="text-xs text-muted-foreground">
                    {row.predictionError ? 'indisp.' : '…'}
                  </span>
                )}
              </TableCell>
              <TableCell className="hidden md:table-cell">
                {row.prediction ? <TierBadge tier={row.prediction.tier} /> : <span>—</span>}
              </TableCell>
              <TableCell className="hidden lg:table-cell">
                {row.prediction ? (
                  <ConfidenceMeter confidence={row.prediction.confidence} />
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell className="hidden sm:table-cell">
                {(() => {
                  const edge = rowEdge(row);
                  if (edge == null) return <span className="text-muted-foreground">—</span>;
                  return (
                    <span
                      className={edge > 0 ? 'font-semibold text-success' : 'text-muted-foreground'}
                    >
                      {edge > 0 ? '+' : ''}
                      {round(edge * 100, 1)}%
                    </span>
                  );
                })()}
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
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Adicionar ao histórico"
                    title="Adicionar ao histórico"
                    disabled={!row.prediction || added.has(row.fixture.id)}
                    onClick={() => addToHistory(row)}
                  >
                    {added.has(row.fixture.id) ? (
                      <Check className="h-4 w-4 text-success" />
                    ) : (
                      <ListPlus className="h-4 w-4" />
                    )}
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
