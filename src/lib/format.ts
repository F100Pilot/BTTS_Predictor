import { format, parseISO, isValid } from 'date-fns';

export function formatTime(iso: string): string {
  const d = parseISO(iso);
  return isValid(d) ? format(d, 'HH:mm') : '--:--';
}

export function formatDate(iso: string): string {
  const d = parseISO(iso);
  return isValid(d) ? format(d, 'dd/MM/yyyy') : '—';
}

export function formatDateTime(iso: string): string {
  const d = parseISO(iso);
  return isValid(d) ? format(d, 'dd/MM/yyyy HH:mm') : '—';
}

/** ISO date (yyyy-MM-dd) for "today" in local time. */
export function todayIso(): string {
  return format(new Date(), 'yyyy-MM-dd');
}
