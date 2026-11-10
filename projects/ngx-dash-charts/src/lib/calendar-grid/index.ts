import { DashCalendarGrid } from './calendar-grid';
import {
  DashCalendarGridAside,
  DashCalendarGridDayCell,
  DashCalendarGridFooter,
  DashCalendarGridGroupHeading,
  DashCalendarGridRowHeader,
  DashCalendarGridSummaryCell,
  DashCalendarGridTools,
  DashCalendarGridTotalCell,
} from './calendar-grid.slots';

export { DashCalendarGrid, type DashCalendarGridCellEvent } from './calendar-grid';
export {
  DASH_CALENDAR_GRID,
  injectCalendarGrid,
  type DashCalendarGridContext,
} from './calendar-grid.context';
export {
  type DashCalendarRange,
  type DashDayKey,
  fromDayKey,
  toDayKey,
} from './calendar-grid.dates';
export { DASH_CALENDAR_RANGES, type DashCalendarRangeOption } from './calendar-grid.period';
export * from './calendar-grid.slots';

/** Everything a template needs to compose a calendar grid: `imports: [DASH_CALENDAR_GRID_IMPORTS]`. */
export const DASH_CALENDAR_GRID_IMPORTS = [
  DashCalendarGrid,
  DashCalendarGridDayCell,
  DashCalendarGridRowHeader,
  DashCalendarGridTotalCell,
  DashCalendarGridSummaryCell,
  DashCalendarGridGroupHeading,
  DashCalendarGridTools,
  DashCalendarGridFooter,
  DashCalendarGridAside,
] as const;
