import { useState } from 'react';
import { Plus } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { addHistory } from '@/data/cache/repositories';
import { tierForProbability } from '@/core/classification/classification';
import { clamp } from '@/lib/math';
import { todayIso } from '@/lib/format';
import { sanitizeNumber, sanitizeText } from '@/services/sanitize';

/** Manually add a game to the prediction history (no bet required). */
export function AddHistoryDialog({ onAdded }: { onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [home, setHome] = useState('');
  const [away, setAway] = useState('');
  const [competition, setCompetition] = useState('');
  const [date, setDate] = useState(todayIso());
  const [side, setSide] = useState<'yes' | 'no'>('yes');
  const [prob, setProb] = useState('70');
  const [actual, setActual] = useState<'none' | 'yes' | 'no'>('none');

  const reset = (): void => {
    setHome('');
    setAway('');
    setCompetition('');
    setDate(todayIso());
    setSide('yes');
    setProb('70');
    setActual('none');
  };

  const canSave = home.trim().length > 0 && away.trim().length > 0;

  const handleSave = async (): Promise<void> => {
    const pct = clamp(sanitizeNumber(prob, { min: 0, max: 100, fallback: 50 }) / 100);
    const probYes = side === 'yes' ? pct : clamp(1 - pct);
    const probNo = clamp(1 - probYes);
    const id = `manual-${Date.now()}`;
    await addHistory({
      id,
      fixtureId: id,
      fixtureName: `${sanitizeText(home)} vs ${sanitizeText(away)}`,
      competition: competition.trim() ? sanitizeText(competition) : 'Manual',
      date: `${date}T12:00:00.000Z`,
      probYes,
      probNo,
      confidence: 0,
      tier: tierForProbability(Math.max(probYes, probNo)),
      createdAt: Date.now(),
      trackedMarkets: ['btts'],
      ...(actual === 'none' ? {} : { actual }),
    });
    reset();
    setOpen(false);
    onAdded();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus /> Adicionar jogo
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adicionar jogo ao histórico</DialogTitle>
          <DialogDescription>
            Registe um jogo manualmente (sem aposta). Útil para acompanhar previsões próprias.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="ah-home">Equipa casa</Label>
            <Input id="ah-home" value={home} onChange={(e) => setHome(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="ah-away">Equipa fora</Label>
            <Input id="ah-away" value={away} onChange={(e) => setAway(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="ah-comp">Competição</Label>
            <Input
              id="ah-comp"
              value={competition}
              placeholder="Opcional"
              onChange={(e) => setCompetition(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="ah-date">Data</Label>
            <Input
              id="ah-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label>Previsão BTTS</Label>
            <Select value={side} onValueChange={(v) => setSide(v as 'yes' | 'no')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="yes">SIM</SelectItem>
                <SelectItem value="no">NÃO</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="ah-prob">Probabilidade (%)</Label>
            <Input
              id="ah-prob"
              inputMode="decimal"
              value={prob}
              onChange={(e) => setProb(e.target.value)}
            />
          </div>
          <div className="col-span-2 space-y-1">
            <Label>Resultado real (opcional)</Label>
            <Select value={actual} onValueChange={(v) => setActual(v as 'none' | 'yes' | 'no')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Por definir</SelectItem>
                <SelectItem value="yes">BTTS SIM</SelectItem>
                <SelectItem value="no">BTTS NÃO</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <DialogClose asChild>
            <Button variant="ghost" size="sm">
              Cancelar
            </Button>
          </DialogClose>
          <Button size="sm" disabled={!canSave} onClick={() => void handleSave()}>
            Guardar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
