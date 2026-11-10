import {
  addDays,
  addMonths,
  addWeeks,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isWeekend,
  parse,
  startOfMonth,
  startOfWeek,
} from 'date-fns';

/** A calendar day in local time, formatted `yyyy-MM-dd`. Never derive one with `toISOString()`. */
export type DashDayKey = string;

/** How much of the calendar the grid shows at once. */
export type DashCalendarRange = 'week' | 'fortnight' | 'month';

const WEEK = { weekStartsOn: 1 } as const;

export const toDayKey = (date: Date): DashDayKey => format(date, 'yyyy-MM-dd');
export const fromDayKey = (day: DashDayKey): Date => parse(day, 'yyyy-MM-dd', new Date(2000, 0, 1));

export const isWorkday = (day: DashDayKey): boolean => !isWeekend(fromDayKey(day));
export const isMonday = (day: DashDayKey): boolean => fromDayKey(day).getDay() === 1;

export const formatDay = (day: DashDayKey, pattern = 'EEE d MMM'): string =>
  format(fromDayKey(day), pattern);

/** Every day from `start` to `end`, both inclusive. */
export function daysBetween(start: DashDayKey, end: DashDayKey): DashDayKey[] {
  if (start > end) return [];
  return eachDayOfInterval({ start: fromDayKey(start), end: fromDayKey(end) }).map(toDayKey);
}

/** Every workday from `start` to `end`, both inclusive. */
export function workdaysBetween(start: DashDayKey, end: DashDayKey): DashDayKey[] {
  return daysBetween(start, end).filter(isWorkday);
}

/** The first and last day (Monday to Sunday weeks) of the period containing `anchor`. */
export function periodBounds(
  anchor: DashDayKey,
  range: DashCalendarRange,
): { start: DashDayKey; end: DashDayKey } {
  const date = fromDayKey(anchor);
  if (range === 'month') {
    return { start: toDayKey(startOfMonth(date)), end: toDayKey(endOfMonth(date)) };
  }
  const end = range === 'week' ? endOfWeek(date, WEEK) : addDays(endOfWeek(date, WEEK), 7);
  return { start: toDayKey(startOfWeek(date, WEEK)), end: toDayKey(end) };
}

export function shiftAnchor(
  anchor: DashDayKey,
  range: DashCalendarRange,
  direction: 1 | -1,
): DashDayKey {
  const date = fromDayKey(anchor);
  if (range === 'month') return toDayKey(addMonths(date, direction));
  return toDayKey(addWeeks(date, direction * (range === 'week' ? 1 : 2)));
}

/** "Mon 9 – Fri 13 Nov", or a single day when both ends match. */
export function formatSpan(start: DashDayKey, end: DashDayKey): string {
  if (start === end) return formatDay(start);
  const sameMonth = isSameMonth(fromDayKey(start), fromDayKey(end));
  return `${formatDay(start, sameMonth ? 'EEE d' : 'EEE d MMM')} – ${formatDay(end)}`;
}

/** Friday of the week that ends on `sunday`. */
export const workweekEnd = (sunday: DashDayKey): DashDayKey => toDayKey(addDays(fromDayKey(sunday), -2));
