import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw, Radio, Settings } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { LiveMatch, MatchResult } from '@/domain/types';
import { useFixtureCache } from '@/store/fixtureCacheStore';
import { useSettings } from '@/store/settingsStore';
import { useDataService } from '@/hooks/useDataService';
import { listHistory, listBets } from '@/data/cache/repositories';
import { buildFixtureIndex } from '@/services/flashscoreSettle';
import { fetchFlashscoreLive, fixtureToLiveMatch } from '@/services/flashscoreClient';
import { bttsVerdict } from '@/core/classification/classification';
import { IconAction } from '@/components/common/IconAction';
import { TeamAvatar } from '@/components/common/TeamAvatar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Spinner, EmptyState } from '@/components/common/States';
import { formatTime } from '@/lib/format';
import { toPercent } from '@/lib/math';
import { createLogger } from '@/services/logger';
import { cn } from '@/lib/utils';

const log = createLogger('LiveScorePage');
const REFRESH_MS = 60_000;

type Outcome = 'W' | 'D' | 'L';
interface SavedPred {
  probYes: number;
}
interface TeamForm {
  home: Outcome[];
  away: Outcome[];
}

/** Minutes since kickoff (rough fallback when the feed omits the live minute). */
function elapsedFromKickoff(dateIso?: string): number | null {
  if (!dateIso) return null;
  const start = Date.parse(dateIso);
  if (!Number.isFinite(start)) return null;
  const mins = Math.floor((Date.now() - start) / 60_000);
  return mins >= 0 && mins < 240 ? mins : null;
}

// A match can't still be in play this long after kickoff (90' + half-time +
// generous stoppage ≈ 120'). When the feed gives no real minute and the game
// started this far back, it's finished and the live feed just hasn't flipped.
const MAX_LIVE_MINUTES = 130;

function looksFinished(m: LiveMatch): boolean {
  if (typeof m.minute === 'number') return false;
  const elapsed = elapsedFromKickoff(m.date);
  return elapsed != null && elapsed > MAX_LIVE_MINUTES;
}

/** Whether a kickoff is within the plausible live window (skip the feed if none). */
function inLiveWindow(dateIso: string | undefined, now: number): boolean {
  if (!dateIso) return false;
  const t = Date.parse(dateIso);
  if (!Number.isFinite(t)) return false;
  const mins = (now - t) / 60_000;
  return mins >= -10 && mins <= MAX_LIVE_MINUTES;
}

function statusLabel(m: LiveMatch): string {
  if (m.status === 'PAUSED') return 'Intervalo';
  if (typeof m.minute === 'number') return `${m.minute}'`;
  const elapsed = elapsedFromKickoff(m.date);
  if (elapsed != null) return `~${elapsed}'`;
  return 'Ao vivo';
}

/** W/D/L of a team's recent matches (newest first, max 5). */
function formOf(matches: MatchResult[] | undefined, teamId: string): Outcome[] {
  if (!matches) return [];
  const out: Outcome[] = [];
  for (const m of matches) {
    let gf: number;
    let ga: number;
    if (m.home.id === teamId) {
      gf = m.homeGoals;
      ga = m.awayGoals;
    } else if (m.away.id === teamId) {
      gf = m.awayGoals;
      ga = m.homeGoals;
    } else {
      continue;
    }
    out.push(gf > ga ? 'W' : gf < ga ? 'L' : 'D');
    if (out.length >= 5) break;
  }
  return out;
}

/** A row of small W/D/L squares (oldest→newest left to right). */
function FormBar({ results, align = 'start' }: { results: Outcome[]; align?: 'start' | 'end' }) {
  if (!results.length) {
    return <span className="text-[10px] text-muted-foreground">—</span>;
  }
  return (
    <div className={cn('flex gap-0.5', align === 'end' && 'flex-row-reverse')}>
      {results.map((r, i) => (
        <span
          key={i}
          title={r}
          className={cn(
            'grid h-4 w-4 place-items-center rounded-[3px] text-[9px] font-bold text-white',
            r === 'W' ? 'bg-success' : r === 'L' ? 'bg-destructive' : 'bg-muted-foreground',
          )}
        >
          {r}
        </span>
      ))}
    </div>
  );
}

