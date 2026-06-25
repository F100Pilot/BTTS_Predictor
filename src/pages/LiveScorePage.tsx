import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCw, Radio } from 'lucide-react';
import type { LiveMatch } from '@/domain/types';
import { useDataService } from '@/hooks/useDataService';
import { useFixtureCache } from '@/store/fixtureCacheStore';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Spinner, EmptyState } from '@/components/common/States';
import { formatTime } from '@/lib/format';
import { createLogger } from '@/services/logger';

const log = createLogger('LiveScorePage');
const REFRESH_MS = 30_000;

function statusLabel(m: LiveMatch): string {
  if (m.status === 'PAUSED') return 'Intervalo';
  if (typeof m.minute === 'number') return `${m.minute}'`;
  return 'Ao vivo';
}

export function LiveScorePage() {
  const data = useDataService();
  const navigate = useNavigate();
  const cacheFixtures = useFixtureCache((s) => s.put);
  const [matches, setMatches] = useState<LiveMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<string>('');
  const timer = useRef<ReturnType<typeof setInterval>>();

  const load = useCallback(
    async (showSpinner = false) => {
      if (showSpinner) setLoading(true);
      try {
        const live = await data.getLiveMatches();
        setMatches(live);
        setUpdatedAt(formatTime(new Date().toISOString()));
      } catch (err) {
        log.warn('failed to load live', err);
      } finally {
        setLoading(false);
      }
    },
    [data],
  );

  useEffect(() => {
    void load(true);
    timer.current = setInterval(() => void load(false), REFRESH_MS);
    return () => clearInterval(timer.current);
  }, [load]);

  const openAnalysis = (m: LiveMatch): void => {
    // Make the fixture resolvable on the analysis page.
    cacheFixtures([
      {
        id: m.id,
        date: new Date().toISOString(),
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
          title="Sem jogos ao vivo"
          description="Não há jogos em curso nas competições da fonte ativa. Volte mais tarde."
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
                  <div className="mt-2 text-center">
                    {btts ? (
                      <span className="rounded-full bg-success px-2 py-0.5 text-xs font-semibold text-success-foreground">
                        BTTS ✓
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">BTTS por concretizar</span>
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
