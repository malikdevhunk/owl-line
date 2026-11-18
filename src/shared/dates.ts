const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

export function utcToday(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = parseUtc(value);
  return parsed.toISOString().slice(0, 10) === value;
}

export function parseUtc(iso: string): Date {
  const [year, month, day] = iso.split('-').map((part) => Number(part));
  return new Date(Date.UTC(year || 1970, (month || 1) - 1, day || 1));
}

export function addDays(iso: string, days: number): string {
  const date = parseUtc(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function weekday(iso: string): number {
  return parseUtc(iso).getUTCDay();
}

export function dayOfYear(iso: string): number {
  const date = parseUtc(iso);
  const start = Date.UTC(date.getUTCFullYear(), 0, 0);
  return Math.floor((date.getTime() - start) / 86_400_000);
}

export function formatLongDate(iso: string): string {
  const date = parseUtc(iso);
  const dayName = DAYS[date.getUTCDay()] ?? 'Day';
  const monthName = MONTHS[date.getUTCMonth()] ?? 'Month';
  return `${dayName} ${date.getUTCDate()} ${monthName}`;
}

export function formatTitleDate(iso: string): string {
  const date = parseUtc(iso);
  const monthName = MONTHS[date.getUTCMonth()] ?? 'Month';
  return `${date.getUTCDate()} ${monthName}`;
}

/** ISO week label, e.g. 2026-W49. */
export function isoWeek(iso: string): string {
  const date = parseUtc(iso);
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

export function dateFromUnknown(data: unknown): string | null {
  if (!data || typeof data !== 'object' || !('date' in data)) return null;
  const value = data.date;
  if (typeof value !== 'string' || !isIsoDate(value)) return null;
  return value;
}
