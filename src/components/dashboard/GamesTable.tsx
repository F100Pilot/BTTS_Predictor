import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Star, Eye, ListPlus, Check } from 'lucide-react';
import type { DashboardRow } from '@/domain/types';
import type { HistoryRecord } from '@/data/cache/db';
import { Button } from '@/components/ui/button';
import { TierBadge } from '@/components/common/PredictionWidgets';
import { bttsVerdict } from '@/core/classification/classification';
import { formatTime } from '@/lib/format';
import { toPercent, round } from '@/lib/math';
import { useCollections } from '@/store/collectionsStore';
import { useSettings } from '@/store/settingsStore';
import { upsertHistory, listHistory } from '@/data/cache/repositories';
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

/** BTTS verdict pill — green for SIM, red for NÃO, neutral while unknown. */
function VerdictPill({ row }: { row: DashboardRow }) {
  if (!row.prediction) {
    return (
      <span className="rounded-full border border-border bg-muted/50 px-3 py-1 text-xs font-medium text-muted-foreground">
        {row.predictionError ? 'indisponível' : 'a analisar…'}
      </span>
    );
  }
  const v = bttsVerdict(row.prediction.probYes);
  return (
    <span
      className={cn(
        'rounded-full border px-3 py-1 text-sm font-bold tabular-nums',
        v.side === 'SIM'
          ? 'border-success/30 bg-success/15 text-success'
          : 'border-destructive/30 bg-destructive/15 text-destructive',
      )}
    >
      {v.side} {toPercent(v.probability)}
    </span>
  );
}

export function GamesTable({ rows }: { rows: DashboardRow[] }) {
  const navigate = useNavigate();
  const { toggleFavorite, toggleWatchlist, isFavorite, isWatched } = useCollections();
  const providerId = useSettings((s) => s.providerId);
  // Fixtures already saved to history (persisted from any session) plus those
  // added in this one — so the "in history" check survives a reload.
  const [saved, setSaved] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    void listHistory()
      .then((records) => {
        if (cancelled) return;
        setSaved(new Set(records.map((r) => r.fixtureId || r.id)));
      })
      .catch((err) => log.warn('load history ids failed', err));
    return () => {
      cancelled = true;
    };
  }, [rows]);

  const addToHistory = (row: DashboardRow): void => {
    const record = toHistoryRecord(row, providerId);
    if (!record) return;
    void upsertHistory(record)
      .then(() => setSaved((prev) => new Set(prev).add(row.fixture.id)))
      .catch((err) => log.warn('add to history failed', err));
  };

  const open = (id: string): void => navigate(`/analysis/${encodeURIComponent(id)}`);

  return (
    <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-2">
      {rows.map((row) => {
        const { fixture } = row;
        const fav = isFavorite(fixture.id);
        const watched = isWatched(fixture.id);
        const inHistory = saved.has(fixture.id);
        const edge = rowEdge(row);
        return (
          <div
            key={fixture.id}
            role="button"
            tabIndex={0}
            onClick={() => open(fixture.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                open(fixture.id);
              }
            }}
            className="group cursor-pointer rounded-2xl border border-border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-accent/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-semibold tabular-nums text-foreground">
                    {formatTime(fixture.date)}
                  </span>
                  <span className="truncate">
                    {fixture.competition.country ? `${fixture.competition.country} · ` : ''}
                    {fixture.competition.name}
                  </span>
                  {inHistory && (
                    <Check
                      className="h-3.5 w-3.5 shrink-0 text-success"
                      aria-label="No histórico"
                    />
                  )}
                </div>
                <div className="mt-1.5 truncate text-[0.95rem] font-semibold">
                  {fixture.home.name} <span className="text-muted-foreground">vs</span>{' '}
                  {fixture.away.name}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {row.prediction && <TierBadge tier={row.prediction.tier} />}
                  {edge != null && edge > 0 && (
                    <span className="text-xs font-semibold text-success">
                      valor +{round(edge * 100, 1)}%
                    </span>
                  )}
                  {row.prediction && (
                    <span className="text-xs text-muted-foreground">
                      conf. {row.prediction.confidence}/10
                    </span>
                  )}
                </div>
              </div>

              <div className="flex shrink-0 flex-col items-end gap-2">
                <VerdictPill row={row} />
                <div className="flex items-center" onClick={(e) => e.stopPropagation()}>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    aria-label="Favorito"
                    onClick={() => toggleFavorite(row)}
                  >
                    <Star className={cn('h-4 w-4', fav && 'fill-warning text-warning')} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    aria-label="Watchlist"
                    onClick={() => toggleWatchlist(row)}
                  >
                    <Eye className={cn('h-4 w-4', watched && 'text-primary')} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    aria-label={inHistory ? 'Já no histórico' : 'Adicionar ao histórico'}
                    title={inHistory ? 'Já no histórico' : 'Adicionar ao histórico'}
                    disabled={!row.prediction || inHistory}
                    onClick={() => addToHistory(row)}
                  >
                    {inHistory ? (
                      <Check className="h-4 w-4 text-success" />
                    ) : (
                      <ListPlus className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
