import { InjectionToken, Signal, inject } from '@angular/core';
import { DashDayKey } from './calendar-grid.dates';

/** Calendar state shared by the grid's cells and headers. Read-only; change it through `select`. */
export interface DashCalendarGridContext {
  readonly today: Signal<DashDayKey>;
  readonly days: Signal<readonly DashDayKey[]>;
  readonly selectedDay: Signal<DashDayKey>;
  /** True when the period is a week or less, so cells have room for words. */
  readonly wide: Signal<boolean>;
  select(day: DashDayKey): void;
}

export const DASH_CALENDAR_GRID = new InjectionToken<DashCalendarGridContext>('DASH_CALENDAR_GRID');

/** For parts: fails loudly when used outside `<dash-calendar-grid>`. */
export function injectCalendarGrid(part: string): DashCalendarGridContext {
  const context = inject(DASH_CALENDAR_GRID, { optional: true });
  if (!context) throw new Error(`<${part}> must be placed inside <dash-calendar-grid>.`);
  return context;
}
