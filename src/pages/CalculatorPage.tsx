import { useMemo, useState } from 'react';
import { RotateCcw, ClipboardPaste, Check, AlertCircle } from 'lucide-react';
import type { HeadToHead, TeamStats, VenueStats, WindowStats } from '@/domain/types';
import {
  parseFootystatsClub,
  type ParsedFootystatsTeam,
  type ParsedTeamSplit,
} from '@/services/footystatsParser';
import { predict } from '@/core/prediction/engine';
import { calibrate, impliedBttsYes } from '@/core/prediction/calibration';
import { predictMarkets } from '@/core/prediction/markets';
import { applyPlatt, IDENTITY_PLATT } from '@/core/backtest/backtest';
import { tierForProbability } from '@/core/classification/classification';
import { clamp } from '@/lib/math';
import { useSettings } from '@/store/settingsStore';
import { useCalibration, MIN_CALIBRATION_SAMPLES } from '@/store/calibrationStore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  VerdictPill,
  ProbabilityBar,
  ConfidenceMeter,
  TierBadge,
} from '@/components/common/PredictionWidgets';
import { FactorBreakdown } from '@/components/analysis/FactorBreakdown';
import { toPercent, round } from '@/lib/math';

// ---- form state ----

interface CalcForm {
  homeName: string;
  homeGoalsFor: string;
  homeGoalsAgainst: string;
  homeBttsPct: string;
  homeGames: string;
  awayName: string;
  awayGoalsFor: string;
  awayGoalsAgainst: string;
  awayBttsPct: string;
  awayGames: string;
  h2hBttsPct: string;
  h2hGames: string;
  oddYes: string;
  oddNo: string;
  oddsWeight: string;
}

const EMPTY: CalcForm = {
  homeName: '',
  homeGoalsFor: '',
  homeGoalsAgainst: '',
  homeBttsPct: '',
  homeGames: '',
  awayName: '',
  awayGoalsFor: '',
  awayGoalsAgainst: '',
  awayBttsPct: '',
  awayGames: '',
  h2hBttsPct: '',
  h2hGames: '',
  oddYes: '',
  oddNo: '',
  oddsWeight: '30',
};

// ---- helpers ----

function n(s: string, fallback = 0): number {
  const v = parseFloat(s);
  return Number.isFinite(v) ? v : fallback;
}

function buildWindow(
  goalsFor: number,
  goalsAgainst: number,
  bttsPct: number,
  played: number,
): WindowStats {
  return {
    played,
    goalsFor: goalsFor * played,
    goalsAgainst: goalsAgainst * played,
    avgGoalsFor: goalsFor,
    avgGoalsAgainst: goalsAgainst,
    bttsPct: Math.min(1, Math.max(0, bttsPct / 100)),
    over25Pct: 0,
    cleanSheetPct: 0,
    failedToScorePct: 0,
  };
}

function buildVenue(
  goalsFor: number,
  goalsAgainst: number,
  bttsPct: number,
  played: number,
): VenueStats {
  return {
    played,
    avgGoalsFor: goalsFor,
    avgGoalsAgainst: goalsAgainst,
    bttsPct: Math.min(1, Math.max(0, bttsPct / 100)),
  };
}

const EMPTY_VENUE: VenueStats = { played: 0, avgGoalsFor: 0, avgGoalsAgainst: 0, bttsPct: 0 };

function buildHomeTeamStats(form: CalcForm): TeamStats {
  const gf = n(form.homeGoalsFor);
  const ga = n(form.homeGoalsAgainst);
  const btts = n(form.homeBttsPct);
  const played = Math.max(0, Math.round(n(form.homeGames)));
  const win = buildWindow(gf, ga, btts, played);
  const venue = buildVenue(gf, ga, btts, played);
  return {
    team: { id: 'manual-home', name: form.homeName || 'Casa' },
    last5: win,
    last10: win,
    home: venue,
    away: EMPTY_VENUE,
    recentForm: [],
  };
}

function buildAwayTeamStats(form: CalcForm): TeamStats {
  const gf = n(form.awayGoalsFor);
  const ga = n(form.awayGoalsAgainst);
  const btts = n(form.awayBttsPct);
  const played = Math.max(0, Math.round(n(form.awayGames)));
  const win = buildWindow(gf, ga, btts, played);
  const venue = buildVenue(gf, ga, btts, played);
  return {
    team: { id: 'manual-away', name: form.awayName || 'Fora' },
    last5: win,
    last10: win,
    home: EMPTY_VENUE,
    away: venue,
    recentForm: [],
  };
}

function buildH2H(form: CalcForm): HeadToHead {
  const played = Math.max(0, Math.round(n(form.h2hGames)));
  const bttsPct = Math.min(1, Math.max(0, n(form.h2hBttsPct) / 100));
  return { matches: [], played, bttsPct, avgGoals: 0 };
}

