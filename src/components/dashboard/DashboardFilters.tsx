import { useState } from 'react';
import { format, parseISO, isValid } from 'date-fns';
import { Calendar as CalendarIcon } from 'lucide-react';
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
import { Button } from '@/components/ui/button';
import { FixtureCalendar } from './FixtureCalendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { formatDate } from '@/lib/format';
import { sanitizeNumber } from '@/services/sanitize';

interface Props {
  value: DashboardFilterState;
  competitions: string[];
  countries: string[];
  onChange: (next: DashboardFilterState) => void;
}

export function DashboardFilters({ value, competitions, countries, onChange }: Props) {
  const set = (patch: Partial<DashboardFilterState>): void => onChange({ ...value, ...patch });
  const [open, setOpen] = useState(false);
  const selected = isValid(parseISO(value.date)) ? parseISO(value.date) : undefined;

  return (
    <div className="grid grid-cols-1 gap-3 rounded-lg border bg-card p-4 sm:grid-cols-2 lg:grid-cols-6">
      <div className="space-y-1.5">
        <Label>Data</Label>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-full justify-start font-normal">
              <CalendarIcon className="mr-2 h-4 w-4" />
              {formatDate(value.date)}
            </Button>
          </PopoverTrigger>
          <PopoverContent>
            <FixtureCalendar
              selected={selected}
              onSelect={(d) => {
                set({ date: format(d, 'yyyy-MM-dd') });
                setOpen(false);
              }}
            />
          </PopoverContent>
        </Popover>
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
