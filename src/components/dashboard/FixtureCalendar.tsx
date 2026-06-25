import { useEffect, useState } from 'react';
import { startOfMonth, endOfMonth, format, parseISO } from 'date-fns';
import { Calendar } from '@/components/ui/calendar';
import { useDataService } from '@/hooks/useDataService';
import { createLogger } from '@/services/logger';

const log = createLogger('FixtureCalendar');

interface Props {
  selected?: Date;
  onSelect: (date: Date) => void;
}

/** Calendar that highlights days with fixtures (from the active data source). */
export function FixtureCalendar({ selected, onSelect }: Props) {
  const data = useDataService();
  const [month, setMonth] = useState<Date>(selected ?? new Date());
  const [marked, setMarked] = useState<Date[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const from = format(startOfMonth(month), 'yyyy-MM-dd');
        const to = format(endOfMonth(month), 'yyyy-MM-dd');
        const dates = await data.getFixtureDatesInRange(from, to);
        if (!cancelled) setMarked(dates.map((d) => parseISO(d)));
      } catch (err) {
        log.warn('failed to load fixture dates', err);
        if (!cancelled) setMarked([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [data, month]);

  return (
    <Calendar
      mode="single"
      selected={selected}
      month={month}
      onMonthChange={setMonth}
      onSelect={(d) => d && onSelect(d)}
      modifiers={{ hasGames: marked }}
      modifiersClassNames={{
        hasGames:
          'font-semibold after:absolute after:bottom-1 after:left-1/2 after:h-1 after:w-1 after:-translate-x-1/2 after:rounded-full after:bg-primary',
      }}
    />
  );
}
