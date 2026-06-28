import { useEffect, useState } from 'react';
import { Wand2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useCalibration } from '@/store/calibrationStore';
import { useSettings } from '@/store/settingsStore';
import { applyPlatt } from '@/core/backtest/backtest';

const STORAGE_KEY = 'btts:lastCalib';

interface Stored {
  a: number;
  b: number;
  n: number;
}

const round3 = (n: number): number => Math.round(n * 1000) / 1000;
const pct = (n: number): string => `${Math.round(n * 100)}%`;

/** Sample probabilities used to illustrate (and detect) the calibration effect. */
const PROBES = [0.3, 0.5, 0.7];

/**
 * Shows a one-time pop-up whenever auto-calibration changes the model — i.e.
 * when newly-settled results refit the Platt mapping. Explains, in plain terms,
 * how predictions shift and why, then records the calibration so it won't repeat
 * until it changes again.
 */
export function CalibrationNoticeDialog() {
  const platt = useCalibration((s) => s.platt);
  const ready = useCalibration((s) => s.ready);
  const sampleSize = useCalibration((s) => s.sampleSize);
  const autoCalibrate = useSettings((s) => s.autoCalibrate);
  const [open, setOpen] = useState(false);
  const [prev, setPrev] = useState<Stored | null>(null);

  useEffect(() => {
    if (!autoCalibrate || !ready) return;
    // Only meaningful when the calibration actually moves a probability ≥ 1pp.
    const maxDelta = Math.max(...PROBES.map((p) => Math.abs(applyPlatt(p, platt) - p)));
    if (maxDelta < 0.01) return;

    const cur = { a: round3(platt.a), b: round3(platt.b) };
    let stored: Stored | null = null;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) stored = JSON.parse(raw) as Stored;
    } catch {
      stored = null;
    }
    if (stored && stored.a === cur.a && stored.b === cur.b) return; // unchanged

    setPrev(stored);
    setOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [platt.a, platt.b, sampleSize, autoCalibrate, ready]);

  const dismiss = (): void => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ a: round3(platt.a), b: round3(platt.b), n: sampleSize }),
      );
    } catch {
      // ignore
    }
    setOpen(false);
  };

  const examples = PROBES.map((p) => ({ p, q: applyPlatt(p, platt) }));
  const probe = applyPlatt(0.6, platt) - 0.6;
  const justification =
    probe < -0.005
      ? 'tende a baixar as probabilidades de BTTS SIM — nos jogos já decididos o modelo estava a sobrestimar o “ambas marcam”, e a calibração aproxima as previsões dos resultados reais.'
      : probe > 0.005
        ? 'tende a subir as probabilidades de BTTS SIM — nos jogos já decididos o modelo estava a subestimar o “ambas marcam”, e a calibração aproxima as previsões dos resultados reais.'
        : 'faz apenas pequenos ajustes, aproximando as previsões dos resultados observados.';

  return (
    <Dialog open={open} onOpenChange={(o) => !o && dismiss()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="h-5 w-5 text-primary" /> Auto-calibração atualizada
          </DialogTitle>
          <DialogDescription>
            Com base em {sampleSize} jogos com resultado real, o modelo recalibrou as previsões.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
            <p className="text-xs text-muted-foreground">Item afetado</p>
            <p className="font-semibold">Probabilidade final de BTTS SIM</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              É uma calibração global da probabilidade — não altera os pesos individuais (Forma,
              BTTS, Ataque…).
            </p>
          </div>

          <p className="text-muted-foreground">A calibração {justification}</p>

          <div className="rounded-lg border bg-muted/30 p-3">
            <div className="mb-1.5 flex items-center justify-between text-xs font-medium text-muted-foreground">
              <span>Previsão do modelo</span>
              <span>Após calibração</span>
            </div>
            <div className="space-y-1">
              {examples.map(({ p, q }) => (
                <div key={p} className="flex items-center justify-between tabular-nums">
                  <span className="text-muted-foreground">{pct(p)}</span>
                  <span
                    className={
                      q < p ? 'font-semibold text-destructive' : 'font-semibold text-success'
                    }
                  >
                    {pct(q)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {prev && (
            <p className="text-xs text-muted-foreground">
              Ajuste face à calibração anterior (baseada em {prev.n} jogos).
            </p>
          )}
        </div>

        <div className="flex justify-end">
          <Button size="sm" onClick={dismiss}>
            Entendido
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
