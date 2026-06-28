import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw, Radio } from 'lucide-react';
import type { LiveMatch } from '@/domain/types';
import { useFixtureCache } from '@/store/fixtureCacheStore';
import { useSettings } from '@/store/settingsStore';
import { listHistory, listBets } from '@/data/cache/repositories';
import { buildFixtureIndex } from '@/services/flashscoreSettle';
import { fetchFlashscoreLive, fixtureToLiveMatch } from '@/services/flashscoreClient';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Spinner, EmptyState } from '@/components/common/States';
import { formatTime } from '@/lib/format';
import { createLogger } from '@/services/logger';

const log = createLogger('LiveScorePage');
const REFRESH_MS = 30_000;

/** Minutes since kickoff (rough fallback when the feed omits the live minute). */
function elapsedFromKickoff(dateIso?: string): number | null {
  if (!dateIso) return null;
  const start = Date.parse(dateIso);
  if (!Number.isFinite(start)) return null;
  const mins = Math.floor((Date.now() - start) / 60_000);
  return mins >= 0 && mins < 240 ? mins : null;
}

function statusLabel(m: LiveMatch): string {
  if (m.status === 'PAUSED') return 'Intervalo';
  if (typeof m.minute === 'number') return `${m.minute}'`;
  const elapsed = elapsedFromKickoff(m.date);
  if (elapsed != null) return `~${elapsed}'`;
  return 'Ao vivo';
}

export function LiveScorePage() {
  const navigate = useNavigate();
  const cacheFixtures = useFixtureCache((s) => s.put);
  const corsProxy = useSettings((s) => s.corsProxy);
  const rapidApiKey = useSettings((s) => s.rapidApiKey);
  const [matches, setMatches] = useState<LiveMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<string>('');
  const timer = useRef<ReturnType<typeof setInterval>>();

  const load = useCallback(
    async (showSpinner = false) => {
      if (showSpinner) setLoading(true);
      try {
        const [history, bets] = await Promise.all([listHistory(), listBets()]);

        // Only show live games the user is tracking (in history or with a bet),
        // matched by Flashscore id OR team-name pair. Only call Flashscore when
        // there are tracked games and a key — saves RapidAPI quota.
        let shown: LiveMatch[] = [];
        if (rapidApiKey.trim() && (history.length > 0 || bets.length > 0)) {
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
          shown = [...matched.values()].filter(Boolean).map((f) => fixtureToLiveMatch(f!));
        }

        setMatches(shown);
        setUpdatedAt(formatTime(new Date().toISOString()));
      } catch (err) {
        log.warn('failed to load live', err);
      } finally {
        setLoading(false);
      }
    },
    [corsProxy, rapidApiKey],
  );

  useEffect(() => {
    void load(true);
    // Poll only while the tab is visible — no point spending API quota on a
    // hidden tab; refresh immediately when the user returns.
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
    // Make the fixture resolvable on the analysis page.
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
            Atualização automática a cada 30s{updatedAt ? ` · ${updatedAt}` : ''}.
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Fonte: <span className="font-medium text-foreground">Flashscore</span>
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load(true)}>
          <RefreshCw /> Atualizar
        </Button>
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
        <div className="grid gap-3 sm:grid-cols-2">
          {matches.map((m) => {
            const btts = m.homeGoals > 0 && m.awayGoals > 0;
            return (
              <Card
                key={m.id}
                className="cursor-pointer transition-colors hover:bg-accent/40"
                onClick={() => openAnalysis(m)}
              >
                <CardContent className="p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="truncate text-xs text-muted-foreground">
                      {m.competition.name}
                    </span>
                    <span className="flex items-center gap-1 text-xs font-medium text-destructive">
                      <span className="h-2 w-2 animate-pulse rounded-full bg-destructive" />
                      {statusLabel(m)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex-1 truncate font-medium">{m.home.name}</span>
                    <span className="tabular-nums text-xl font-bold">
                      {m.homeGoals} – {m.awayGoals}
                    </span>
                    <span className="flex-1 truncate text-right font-medium">{m.away.name}</span>
                  </div>
                  {m.date && (
                    <p className="mt-1 text-center text-xs text-muted-foreground">
                      Início: {formatTime(m.date)} · {statusLabel(m)} decorridos
                    </p>
                  )}
                  <div className="mt-2 text-center">
                    {btts ? (
                      <span className="rounded-full bg-success px-2 py-0.5 text-xs font-semibold text-success-foreground">
                        Ambas marcaram ✓ (BTTS SIM)
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        Ainda não marcaram ambas
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
