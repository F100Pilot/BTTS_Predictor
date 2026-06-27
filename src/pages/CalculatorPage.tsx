import { useEffect, useMemo, useState } from 'react';
import { RotateCcw, ClipboardPaste, Check, AlertCircle, Save, Coins, Zap } from 'lucide-react';
import type {
  BttsPrediction,
  HeadToHead,
  TeamStats,
  VenueStats,
  WindowStats,
} from '@/domain/types';
import {
  parseFootystatsClub,
  type ParsedFootystatsTeam,
  type ParsedTeamSplit,
} from '@/services/footystatsParser';
import { parseFlashscoreH2H, type FlashH2HResult, type FlashSplit } from '@/services/flashscoreH2H';
import { parseFlashscoreBttsOdds, type FlashBttsOdds } from '@/services/flashscoreOdds';
import type { HistoryRecord } from '@/data/cache/db';
import { upsertHistory } from '@/data/cache/repositories';
import { useMartingale } from '@/store/martingaleStore';
import { createLogger } from '@/services/logger';
import { Search } from 'lucide-react';
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

const log = createLogger('CalculatorPage');

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

  const corsProxy = useSettings((s) => s.corsProxy);
  const [pasteError, setPasteError] = useState<string | null>(null);

  // Build a proxied URL for a target through the configured CORS proxy. Works
  // with a {url}-style proxy OR an origin-prefix worker (we append the worker's
  // generic ?url= endpoint). Used by the Flashscore import.
  const proxyFor = (target: string): string | null => {
    const p = corsProxy.trim();
    if (!p) return null;
    if (p.includes('{url}')) return p.replace('{url}', encodeURIComponent(target));
    return p.replace(/\/+$/, '') + '/?url=' + encodeURIComponent(target);
  };

  // On phones, long-pressing an empty field often shows "Autofill" instead of
  // "Paste". Reading the clipboard from a button press sidesteps that entirely.
  const pasteFromClipboard = async (): Promise<void> => {
    try {
      const text = await navigator.clipboard.readText();
      if (text.trim()) {
        setImportHtml(text);
        setPasteError(null);
      } else {
        setPasteError('A área de transferência está vazia — copia primeiro o conteúdo da página.');
      }
    } catch {
      setPasteError(
        'O browser não permitiu colar automaticamente. Toca na caixa abaixo e usa “Colar”.',
      );
    }
  };

  const fmt = (v: number): string => (v ? String(v) : '');
  const [filledMsg, setFilledMsg] = useState<string | null>(null);

  // After filling, wipe the import box so the NEXT team is pasted clean — this
  // prevents accidentally reusing the first team (the parser reads the first
  // match in the text, so a second paste appended to the first re-fills team 1).
  const afterFill = (side: 'Casa' | 'Fora', name: string): void => {
    setImportHtml('');
    setPasteError(null);
    setFilledMsg(`${name || 'Equipa'} colocada na ${side}. Importa agora a outra equipa.`);
  };

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
    afterFill('Casa', t.name);
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
    afterFill('Fora', t.name);
  };

  // ---- Flashscore import (RapidAPI) ----
  // Enter a match (id or Flashscore link) → one h2h call fills BOTH teams + H2H.
  const rapidApiKey = useSettings((s) => s.rapidApiKey);
  const [flashInput, setFlashInput] = useState('');
  const [flashFetching, setFlashFetching] = useState(false);
  const [flashError, setFlashError] = useState<string | null>(null);
  const [flashResult, setFlashResult] = useState<FlashH2HResult | null>(null);
  // Which subject team is the home side. Flashscore lists them as [home, away]
  // but the user can swap if the fixture has them the other way around.
  const [flashSwap, setFlashSwap] = useState(false);
  // Raw response text kept for debugging when parsing yields no form games — the
  // user can copy it and share so we can align the parser to the real shape.
  const [flashRaw, setFlashRaw] = useState<string>('');
  const [flashCopied, setFlashCopied] = useState(false);
  // Market BTTS odds fetched alongside the h2h (null until/unless available).
  const [flashOdds, setFlashOdds] = useState<FlashBttsOdds | null>(null);

  // Accept a raw 6–12 char id, a "match_id="/"mid=" query, or a Flashscore URL.
  const extractMatchId = (raw: string): string | null => {
    const s = raw.trim();
    if (!s) return null;
    const q = s.match(/(?:match_id|mid)=([A-Za-z0-9]{6,12})/);
    if (q) return q[1] ?? null;
    if (/^[A-Za-z0-9]{6,12}$/.test(s)) return s;
    const tokens = s.match(/[A-Za-z0-9]{8}/g);
    return tokens && tokens.length ? (tokens[tokens.length - 1] ?? null) : null;
  };

  const fetchFlash = async (): Promise<void> => {
    const id = extractMatchId(flashInput);
    if (!id) {
      setFlashError('Indica o id do jogo (ou cola o link do Flashscore).');
      return;
    }
    if (!rapidApiKey.trim()) {
      setFlashError('Configura primeiro a chave RapidAPI em Definições.');
      return;
    }
    const target = `https://flashscore4.p.rapidapi.com/api/flashscore/v2/matches/h2h?match_id=${id}`;
    const proxied = proxyFor(target);
    if (!proxied) {
      setFlashError('Configura primeiro um Proxy CORS em Definições (o teu Worker).');
      return;
    }
    setFlashFetching(true);
    setFlashError(null);
    try {
      const res = await fetch(proxied, {
        headers: {
          'x-rapidapi-key': rapidApiKey.trim(),
          'x-rapidapi-host': 'flashscore4.p.rapidapi.com',
        },
      });
      if (!res.ok) throw new Error(String(res.status));
      const text = await res.text();
      setFlashRaw(text);
      let json: unknown;
      try {
        json = JSON.parse(text);
      } catch {
        setFlashError(
          'A resposta não é JSON válido (provavelmente o proxy devolveu um erro/HTML).',
        );
        setFlashResult(null);
        return;
      }
      const parsed = parseFlashscoreH2H(json);
      if (!parsed) {
        setFlashError('Recebi resposta mas não reconheci os jogos. Confirma o id do jogo.');
        setFlashResult(null);
        return;
      }
      setFlashResult(parsed);
      setFlashSwap(false);

      // Best-effort: also pull the market BTTS odds for this match. A failure
      // here never blocks the import — the form just keeps its current odds.
      setFlashOdds(null);
      try {
        const oddsTarget = `https://flashscore4.p.rapidapi.com/api/flashscore/v2/matches/odds?match_id=${id}&geo_ip_code=US`;
        const oddsProxied = proxyFor(oddsTarget);
        if (oddsProxied) {
          const oddsRes = await fetch(oddsProxied, {
            headers: {
              'x-rapidapi-key': rapidApiKey.trim(),
              'x-rapidapi-host': 'flashscore4.p.rapidapi.com',
            },
          });
          if (oddsRes.ok) {
            setFlashOdds(parseFlashscoreBttsOdds(await oddsRes.json()));
          }
        }
      } catch (oddsErr) {
        log.warn('flashscore odds fetch failed', oddsErr);
      }
    } catch (err) {
      log.warn('flashscore h2h fetch failed', err);
      setFlashError('Não consegui buscar o jogo (proxy, chave RapidAPI ou id inválido).');
      setFlashResult(null);
    } finally {
      setFlashFetching(false);
    }
  };

  const pasteFlash = async (): Promise<void> => {
    try {
      const text = await navigator.clipboard.readText();
      if (text.trim()) {
        setFlashInput(text.trim());
        setFlashError(null);
      } else {
        setFlashError('A área de transferência está vazia — copia primeiro o link/id.');
      }
    } catch {
      setFlashError('O browser não permitiu colar automaticamente. Cola o id manualmente.');
    }
  };

  const copyFlashRaw = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(flashRaw);
      setFlashCopied(true);
      setTimeout(() => setFlashCopied(false), 2000);
    } catch {
      setFlashError('Não consegui copiar — seleciona e copia o texto da caixa abaixo manualmente.');
    }
  };

  // Fill the whole form from a Flashscore h2h result: home team's home split,
  // away team's away split, and the H2H BTTS. Respects the swap toggle.
  const applyFlash = (r: FlashH2HResult): void => {
    const [a, b] = r.teams;
    const home = flashSwap ? b : a;
    const away = flashSwap ? a : b;
    const homeSplit: FlashSplit = home.home.played >= 1 ? home.home : home.overall;
    const awaySplit: FlashSplit = away.away.played >= 1 ? away.away : away.overall;
    setForm((prev) => ({
      ...prev,
      homeName: home.name,
      homeGoalsFor: fmt(homeSplit.goalsFor),
      homeGoalsAgainst: fmt(homeSplit.goalsAgainst),
      homeBttsPct: fmt(homeSplit.bttsPct),
      homeGames: fmt(homeSplit.played),
      awayName: away.name,
      awayGoalsFor: fmt(awaySplit.goalsFor),
      awayGoalsAgainst: fmt(awaySplit.goalsAgainst),
      awayBttsPct: fmt(awaySplit.bttsPct),
      awayGames: fmt(awaySplit.played),
      h2hBttsPct: r.h2h.played >= 1 ? fmt(r.h2h.bttsPct) : prev.h2hBttsPct,
      h2hGames: r.h2h.played >= 1 ? fmt(r.h2h.played) : prev.h2hGames,
      // Market BTTS odds, when we managed to fetch them.
      oddYes: flashOdds ? String(flashOdds.yes) : prev.oddYes,
      oddNo: flashOdds ? String(flashOdds.no) : prev.oddNo,
    }));
    const oddsMsg = flashOdds ? ` Odds BTTS ${flashOdds.yes}/${flashOdds.no} incluídas.` : '';
    setFilledMsg(
      `${home.name} (casa) e ${away.name} (fora) preenchidos a partir do Flashscore.${oddsMsg}`,
    );
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

  // ---- save to history / bets ----
  const addBet = useMartingale((s) => s.addBet);
  const [savedHistory, setSavedHistory] = useState(false);
  const [savedBet, setSavedBet] = useState(false);
  // Any change to the inputs invalidates the previous "saved" confirmations.
  useEffect(() => {
    setSavedHistory(false);
    setSavedBet(false);
  }, [form]);

  const matchLabel = `${form.homeName || 'Casa'} vs ${form.awayName || 'Fora'}`;
  // BTTS=SIM when the model leans yes; the matching odd powers the bet stake.
  const selection: 'SIM' | 'NÃO' = result && result.prediction.probYes >= 0.5 ? 'SIM' : 'NÃO';
  const selectionOdd = selection === 'SIM' ? n(form.oddYes) : n(form.oddNo);
  const canBet = selectionOdd > 1;

  const buildRecord = (prediction: BttsPrediction): HistoryRecord => ({
    id: `manual-${Date.now()}`,
    fixtureId: `manual-${Date.now()}`,
    fixtureName: matchLabel,
    competition: 'Manual',
    date: new Date().toISOString(),
    probYes: prediction.probYes,
    probNo: prediction.probNo,
    confidence: prediction.confidence,
    tier: prediction.tier,
    createdAt: Date.now(),
    // No providerId: manual games can't be auto-settled from a data source.
    factorScores: Object.fromEntries(prediction.factors.map((f) => [f.key, f.score])),
  });

  const saveToHistory = (): void => {
    if (!result) return;
    void upsertHistory(buildRecord(result.prediction))
      .then(() => setSavedHistory(true))
      .catch((err) => log.warn('manual history save failed', err));
  };

  const saveToBets = (): void => {
    if (!result || !canBet) return;
    void addBet({ matchLabel, market: 'BTTS', selection, odds: selectionOdd })
      .then(() => setSavedBet(true))
      .catch((err) => log.warn('manual bet add failed', err));
  };

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

      {/* ---- Flashscore import (RapidAPI) ---- */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            <Zap className="h-4 w-4" /> Importar do Flashscore (1 clique)
          </CardTitle>
          <CardDescription className="text-xs">
            Cola o link do jogo no Flashscore (ou o id do jogo) e a app preenche{' '}
            <span className="font-medium">as duas equipas e o H2H</span> com um só pedido — sem
            copiar/colar página a página. Requer a chave RapidAPI e o Proxy CORS em Definições.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label
              htmlFor="flash-url"
              className="flex items-center justify-between gap-2 text-xs font-medium"
            >
              <span>Link do jogo ou id (match_id)</span>
              <button
                type="button"
                onClick={() => void pasteFlash()}
                className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium text-primary hover:bg-primary/10"
                aria-label="Colar link da área de transferência"
              >
                <ClipboardPaste className="h-3.5 w-3.5" /> Colar
              </button>
            </Label>
            <div className="flex gap-2">
              <Input
                id="flash-url"
                type="text"
                inputMode="url"
                autoComplete="off"
                placeholder="https://www.flashscore.com/match/… ou GCxZ2uHc"
                value={flashInput}
                onChange={(e) => setFlashInput(e.target.value)}
                className="h-8 text-sm"
              />
              <Button size="sm" onClick={() => void fetchFlash()} disabled={flashFetching}>
                <Search className="mr-2 h-4 w-4" />
                {flashFetching ? 'A buscar…' : 'Buscar'}
              </Button>
            </div>
          </div>
          {flashError && (
            <p className="flex items-center gap-1.5 text-xs text-destructive">
              <AlertCircle className="h-3.5 w-3.5" />
              {flashError}
            </p>
          )}
          {flashResult && (
            <div className="space-y-2 rounded-md border border-primary/30 bg-primary/5 p-3">
              <p className="flex items-center gap-1.5 text-xs">
                <Check className="h-3.5 w-3.5 text-primary" />
                <span className="font-semibold">
                  {(flashSwap ? flashResult.teams[1] : flashResult.teams[0]).name}
                </span>{' '}
                (casa) vs{' '}
                <span className="font-semibold">
                  {(flashSwap ? flashResult.teams[0] : flashResult.teams[1]).name}
                </span>{' '}
                (fora)
                {flashResult.h2h.played >= 1 && (
                  <>
                    {' '}
                    · H2H BTTS {flashResult.h2h.bttsPct}% ({flashResult.h2h.played}j)
                  </>
                )}
              </p>
              {(() => {
                const [a, b] = flashResult.teams;
                const home = flashSwap ? b : a;
                const away = flashSwap ? a : b;
                const hs: FlashSplit = home.home.played >= 1 ? home.home : home.overall;
                const as: FlashSplit = away.away.played >= 1 ? away.away : away.overall;
                const noData = hs.played === 0 && as.played === 0;
                return (
                  <div className="space-y-0.5 text-[11px] text-muted-foreground">
                    <p>
                      🏠 <span className="font-medium text-foreground">{home.name}</span>:{' '}
                      {round(hs.goalsFor, 2)}–{round(hs.goalsAgainst, 2)} golos · BTTS{' '}
                      {round(hs.bttsPct, 0)}% · {hs.played}j
                    </p>
                    <p>
                      ✈️ <span className="font-medium text-foreground">{away.name}</span>:{' '}
                      {round(as.goalsFor, 2)}–{round(as.goalsAgainst, 2)} golos · BTTS{' '}
                      {round(as.bttsPct, 0)}% · {as.played}j
                    </p>
                    {flashOdds && (
                      <p>
                        💰 Odds BTTS (mercado): Sim{' '}
                        <span className="font-medium text-foreground">{flashOdds.yes}</span> · Não{' '}
                        <span className="font-medium text-foreground">{flashOdds.no}</span> (
                        {flashOdds.bookmakers} {flashOdds.bookmakers === 1 ? 'casa' : 'casas'})
                      </p>
                    )}
                    {noData && (
                      <p className="flex items-center gap-1.5 text-destructive">
                        <AlertCircle className="h-3.5 w-3.5" />
                        Recebi o jogo mas não calculei estatísticas (sem jogos de forma na
                        resposta).
                      </p>
                    )}
                  </div>
                );
              })()}
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => applyFlash(flashResult)}>
                  Preencher casa e fora
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setFlashSwap((v) => !v)}>
                  <RotateCcw className="mr-2 h-3.5 w-3.5" /> Trocar casa/fora
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Usa a forma em casa da 1ª equipa e a forma fora da 2ª. Se o jogo estiver invertido,
                usa “Trocar casa/fora” antes de preencher.
              </p>
            </div>
          )}
          {flashRaw && (
            <details className="rounded-md border border-border bg-muted/30 p-2 text-xs">
              <summary className="cursor-pointer select-none font-medium text-muted-foreground">
                Resposta da API (debug) — {(flashRaw.length / 1024).toFixed(0)} KB
              </summary>
              <div className="mt-2 space-y-2">
                <p className="text-[10px] text-muted-foreground">
                  Se as estatísticas vierem a 0, copia esta resposta e partilha para alinharmos a
                  leitura ao formato real deste jogo.
                </p>
                <Button size="sm" variant="secondary" onClick={() => void copyFlashRaw()}>
                  {flashCopied ? (
                    <>
                      <Check className="mr-2 h-4 w-4" /> Copiado
                    </>
                  ) : (
                    <>
                      <ClipboardPaste className="mr-2 h-4 w-4" /> Copiar resposta
                    </>
                  )}
                </Button>
                <textarea
                  readOnly
                  value={flashRaw}
                  rows={6}
                  onFocus={(e) => e.currentTarget.select()}
                  className="w-full resize-y rounded-md border border-input bg-background px-2 py-1.5 font-mono text-[10px] outline-none"
                />
              </div>
            </details>
          )}
        </CardContent>
      </Card>

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
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="secondary" onClick={() => void pasteFromClipboard()}>
              <ClipboardPaste className="mr-2 h-4 w-4" /> Colar conteúdo
            </Button>
            {importHtml.trim() && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setImportHtml('');
                  setPasteError(null);
                }}
              >
                Limpar
              </Button>
            )}
            <span className="text-[10px] text-muted-foreground">
              ou cola manualmente na caixa abaixo
            </span>
          </div>
          {pasteError && (
            <p className="flex items-center gap-1.5 text-xs text-destructive">
              <AlertCircle className="h-3.5 w-3.5" />
              {pasteError}
            </p>
          )}
          <textarea
            value={importHtml}
            onChange={(e) => setImportHtml(e.target.value)}
            placeholder="Cola aqui o texto (ou o código-fonte) da página da equipa…"
            rows={3}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            className="w-full resize-y rounded-md border border-input bg-background px-3 py-2 font-mono text-xs outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
          {importHtml.trim() && !imported && (
            <p className="flex items-center gap-1.5 text-xs text-destructive">
              <AlertCircle className="h-3.5 w-3.5" />
              Não reconheci uma página de equipa do FootyStats. Confirma que copiaste o conteúdo
              completo da página de um clube (texto ou código-fonte).
            </p>
          )}
          {filledMsg && !imported && (
            <p className="flex items-center gap-1.5 text-xs text-primary">
              <Check className="h-3.5 w-3.5" />
              {filledMsg}
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
                  Pôr {imported.name || 'esta equipa'} na Casa
                </Button>
                <Button size="sm" variant="outline" onClick={() => fillAway(imported)}>
                  Pôr {imported.name || 'esta equipa'} na Fora
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Esta página é de <span className="font-medium">uma</span> equipa. Para a outra,
                importa a página dela e usa o outro botão.
              </p>
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

                  {/* Save actions */}
                  <div className="flex flex-wrap gap-2 border-t pt-3">
                    <Button
                      size="sm"
                      variant={savedHistory ? 'default' : 'outline'}
                      onClick={saveToHistory}
                      disabled={savedHistory}
                    >
                      {savedHistory ? (
                        <Check className="mr-2 h-4 w-4" />
                      ) : (
                        <Save className="mr-2 h-4 w-4" />
                      )}
                      {savedHistory ? 'Guardado no histórico' : 'Guardar no histórico'}
                    </Button>
                    <Button
                      size="sm"
                      variant={savedBet ? 'default' : 'outline'}
                      onClick={saveToBets}
                      disabled={!canBet || savedBet}
                      title={
                        canBet ? undefined : 'Indica a odd BTTS ' + selection + ' para apostar'
                      }
                    >
                      {savedBet ? (
                        <Check className="mr-2 h-4 w-4" />
                      ) : (
                        <Coins className="mr-2 h-4 w-4" />
                      )}
                      {savedBet ? 'Adicionado às apostas' : `Apostar BTTS ${selection}`}
                    </Button>
                  </div>
                  {!canBet && (
                    <p className="text-[10px] text-muted-foreground">
                      Para criar a aposta, indica a odd BTTS {selection} nas “Odds do mercado”.
                    </p>
                  )}
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
