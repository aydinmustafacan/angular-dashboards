import { TemplateRef } from '@angular/core';
import { DashDayKey } from '../calendar-grid.dates';

/** A caller's template with the context to stamp it with. */
export interface Rendered {
  template: TemplateRef<unknown>;
  context: object;
}

export const rendered = <C extends object>(
  template: TemplateRef<C> | undefined,
  context: C,
): Rendered | null => (template ? { template: template as TemplateRef<unknown>, context } : null);

/** What every day column hands its header and cells. */
export interface DayColumnParams {
  day: DashDayKey;
  /** The first day of a new week, after the first column: a gap marks the change. */
  weekStart: boolean;
}
