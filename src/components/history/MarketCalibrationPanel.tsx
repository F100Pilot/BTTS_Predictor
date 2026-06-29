import { useSettings } from '@/store/settingsStore';
import { useCalibration, MIN_CALIBRATION_SAMPLES } from '@/store/calibrationStore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

/**
 * Per-market calibration panel for Over/Under 2.5. This market is a Poisson
 * model (no factor weights), so the only lever is calibration: learning from
 * settled results to correct the model's over/under confidence.
 */
export function Ou25CalibrationPanel() {
  const autoCalibrateOu25 = useSettings((s) => s.autoCalibrateOu25);
  const setAutoCalibrateOu25 = useSettings((s) => s.setAutoCalibrateOu25);
  const ready = useCalibration((s) => s.ou25Ready);
  const sampleSize = useCalibration((s) => s.ou25SampleSize);

  const status = !autoCalibrateOu25
    ? 'desligada'
    : ready
      ? 'ativa ✓'
      : `aguarda dados (${sampleSize}/${MIN_CALIBRATION_SAMPLES})`;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Calibração — Mais/Menos 2.5</CardTitle>
        <CardDescription>
          Este mercado usa um modelo de Poisson (sem pesos). O único ajuste é a calibração — corrige
          o excesso/defeito de confiança do "Mais de 2.5" a partir dos teus resultados.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-sm">
          Estado: <span className="font-medium">{status}</span>
        </div>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={autoCalibrateOu25}
            onChange={(e) => setAutoCalibrateOu25(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-[hsl(var(--primary))]"
          />
          <span>
            Auto-calibração pelos resultados
            <span className="block text-xs font-normal text-muted-foreground">
              Quando ligada e com {MIN_CALIBRATION_SAMPLES}+ jogos com resultado (score)
              introduzido, a app ajusta as percentagens de Mais/Menos 2.5 mostradas, aproximando-as
              do que realmente acontece. Independente da calibração do BTTS.
            </span>
          </span>
        </label>
      </CardContent>
    </Card>
  );
}
