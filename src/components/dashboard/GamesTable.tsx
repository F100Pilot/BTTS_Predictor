import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ListPlus, Check } from 'lucide-react';
import type { DashboardRow } from '@/domain/types';
import type { HistoryRecord } from '@/data/cache/db';
import { IconAction } from '@/components/common/IconAction';
import { TierBadge } from '@/components/common/PredictionWidgets';
import { tierForProbability } from '@/core/classification/classification';
import { marketPick, type MarketKey, type MarketPick } from '@/core/markets/markets';
import { useMarket } from '@/store/marketStore';
import { formatTime } from '@/lib/format';
import { toPercent, round } from '@/lib/math';
import { useSettings } from '@/store/settingsStore';
import { upsertHistory, listHistory } from '@/data/cache/repositories';
import { rowEdge } from '@/components/dashboard/filters';
import { createLogger } from '@/services/logger';
import { cn } from '@/lib/utils';

const log = createLogger('GamesTable');

/** Build a history record from an analysed dashboard row, tracked for `market`. */
function toHistoryRecord(
  row: DashboardRow,
  providerId: string,
  market: MarketKey,
): HistoryRecord | null {
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
    markets: row.markets,
    trackedMarkets: [market],
  };
}

/** Pick pill for the selected market — tone-coloured (pos green / neg red / neutral). */
function MarketPill({
  pick,
  predictionError,
}: {
  pick: MarketPick | null;
  predictionError?: boolean;
}) {
  if (!pick) {
    return (
      <span className="shrink-0 rounded-full border border-border bg-muted/50 px-3 py-1 text-xs font-medium text-muted-foreground">
        {predictionError ? 'indisp.' : '…'}
      </span>
    );
  }
  const toneClass =
    pick.tone === 'pos'
      ? 'border-success/30 bg-success/15 text-success'
      : pick.tone === 'neg'
        ? 'border-destructive/30 bg-destructive/15 text-destructive'
        : 'border-primary/30 bg-primary/15 text-primary';
  return (
    <span
      className={cn(
        'shrink-0 rounded-full border px-3 py-1 text-sm font-bold tabular-nums',
        toneClass,
      )}
    >
      {pick.side} {toPercent(pick.probability)}
    </span>
  );
}

/** A single game banner (full-width row); the whole banner opens the analysis. */
function GameBanner({
  row,
  market,
  inHistory,
  onOpen,
  onAddHistory,
}: {
  row: DashboardRow;
  market: MarketKey;
  inHistory: boolean;
  onOpen: () => void;
  onAddHistory: () => void;
}) {
  const { fixture } = row;
  const pick = marketPick(market, row.prediction, row.markets);
  // The value edge ("+X%") only applies to BTTS (the only market with odds).
  const edge = market === 'btts' ? rowEdge(row) : null;
  // Tier: BTTS uses the calibrated stored tier; other markets classify the pick.
  const tier =
    market === 'btts'
      ? row.prediction?.tier
      : pick
        ? tierForProbability(pick.probability)
        : undefined;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen();
        }
      }}
      className="group flex flex-col gap-2 rounded-2xl border border-border bg-card p-3.5 transition-colors hover:border-primary/40 hover:bg-accent/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {/* Top line: kickoff time + competition (+ in-history check). */}
      <div className="flex items-center gap-2">
        <span className="shrink-0 text-sm font-bold tabular-nums">{formatTime(fixture.date)}</span>
        <span className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground">
          {fixture.competition.country ? `${fixture.competition.country} · ` : ''}
          {fixture.competition.name}
        </span>
        {inHistory && (
          <Check className="h-3.5 w-3.5 shrink-0 text-success" aria-label="No histórico" />
        )}
      </div>

      {/* Match name — full width so both teams always show in full. */}
      <div className="font-semibold leading-tight">
        {fixture.home.name} <span className="text-muted-foreground">vs</span> {fixture.away.name}
      </div>

      {/* Bottom line: verdict + meta on the left, actions on the right. */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <MarketPill pick={pick} predictionError={row.predictionError} />
          {tier && <TierBadge tier={tier} />}
          {edge != null && edge > 0 && (
            <span className="text-xs font-semibold text-success">+{round(edge * 100, 1)}%</span>
          )}
          {row.prediction && (
            <span className="text-xs text-muted-foreground">
              conf. {row.prediction.confidence}/10
            </span>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <IconAction
            size="sm"
            label={inHistory ? 'Já no histórico' : 'Adicionar ao histórico'}
            icon={
              inHistory ? (
                <Check className="h-4 w-4 text-success" />
              ) : (
                <ListPlus className="h-4 w-4" />
              )
            }
            disabled={!row.prediction || inHistory}
            onClick={onAddHistory}
          />
        </div>
      </div>
    </div>
  );
}

export function GamesTable({ rows }: { rows: DashboardRow[] }) {
  const navigate = useNavigate();
  const market = useMarket((s) => s.market);
  const providerId = useSettings((s) => s.providerId);
  // Which markets each fixture is already tracked in, so the check reflects the
  // *current* market (a game in BTTS isn't "added" for O/U).
  const [savedMarkets, setSavedMarkets] = useState<Map<string, MarketKey[]>>(new Map());

  useEffect(() => {
    let cancelled = false;
    void listHistory()
      .then((records) => {
        if (cancelled) return;
        setSavedMarkets(
          new Map(records.map((r) => [r.fixtureId || r.id, r.trackedMarkets ?? ['btts']])),
        );
      })
      .catch((err) => log.warn('load history ids failed', err));
    return () => {
      cancelled = true;
    };
  }, [rows]);

  const addToHistory = (row: DashboardRow): void => {
    const record = toHistoryRecord(row, providerId, market);
    if (!record) return;
    void upsertHistory(record)
      .then(() =>
        setSavedMarkets((prev) => {
          const next = new Map(prev);
          const cur = next.get(row.fixture.id) ?? [];
          next.set(row.fixture.id, Array.from(new Set([...cur, market])));
          return next;
        }),
      )
      .catch((err) => log.warn('add to history failed', err));
  };

  return (
    <div className="space-y-2">
      {rows.map((row) => (
        <GameBanner
          key={row.fixture.id}
          row={row}
          market={market}
          inHistory={(savedMarkets.get(row.fixture.id) ?? []).includes(market)}
          onOpen={() => navigate(`/analysis/${encodeURIComponent(row.fixture.id)}`)}
          onAddHistory={() => addToHistory(row)}
        />
      ))}
    </div>
  );
}
