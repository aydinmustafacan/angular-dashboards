import { DashGranularity, DashValueFormat, DashX } from './types';

const numberFormatCache = new Map<string, Intl.NumberFormat>();

function numberFormat(locale: string, options: Intl.NumberFormatOptions): Intl.NumberFormat {
  const key = locale + JSON.stringify(options);
  let nf = numberFormatCache.get(key);
  if (!nf) {
    nf = new Intl.NumberFormat(locale, options);
    numberFormatCache.set(key, nf);
  }
  return nf;
}

/** Formats a value according to a `DashValueFormat`. Null renders as an en dash. */
export function formatValue(
  value: number | null | undefined,
  format: DashValueFormat | undefined,
  locale = 'en-US',
): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '–';
  if (typeof format === 'function') return format(value);
  const f = format ?? {};
  const compact = f.compact ?? Math.abs(value) >= 1_000_000;
  const style = !f.style || f.style === 'number' || (f.style === 'unit' && !f.unit) ? 'decimal' : f.style;
  const options: Intl.NumberFormatOptions = { style, notation: compact ? 'compact' : 'standard' };
  if (f.style === 'currency') options.currency = f.currency ?? 'USD';
  if (f.style === 'unit' && f.unit) {
    options.unit = f.unit;
    options.unitDisplay = 'short';
  }
  if (f.decimals !== undefined) {
    options.minimumFractionDigits = f.decimals;
    options.maximumFractionDigits = f.decimals;
  } else if (compact) {
    options.maximumFractionDigits = 1;
  } else if (f.style === 'percent') {
    options.maximumFractionDigits = 1;
  }
  return numberFormat(locale, options).format(value) + (f.suffix ?? '');
}

/** Formats a relative change (0.042 → "+4.2%"). */
export function formatDelta(delta: number, locale = 'en-US'): string {
  return numberFormat(locale, {
    style: 'percent',
    maximumFractionDigits: 1,
    signDisplay: 'exceptZero',
  }).format(delta);
}

/** Formats a share of total (0.314 → "31.4%"). */
export function formatShare(share: number, locale = 'en-US'): string {
  return numberFormat(locale, { style: 'percent', maximumFractionDigits: 1 }).format(share);
}

export function toDate(x: DashX): Date | null {
  if (x instanceof Date) return x;
  if (typeof x === 'string' && /^\d{4}-\d{2}-\d{2}/.test(x)) {
    const d = new Date(x.length === 10 ? x + 'T00:00:00' : x);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

export function resolveGranularity(granularity: DashGranularity, sample: DashX | undefined): Exclude<DashGranularity, 'auto'> {
  if (granularity !== 'auto') return granularity;
  return sample !== undefined && toDate(sample) ? 'week' : 'category';
}

/** ISO-8601 week number. */
export function isoWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
}

const dateFormatCache = new Map<string, Intl.DateTimeFormat>();

function dateFormat(locale: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = locale + JSON.stringify(options);
  let df = dateFormatCache.get(key);
  if (!df) {
    df = new Intl.DateTimeFormat(locale, options);
    dateFormatCache.set(key, df);
  }
  return df;
}

/** "13–19 Oct" or "29 Sep – 5 Oct" for the 7 days starting at `start`. */
export function weekRange(start: Date, locale = 'en-US'): string {
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return dateFormat(locale, { day: 'numeric', month: 'short' }).formatRange(start, end);
}

/** Short axis label for an x value. */
export function axisLabel(x: DashX, granularity: Exclude<DashGranularity, 'auto'>, locale = 'en-US'): string {
  const d = toDate(x);
  if (!d || granularity === 'category') return String(x);
  if (granularity === 'month') return dateFormat(locale, { month: 'short', year: '2-digit' }).format(d);
  return dateFormat(locale, { day: 'numeric', month: 'short' }).format(d);
}

/** Heading and sub-heading for an x value in tooltips and drill-down panels. */
export function describeX(
  x: DashX,
  granularity: Exclude<DashGranularity, 'auto'>,
  locale = 'en-US',
): { label: string; detail: string } {
  const d = toDate(x);
  if (!d || granularity === 'category') return { label: String(x), detail: '' };
  switch (granularity) {
    case 'week':
      return { label: `Week ${isoWeek(d)}`, detail: `${weekRange(d, locale)} ${d.getFullYear()}` };
    case 'month':
      return { label: dateFormat(locale, { month: 'long' }).format(d), detail: String(d.getFullYear()) };
    default:
      return {
        label: dateFormat(locale, { weekday: 'long' }).format(d),
        detail: dateFormat(locale, { day: 'numeric', month: 'long', year: 'numeric' }).format(d),
      };
  }
}

export function xKey(x: DashX): string {
  return x instanceof Date ? x.toISOString() : String(x);
}

/** Escapes a CSV cell. */
export function csvCell(value: string | number | null): string {
  if (value === null) return '';
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
