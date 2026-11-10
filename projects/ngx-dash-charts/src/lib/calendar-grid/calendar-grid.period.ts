import {
  DashCalendarRange,
  DashDayKey,
  daysBetween,
  formatDay,
  formatSpan,
  periodBounds,
  workdaysBetween,
  workweekEnd,
} from './calendar-grid.dates';

export interface DashCalendarRangeOption {
  value: DashCalendarRange;
  label: string;
}

export const DASH_CALENDAR_RANGES: readonly DashCalendarRangeOption[] = [
  { value: 'week', label: 'Week' },
  { value: 'fortnight', label: '2 weeks' },
  { value: 'month', label: 'Month' },
];

/** The days shown for a period: workdays only, or every day when `weekends` is on. */
export function periodDays(anchor: DashDayKey, range: DashCalendarRange, weekends: boolean): DashDayKey[] {
  const { start, end } = periodBounds(anchor, range);
  return weekends ? daysBetween(start, end) : workdaysBetween(start, end);
}

/** "November 2026", or the span of the week(s) shown: ending on Friday, or Sunday with weekends. */
export function periodTitle(anchor: DashDayKey, range: DashCalendarRange, weekends: boolean): string {
  if (range === 'month') return formatDay(anchor, 'MMMM yyyy');
  const { start, end } = periodBounds(anchor, range);
  return formatSpan(start, weekends ? end : workweekEnd(end));
}

/** The first shown day on or after `day`, or the last shown day. For "Today" on a weekend. */
export function nearestDay(days: readonly DashDayKey[], day: DashDayKey): DashDayKey {
  return days.find((d) => d >= day) ?? days.at(-1) ?? day;
}

/**
 * Which day stays selected after the period changes: the same day if it is still shown,
 * otherwise today if shown, otherwise the first day.
 */
export function keepSelection(
  days: readonly DashDayKey[],
  selected: DashDayKey,
  today: DashDayKey,
): DashDayKey {
  if (!days.length || days.includes(selected)) return selected;
  return days.includes(today) ? today : days[0];
}