// ---- field components ----

function Field({
  id,
  label,
  placeholder,
  value,
  onChange,
  hint,
}: {
  id: string;
  label: string;
  placeholder?: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-xs font-medium">
        {label}
      </Label>
      <Input
        id={id}
        type="number"
        min={0}
        step="any"
        placeholder={placeholder ?? '0'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 text-sm"
      />
      {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

// ---- markets display ----

function MarketsDisplay({
  markets,
  homeName,
  awayName,
}: {
  markets: ReturnType<typeof predictMarkets>;
  homeName: string;
  awayName: string;
}) {
  const rows = [
    { label: 'Over 2.5 golos', value: toPercent(markets.over25) },
    { label: 'Under 2.5 golos', value: toPercent(markets.under25) },
    { label: `Vitória ${homeName || 'Casa'}`, value: toPercent(markets.homeWin) },
    { label: 'Empate', value: toPercent(markets.draw) },
    { label: `Vitória ${awayName || 'Fora'}`, value: toPercent(markets.awayWin) },
  ];
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Outros mercados</CardTitle>
        <CardDescription>
          Poisson · golos esperados {round(markets.lambdaHome, 2)} – {round(markets.lambdaAway, 2)}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
          {rows.map((r) => (
            <div key={r.label} className="flex flex-col">
              <span className="text-xs text-muted-foreground">{r.label}</span>
              <span className="font-semibold">{r.value}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ---- main page ----

export function CalculatorPage() {
  const [form, setForm] = useState<CalcForm>(EMPTY);

  // Mirror the exact pipeline used in buildAnalysis / AnalysisPage:
  // custom weights (auto-tuned from history) + Platt recalibration.
  const weights = useSettings((s) => s.weights);
  const autoCalibrate = useSettings((s) => s.autoCalibrate);
  const platt = useCalibration((s) => s.platt);
  const calibrationReady = useCalibration((s) => s.ready);
  const sampleSize = useCalibration((s) => s.sampleSize);
  const recalibration = useMemo(
    () => (autoCalibrate && calibrationReady ? platt : undefined),
    // Keyed by coefficients so identity-platt doesn't cause unnecessary recalcs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [autoCalibrate, calibrationReady, platt?.a, platt?.b],
  );

  const set = (key: keyof CalcForm) => (v: string) => setForm((prev) => ({ ...prev, [key]: v }));

  // ---- FootyStats import ----
  const [importHtml, setImportHtml] = useState('');
  const imported = useMemo<ParsedFootystatsTeam | null>(
    () => (importHtml.trim() ? parseFootystatsClub(importHtml) : null),
    [importHtml],
  );

  const fmt = (v: number): string => (v ? String(v) : '');

  // Prefer the venue split; fall back to the overall split when the venue has
  // too few games (common early in a season).
  const fillHome = (t: ParsedFootystatsTeam): void => {
    const s: ParsedTeamSplit = t.home.played >= 1 ? t.home : t.overall;
    setForm((prev) => ({
      ...prev,
      homeName: t.name || prev.homeName,
      homeGoalsFor: fmt(s.goalsFor),
      homeGoalsAgainst: fmt(s.goalsAgainst),
      homeBttsPct: fmt(s.bttsPct),
      homeGames: fmt(s.played),
    }));
  };
  const fillAway = (t: ParsedFootystatsTeam): void => {
    const s: ParsedTeamSplit = t.away.played >= 1 ? t.away : t.overall;
    setForm((prev) => ({
      ...prev,
      awayName: t.name || prev.awayName,
      awayGoalsFor: fmt(s.goalsFor),
      awayGoalsAgainst: fmt(s.goalsAgainst),
      awayBttsPct: fmt(s.bttsPct),
      awayGames: fmt(s.played),
    }));
  };

  const homeGames = Math.max(0, Math.round(n(form.homeGames)));
  const awayGames = Math.max(0, Math.round(n(form.awayGames)));
  const hasEnoughData = homeGames >= 1 && awayGames >= 1;

  const result = useMemo(() => {
    if (!hasEnoughData) return null;
    const home = buildHomeTeamStats(form);
    const away = buildAwayTeamStats(form);
    const h2h = buildH2H(form);
    // Step 1: predict with user's current weights (same as auto-analysis).
    const raw = predict({ home, away, h2h, weights });
    // Step 2: blend with bookmaker odds when provided.
    const implied = impliedBttsYes(
      n(form.oddYes) > 1 ? n(form.oddYes) : undefined,
      n(form.oddNo) > 1 ? n(form.oddNo) : undefined,
    );
    const weight = Math.min(1, Math.max(0, n(form.oddsWeight, 30) / 100));
    const calibrated = calibrate(raw, implied, weight);
    // Step 3: apply Platt recalibration learned from settled history (if active).
    let prediction = calibrated;
    if (
      recalibration &&
      !(recalibration.a === IDENTITY_PLATT.a && recalibration.b === IDENTITY_PLATT.b)
    ) {
      const probYes = clamp(applyPlatt(calibrated.probYes, recalibration));
      const probNo = clamp(1 - probYes);
      prediction = {
        ...calibrated,
        probYes,
        probNo,
        tier: calibrated.insufficientData ? 'weak' : tierForProbability(Math.max(probYes, probNo)),
        recalibrated: true,
      };
    }
    const markets = predictMarkets(home, away);
    return { prediction, markets, home, away };
  }, [form, hasEnoughData, weights, recalibration]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Calculadora manual</h1>
          <p className="text-sm text-muted-foreground">
            Introduza as estatísticas das equipas para calcular um prognóstico BTTS sem chamadas à
            API.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setForm(EMPTY)}>
          <RotateCcw className="mr-2 h-4 w-4" />
          Limpar
        </Button>
      </div>

      {/* ---- FootyStats import ---- */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            <ClipboardPaste className="h-4 w-4" /> Importar do FootyStats
          </CardTitle>
          <CardDescription className="text-xs">
            Abre a página da equipa no FootyStats (footystats.org/clubs/…), copia o conteúdo e cola
            aqui — funciona com o texto da página ou com o código-fonte. Depois preenche a equipa da
            casa ou de fora (usa as estatísticas em casa/fora, ou as gerais se houver poucos jogos
            no recinto).
            <br />
            <span className="mt-1 block">
              📱 <span className="font-medium">No telemóvel:</span> carrega longamente na página →{' '}
              <span className="font-medium">Selecionar tudo</span> →{' '}
              <span className="font-medium">Copiar</span> → cola aqui.
            </span>
            <span className="block">
              💻 <span className="font-medium">No computador:</span> Ctrl+U (ver código-fonte) →
              Ctrl+A → Ctrl+C → cola aqui.
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <textarea
            value={importHtml}
            onChange={(e) => setImportHtml(e.target.value)}
            placeholder="Cola aqui o texto (ou o código-fonte) da página da equipa…"
            rows={3}
            className="w-full resize-y rounded-md border border-input bg-background px-3 py-2 font-mono text-xs outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
          {importHtml.trim() && !imported && (
            <p className="flex items-center gap-1.5 text-xs text-destructive">
              <AlertCircle className="h-3.5 w-3.5" />
              Não reconheci uma página de equipa do FootyStats. Confirma que copiaste o conteúdo
              completo da página de um clube (texto ou código-fonte).
            </p>
          )}
          {imported && (
            <div className="space-y-2 rounded-md border border-primary/30 bg-primary/5 p-3">
              <p className="flex items-center gap-1.5 text-xs">
                <Check className="h-3.5 w-3.5 text-primary" />
                Detetado: <span className="font-semibold">{imported.name || 'equipa'}</span> · em
                casa {round(imported.home.goalsFor, 2)}–{round(imported.home.goalsAgainst, 2)}{' '}
                golos, BTTS {round(imported.home.bttsPct, 0)}% ({imported.home.played}j) · fora{' '}
                {round(imported.away.goalsFor, 2)}–{round(imported.away.goalsAgainst, 2)} golos,
                BTTS {round(imported.away.bttsPct, 0)}% ({imported.away.played}j)
              </p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => fillHome(imported)}>
                  Preencher Equipa da Casa
                </Button>
                <Button size="sm" variant="outline" onClick={() => fillAway(imported)}>
                  Preencher Equipa de Fora
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* ---- LEFT: form ---- */}
        <div className="space-y-4">
          {/* Home team */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold uppercase tracking-wide text-primary">
                Equipa da Casa
              </CardTitle>
              <CardDescription className="text-xs">Estatísticas em jogos em casa</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="home-name" className="text-xs font-medium">
                  Nome (opcional)
                </Label>
                <Input
                  id="home-name"
                  placeholder="Ex.: Benfica"
                  value={form.homeName}
                  onChange={(e) => set('homeName')(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field
                  id="home-gf"
                  label="Média golos marcados"
                  placeholder="1.5"
                  value={form.homeGoalsFor}
                  onChange={set('homeGoalsFor')}
                />
                <Field
                  id="home-ga"
                  label="Média golos sofridos"
                  placeholder="1.0"
                  value={form.homeGoalsAgainst}
                  onChange={set('homeGoalsAgainst')}
                />
                <Field
                  id="home-btts"
                  label="BTTS% em casa"
                  placeholder="50"
                  value={form.homeBttsPct}
                  onChange={set('homeBttsPct')}
                  hint="0–100"
                />
                <Field
                  id="home-games"
                  label="Jogos disputados"
                  placeholder="10"
                  value={form.homeGames}
                  onChange={set('homeGames')}
                  hint="Mínimo 1"
                />
              </div>
            </CardContent>
          </Card>

          {/* Away team */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold uppercase tracking-wide text-destructive">
                Equipa de Fora
              </CardTitle>
              <CardDescription className="text-xs">Estatísticas em jogos fora</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="away-name" className="text-xs font-medium">
                  Nome (opcional)
                </Label>
                <Input
                  id="away-name"
                  placeholder="Ex.: Porto"
                  value={form.awayName}
                  onChange={(e) => set('awayName')(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field
                  id="away-gf"
                  label="Média golos marcados"
                  placeholder="1.2"
                  value={form.awayGoalsFor}
                  onChange={set('awayGoalsFor')}
                />
                <Field
                  id="away-ga"
                  label="Média golos sofridos"
                  placeholder="1.1"
                  value={form.awayGoalsAgainst}
                  onChange={set('awayGoalsAgainst')}
                />
                <Field
                  id="away-btts"
                  label="BTTS% fora"
                  placeholder="45"
                  value={form.awayBttsPct}
                  onChange={set('awayBttsPct')}
                  hint="0–100"
                />
                <Field
                  id="away-games"
                  label="Jogos disputados"
                  placeholder="10"
                  value={form.awayGames}
                  onChange={set('awayGames')}
                  hint="Mínimo 1"
                />
              </div>
            </CardContent>
          </Card>

          {/* H2H */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Confrontos Diretos (opcional)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                <Field
                  id="h2h-btts"
                  label="BTTS% nos H2H"
                  placeholder="50"
                  value={form.h2hBttsPct}
                  onChange={set('h2hBttsPct')}
                  hint="0–100"
                />
                <Field
                  id="h2h-games"
                  label="Jogos H2H"
                  placeholder="0"
                  value={form.h2hGames}
                  onChange={set('h2hGames')}
                />
              </div>
            </CardContent>
          </Card>

          {/* Odds calibration */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Odds do mercado (opcional)
              </CardTitle>
              <CardDescription className="text-xs">
                Para calibrar a previsão com as probabilidades implícitas da casa de apostas.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                <Field
                  id="odd-yes"
                  label="Odd BTTS SIM"
                  placeholder="1.90"
                  value={form.oddYes}
                  onChange={set('oddYes')}
                />
                <Field
                  id="odd-no"
                  label="Odd BTTS NÃO"
                  placeholder="1.90"
                  value={form.oddNo}
                  onChange={set('oddNo')}
                />
                <div className="col-span-2">
                  <Field
                    id="odds-weight"
                    label="Peso do mercado %"
                    placeholder="30"
                    value={form.oddsWeight}
                    onChange={set('oddsWeight')}
                    hint="0 = só modelo · 100 = só mercado"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ---- RIGHT: results ---- */}
        <div className="space-y-4">
          {!hasEnoughData ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
                <p className="text-sm">
                  Preencha os jogos disputados (≥ 1) de cada equipa para ver a previsão.
                </p>
              </CardContent>
            </Card>
          ) : result ? (
            <>
              {/* Verdict */}
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Previsão</CardTitle>
                    <TierBadge tier={result.prediction.tier} />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {form.homeName || 'Casa'} vs {form.awayName || 'Fora'}
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <VerdictPill prediction={result.prediction} />
                  <ProbabilityBar probYes={result.prediction.probYes} />
                  <div>
                    <p className="mb-1 text-xs text-muted-foreground">Confiança</p>
                    <ConfidenceMeter confidence={result.prediction.confidence} />
                  </div>
                  {result.prediction.insufficientData && (
                    <p className="text-xs text-amber-500">
                      Dados insuficientes — previsão com baixa confiança.
                    </p>
                  )}
                  <div className="space-y-1 border-t pt-3 text-xs text-muted-foreground">
                    <p>
                      Pesos: <span className="font-medium text-foreground">das Definições</span>
                      {autoCalibrate && (
                        <>
                          {' · '}Auto-calibração:{' '}
                          <span className="font-medium text-primary">
                            {calibrationReady
                              ? `ativa (${sampleSize} resultados)`
                              : `inativa (mín. ${MIN_CALIBRATION_SAMPLES})`}
                          </span>
                        </>
                      )}
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Factor breakdown */}
              <FactorBreakdown prediction={result.prediction} />

              {/* Other markets */}
              <MarketsDisplay
                markets={result.markets}
                homeName={form.homeName}
                awayName={form.awayName}
              />
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