function PredictionPill({ probYes }: { probYes: number }) {
  const v = bttsVerdict(probYes);
  return (
    <span
      className={cn(
        'rounded-full border px-2.5 py-0.5 text-xs font-bold tabular-nums',
        v.side === 'SIM'
          ? 'border-success/30 bg-success/15 text-success'
          : 'border-destructive/30 bg-destructive/15 text-destructive',
      )}
    >
      BTTS {v.side} {toPercent(v.probability)}
    </span>
  );
}

function LiveBanner({
  m,
  pred,
  form,
  onOpen,
}: {
  m: LiveMatch;
  pred?: SavedPred;
  form?: TeamForm;
  onOpen: () => void;
}) {
  const btts = m.homeGoals > 0 && m.awayGoals > 0;
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
      className="cursor-pointer rounded-2xl border border-border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-accent/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="truncate text-[11px] text-muted-foreground">{m.competition.name}</span>
        <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-destructive">
          <span className="h-2 w-2 animate-pulse rounded-full bg-destructive" />
          {statusLabel(m)}
        </span>
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <TeamAvatar name={m.home.name} size={32} />
          <span className="truncate font-semibold">{m.home.name}</span>
        </div>
        <span className="shrink-0 tabular-nums text-2xl font-bold">
          {m.homeGoals} – {m.awayGoals}
        </span>
        <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
          <span className="truncate text-right font-semibold">{m.away.name}</span>
          <TeamAvatar name={m.away.name} size={32} />
        </div>
      </div>

      {(form?.home.length || form?.away.length) && (
        <div className="mt-2.5 flex items-center justify-between gap-2">
          <FormBar results={form?.home ?? []} />
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Forma</span>
          <FormBar results={form?.away ?? []} align="end" />
        </div>
      )}

      <div className="mt-3 flex items-center justify-between gap-2">
        {pred ? (
          <PredictionPill probYes={pred.probYes} />
        ) : (
          <span className="text-xs text-muted-foreground">sem prognóstico</span>
        )}
        {btts ? (
          <span className="rounded-full border border-success/30 bg-success/15 px-2.5 py-0.5 text-xs font-semibold text-success">
            Ambas marcaram ✓
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">Ainda não marcaram ambas</span>
        )}
      </div>

      {m.date && (
        <p className="mt-2 text-center text-[11px] text-muted-foreground">
          Início: {formatTime(m.date)}
        </p>
      )}
    </div>
  );
}

