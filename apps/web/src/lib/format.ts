const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0
});

export const formatInr = (amount: number) => inr.format(amount);

export function formatTimecode(totalSeconds: number) {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  const pad = (value: number) => String(value).padStart(2, '0');
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(rest)}` : `${minutes}:${pad(rest)}`;
}

/** Runtime as a person would say it: "3h 12m", "48m", "under a minute". */
export function formatRuntime(totalSeconds: number) {
  if (totalSeconds <= 0) return 'Runtime coming soon';
  const minutes = Math.round(totalSeconds / 60);
  if (minutes < 1) return 'under a minute';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}

const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
const DIVISIONS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ['second', 60],
  ['minute', 60],
  ['hour', 24],
  ['day', 7],
  ['week', 4.34524],
  ['month', 12],
  ['year', Number.POSITIVE_INFINITY]
];

export function formatRelative(input: string | Date) {
  const date = typeof input === 'string' ? new Date(input) : input;
  if (Number.isNaN(date.getTime())) return '';

  let duration = (date.getTime() - Date.now()) / 1000;
  for (const [unit, amount] of DIVISIONS) {
    if (Math.abs(duration) < amount) return rtf.format(Math.round(duration), unit);
    duration /= amount;
  }
  return '';
}

const dateFormat = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  year: 'numeric'
});

export function formatDate(input: string | Date | null | undefined) {
  if (!input) return '—';
  const date = typeof input === 'string' ? new Date(input) : input;
  return Number.isNaN(date.getTime()) ? '—' : dateFormat.format(date);
}

export function toDateInputValue(input: string | Date | null | undefined) {
  if (!input) return '';
  const date = typeof input === 'string' ? new Date(input) : input;
  if (Number.isNaN(date.getTime())) return '';
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

export function initials(name: string | null | undefined) {
  const source = (name ?? '').trim();
  if (!source) return '··';
  return source
    .split(/\s+/)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() ?? '')
    .join('');
}

/** Shot numbers read like a slate: 01, 02, … */
export const slateNumber = (index: number) => String(index + 1).padStart(2, '0');
