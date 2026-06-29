import { useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { useSettings } from '@/store/settingsStore';
import { FACTOR_LABELS, normalizeWeights, type FactorKey } from '@/core/prediction/weights';
import { tuneWeights, type TuneResult, type TuneSample } from '@/core/backtest/tuneWeights';
import { listHistory } from '@/data/cache/repositories';
import { sanitizeNumber } from '@/services/sanitize';
import { round } from '@/lib/math';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

/** A weight slider with a marker for the value before the last optimization. */
function WeightSlider({
  label,
  value,
  prev,
  displayPct,
  onChange,
}: {
  label: string;
  value: number; // 0..1 (raw)
  prev: number | null; // 0..1 (raw) or null
  displayPct: number; // normalized %
  onChange: (v: number) => void;
}) {
  const cur = Math.max(0, Math.min(1, value));
  const near = prev != null && Math.abs(prev - cur) < 0.02;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <Label>{label}</Label>
        <span className="tabular-nums text-muted-foreground">{displayPct}%</span>
      </div>
      <div className="relative h-5 select-none">
        <div className="absolute left-0 top-1/2 h-1.5 w-full -translate-y-1/2 rounded-full bg-muted" />
        <div
          className="absolute left-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-primary"
          style={{ width: `${cur * 100}%` }}
        />
        {prev != null && (
          <div
            className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${prev * 100}%` }}
            title={`Antes: ${Math.round(prev * 100)}%`}
          >
            {near ? (
              <div className="h-4 border-l-2 border-dashed border-destructive" />
            ) : (
              <div className="h-4 w-[3px] rounded-full bg-destructive" />
            )}
          </div>
        )}
        <div
          className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-primary bg-background"
          style={{ left: `${cur * 100}%` }}
        />
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          aria-label={label}
        />
      </div>
    </div>
  );
}

/**
 * BTTS model-tuning panel: factor weights (+ optimize/reset), market-odds
 * calibration and the auto-calibration toggle. Lives in the History tab under
 * the BTTS market — these levers only exist for BTTS (the other markets use a
 * Poisson model with no factor weights).
 */
export function ModelTuningPanel() {
  const settings = useSettings();
  const normalized = normalizeWeights(settings.weights);
  const [tuneResult, setTuneResult] = useState<TuneResult | null>(null);
  const [tuneMsg, setTuneMsg] = useState<string | null>(null);

  const updateWeight = (key: FactorKey, value: number): void => {
    settings.setWeights({ ...settings.weights, [key]: value });
  };

  const handleTune = async (): Promise<void> => {
    setTuneMsg(null);
    setTuneResult(null);
    const records = await listHistory(2000);
    const samples: TuneSample[] = records
      .filter((r) => (r.actual === 'yes' || r.actual === 'no') && r.factorScores)
      .map((r) => ({
        scores: r.factorScores as TuneSample['scores'],
        outcome: r.actual === 'yes' ? 1 : 0,
      }));
    if (samples.length < 20) {
      setTuneMsg(
        `Precisas de pelo menos 20 jogos com resultado real e fatores registados (tens ${samples.length}).`,
      );
      return;
    }
    setTuneResult(tuneWeights(samples, settings.weights));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Pesos do Modelo (BTTS)</CardTitle>
        <CardDescription>
          Ajuste a influência de cada fator. Os valores são normalizados para somar 100%.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {(Object.keys(FACTOR_LABELS) as FactorKey[]).map((key) => (
          <WeightSlider
            key={key}
            label={FACTOR_LABELS[key]}
            value={settings.weights[key]}
            prev={settings.prevWeights ? (settings.prevWeights[key] ?? null) : null}
            displayPct={round(normalized[key] * 100)}
            onChange={(v) => updateWeight(key, sanitizeNumber(v, { min: 0, max: 1, fallback: 0 }))}
          />
        ))}
        {settings.prevWeights && (
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <span className="h-1.5 w-3 rounded-full bg-primary" /> Atual
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-3 w-[3px] rounded-full bg-destructive" /> Antes da otimização
            </span>
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={settings.resetWeights}>
            <RotateCcw /> Repor pesos por defeito
          </Button>
          <Button variant="outline" size="sm" onClick={() => void handleTune()}>
            Otimizar pesos com resultados
          </Button>
        </div>
        {tuneMsg && <p className="text-xs text-muted-foreground">{tuneMsg}</p>}
        {tuneResult && (
          <div className="space-y-2 rounded-md border p-3 text-sm">
            <p>
              Brier: <strong>{tuneResult.brierBefore}</strong> →{' '}
              <strong className="text-success">{tuneResult.brierAfter}</strong>{' '}
              <span className="text-xs text-muted-foreground">({tuneResult.n} jogos)</span>
            </p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-3">
              {(Object.keys(FACTOR_LABELS) as FactorKey[]).map((k) => (
                <span key={k}>
                  {FACTOR_LABELS[k]}: <strong>{Math.round(tuneResult.weights[k] * 100)}%</strong>
                </span>
              ))}
            </div>
            <Button
              size="sm"
              onClick={() => {
                settings.applyWeights(tuneResult.weights);
                setTuneResult(null);
                setTuneMsg('Pesos otimizados aplicados.');
              }}
            >
              Aplicar pesos otimizados
            </Button>
          </div>
        )}

        <div className="space-y-1 border-t pt-4">
          <div className="flex justify-between text-sm">
            <Label htmlFor="odds-cal">Calibração com odds de mercado</Label>
            <span className="tabular-nums text-muted-foreground">
              {round(settings.oddsCalibration * 100)}%
            </span>
          </div>
          <input
            id="odds-cal"
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={settings.oddsCalibration}
            onChange={(e) =>
              settings.setOddsCalibration(
                sanitizeNumber(e.target.value, { min: 0, max: 1, fallback: 0 }),
              )
            }
            className="w-full accent-[hsl(var(--primary))]"
          />
          <p className="text-xs text-muted-foreground">
            Mistura a probabilidade do modelo com a probabilidade implícita nas odds (sem margem da
            casa). 0% = modelo puro; valores baixos (ex.: 20-30%) aproximam-no do mercado sem o
            copiar. Requer odds disponíveis no jogo.
          </p>
        </div>

        <label className="flex items-start gap-2 border-t pt-4 text-sm">
          <input
            type="checkbox"
            checked={settings.autoCalibrate}
            onChange={(e) => settings.setAutoCalibrate(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-[hsl(var(--primary))]"
          />
          <span>
            Auto-calibração pelos resultados
            <span className="block text-xs font-normal text-muted-foreground">
              A app aprende com os resultados que registar no Histórico: corrige o excesso/defeito
              de confiança das previsões (recalibração estatística, ~15+ jogos) e otimiza
              automaticamente os pesos do modelo (~20+ jogos) — nos sliders acima, a barra vermelha
              mostra o valor anterior a cada otimização.
            </span>
          </span>
        </label>
      </CardContent>
    </Card>
  );
}
