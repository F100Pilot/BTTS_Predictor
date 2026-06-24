import type { DashboardFilterState } from './filters';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { sanitizeNumber } from '@/services/sanitize';

interface Props {
  value: DashboardFilterState;
  competitions: string[];
  countries: string[];
  onChange: (next: DashboardFilterState) => void;
}

export function DashboardFilters({ value, competitions, countries, onChange }: Props) {
  const set = (patch: Partial<DashboardFilterState>): void => onChange({ ...value, ...patch });

  return (
    <div className="grid grid-cols-1 gap-3 rounded-lg border bg-card p-4 sm:grid-cols-2 lg:grid-cols-6">
      <div className="space-y-1.5">
        <Label htmlFor="f-date">Data</Label>
        <Input
          id="f-date"
          type="date"
          value={value.date}
          onChange={(e) => set({ date: e.target.value })}
        />
      </div>

      <div className="space-y-1.5">
        <Label>Campeonato</Label>
        <Select value={value.competition} onValueChange={(v) => set({ competition: v })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {competitions.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label>País</Label>
        <Select value={value.country} onValueChange={(v) => set({ country: v })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {countries.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="f-btts">BTTS mínimo (%)</Label>
        <Input
          id="f-btts"
          type="number"
          min={0}
          max={100}
          value={value.minBtts}
          onChange={(e) =>
            set({ minBtts: sanitizeNumber(e.target.value, { min: 0, max: 100, fallback: 0 }) })
          }
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="f-odds-min">Odds mín.</Label>
        <Input
          id="f-odds-min"
          type="number"
          min={0}
          step="0.01"
          value={value.minOdds || ''}
          placeholder="—"
          onChange={(e) =>
            set({ minOdds: sanitizeNumber(e.target.value, { min: 0, max: 100, fallback: 0 }) })
          }
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="f-odds-max">Odds máx.</Label>
        <Input
          id="f-odds-max"
          type="number"
          min={0}
          step="0.01"
          value={value.maxOdds || ''}
          placeholder="—"
          onChange={(e) =>
            set({ maxOdds: sanitizeNumber(e.target.value, { min: 0, max: 100, fallback: 0 }) })
          }
        />
      </div>
    </div>
  );
}
