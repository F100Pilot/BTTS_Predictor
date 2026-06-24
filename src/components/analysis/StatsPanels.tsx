import type { FormEntry, HeadToHead, TeamStats, WindowStats } from '@/domain/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toPercent, round } from '@/lib/math';
import { formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';

function FormStrip({ form }: { form: FormEntry[] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {form.length === 0 && <span className="text-xs text-muted-foreground">Sem dados</span>}
      {form.map((e) => (
        <span
          key={e.matchId}
          title={`${e.venue === 'home' ? 'Casa' : 'Fora'} vs ${e.opponent}: ${e.goalsFor}-${e.goalsAgainst}`}
          className={cn(
            'flex h-6 w-6 items-center justify-center rounded text-xs font-bold text-white',
            e.outcome === 'W' && 'bg-success',
            e.outcome === 'D' && 'bg-warning text-warning-foreground',
            e.outcome === 'L' && 'bg-destructive',
          )}
        >
          {e.outcome}
        </span>
      ))}
    </div>
  );
}

function WindowRow({ label, w }: { label: string; w: WindowStats }) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4">
      <Stat label={`${label} · GM méd.`} value={round(w.avgGoalsFor, 2).toString()} />
      <Stat label="GS méd." value={round(w.avgGoalsAgainst, 2).toString()} />
      <Stat label="BTTS" value={toPercent(w.bttsPct)} />
      <Stat label="Over 2.5" value={toPercent(w.over25Pct)} />
      <Stat label="Clean Sheets" value={toPercent(w.cleanSheetPct)} />
      <Stat label="Falhou marcar" value={toPercent(w.failedToScorePct)} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}

export function TeamStatsCard({ stats, title }: { stats: TeamStats; title: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="mb-1 text-xs font-medium text-muted-foreground">Forma recente</p>
          <FormStrip form={stats.recentForm} />
        </div>
        <div className="space-y-3">
          <WindowRow label="Últimos 5" w={stats.last5} />
          <div className="border-t pt-3">
            <WindowRow label="Últimos 10" w={stats.last10} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 border-t pt-3 text-sm">
          <div>
            <p className="text-xs font-medium text-muted-foreground">Em casa</p>
            <Stat label="BTTS" value={toPercent(stats.home.bttsPct)} />
            <span className="text-xs text-muted-foreground">
              {round(stats.home.avgGoalsFor, 2)} GM · {round(stats.home.avgGoalsAgainst, 2)} GS
            </span>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">Fora</p>
            <Stat label="BTTS" value={toPercent(stats.away.bttsPct)} />
            <span className="text-xs text-muted-foreground">
              {round(stats.away.avgGoalsFor, 2)} GM · {round(stats.away.avgGoalsAgainst, 2)} GS
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function HeadToHeadCard({ h2h }: { h2h: HeadToHead }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Head-to-Head</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {h2h.played === 0 ? (
          <p className="text-sm text-muted-foreground">Sem confrontos diretos registados.</p>
        ) : (
          <>
            <div className="flex gap-6 text-sm">
              <Stat label="Jogos" value={h2h.played.toString()} />
              <Stat label="BTTS" value={toPercent(h2h.bttsPct)} />
              <Stat label="Média golos" value={round(h2h.avgGoals, 2).toString()} />
            </div>
            <ul className="space-y-1 text-sm">
              {h2h.matches.slice(0, 5).map((m) => (
                <li key={m.id} className="flex justify-between border-b py-1 last:border-0">
                  <span className="text-muted-foreground">{formatDate(m.date)}</span>
                  <span>
                    {m.home.name}{' '}
                    <strong>
                      {m.homeGoals}–{m.awayGoals}
                    </strong>{' '}
                    {m.away.name}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  );
}