export function LiveScorePage() {
  const navigate = useNavigate();
  const cacheFixtures = useFixtureCache((s) => s.put);
  const corsProxy = useSettings((s) => s.corsProxy);
  const rapidApiKey = useSettings((s) => s.rapidApiKey);
  const data = useDataService();
  const [matches, setMatches] = useState<LiveMatch[]>([]);
  const [preds, setPreds] = useState<Map<string, SavedPred>>(new Map());
  const [forms, setForms] = useState<Record<string, TeamForm>>({});
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<string>('');
  const timer = useRef<ReturnType<typeof setInterval>>();
  const fetchedForm = useRef<Set<string>>(new Set());

  // Fetch each live game's recent form once (then it's served from cache, so the
  // 60s polling doesn't spend new RapidAPI requests on it).
  const ensureForm = useCallback(
    (m: LiveMatch): void => {
      if (fetchedForm.current.has(m.id)) return;
      fetchedForm.current.add(m.id);
      void data
        .getFixtureMatches({
          id: m.id,
          date: m.date ?? new Date().toISOString(),
          competition: m.competition,
          home: m.home,
          away: m.away,
        })
        .then((bundle) => {
          if (!bundle) return;
          setForms((prev) => ({
            ...prev,
            [m.id]: { home: formOf(bundle.home, m.home.id), away: formOf(bundle.away, m.away.id) },
          }));
        })
        .catch((err) => log.warn('form fetch failed', err));
    },
    [data],
  );

  const load = useCallback(
    async (showSpinner = false) => {
      if (showSpinner) setLoading(true);
      try {
        const [history, bets] = await Promise.all([listHistory(), listBets()]);

        // Saved prediction per fixture (for the "prognóstico %" on each banner).
        const predMap = new Map<string, SavedPred>();
        for (const h of history) {
          if (typeof h.probYes === 'number')
            predMap.set(h.fixtureId || h.id, { probYes: h.probYes });
        }
        setPreds(predMap);

        // Only call the live feed when an unsettled tracked game is in its play
        // window right now — otherwise polling just burns RapidAPI quota.
        const now = Date.now();
        const anyLiveNow =
          history.some((h) => !h.actual && inLiveWindow(h.date, now)) ||
          bets.some((b) => b.result === 'pending' && inLiveWindow(b.kickoff, now));
        let shown: LiveMatch[] = [];
        if (rapidApiKey.trim() && anyLiveNow) {
          const fixtures = await fetchFlashscoreLive(rapidApiKey, corsProxy).catch(
            () => [] as Awaited<ReturnType<typeof fetchFlashscoreLive>>,
          );
          const idx = buildFixtureIndex(fixtures);
          const matched = new Map<string, ReturnType<typeof idx.find>>();
          for (const h of history) {
            const f = idx.find(h.flashMatchId, h.fixtureName);
            if (f && f.status === 'live') matched.set(f.matchId, f);
          }
          for (const b of bets) {
            const f = idx.find(b.flashMatchId, b.matchLabel);
            if (f && f.status === 'live') matched.set(f.matchId, f);
          }
          shown = [...matched.values()]
            .filter(Boolean)
            .map((f) => fixtureToLiveMatch(f!))
            .filter((mm) => !looksFinished(mm));
        }

        setMatches(shown);
        shown.forEach(ensureForm);
        setUpdatedAt(formatTime(new Date().toISOString()));
      } catch (err) {
        log.warn('failed to load live', err);
      } finally {
        setLoading(false);
      }
    },
    [corsProxy, rapidApiKey, ensureForm],
  );

  useEffect(() => {
    void load(true);
    timer.current = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      void load(false);
    }, REFRESH_MS);
    const onVisible = (): void => {
      if (!document.hidden) void load(false);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(timer.current);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [load]);

  const openAnalysis = (m: LiveMatch): void => {
    cacheFixtures([
      {
        id: m.id,
        date: m.date ?? new Date().toISOString(),
        competition: m.competition,
        home: m.home,
        away: m.away,
      },
    ]);
    navigate(`/analysis/${encodeURIComponent(m.id)}`);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Radio className="h-5 w-5 text-destructive" /> Ao Vivo
          </h1>
          <p className="text-sm text-muted-foreground">
            Atualização automática a cada 60s{updatedAt ? ` · ${updatedAt}` : ''}.
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Fonte: <span className="font-medium text-foreground">Flashscore</span>
          </p>
        </div>
        <div className="flex items-center gap-2 self-start">
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label="Opções"
                className="inline-grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-border bg-card text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-auto overflow-visible p-2">
              <div className="flex gap-2">
                <IconAction
                  label="Atualizar"
                  icon={<RefreshCw className="h-4 w-4" />}
                  onClick={() => void load(true)}
                />
              </div>
            </PopoverContent>
          </Popover>
          <Link
            to="/settings"
            aria-label="Definições"
            title="Definições"
            className="inline-grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-border bg-card text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <Settings className="h-4 w-4" />
          </Link>
        </div>
      </div>

      {loading ? (
        <Spinner label="A carregar jogos ao vivo..." />
      ) : matches.length === 0 ? (
        <EmptyState
          icon={<Radio className="h-8 w-8 text-muted-foreground" />}
          title="Sem jogos ao vivo a acompanhar"
          description="Só aparecem aqui jogos que estão no teu histórico de previsões ou nas tuas apostas. Analisa um jogo ou faz uma aposta para o acompanhares ao vivo."
        />
      ) : (
        <div className="grid gap-2.5 lg:grid-cols-2">
          {matches.map((m) => (
            <LiveBanner
              key={m.id}
              m={m}
              pred={preds.get(m.id)}
              form={forms[m.id]}
              onOpen={() => openAnalysis(m)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
