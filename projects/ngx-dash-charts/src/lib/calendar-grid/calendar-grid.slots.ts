import { Directive, TemplateRef, inject, input } from '@angular/core';
import { DashDayKey } from './calendar-grid.dates';

// Templates the grid draws in its cells. Rows-typed templates take the rows as their input,
// only so the template's `let-row` is typed: `<ng-template [dashDayCell]="rows" let-row …>`.

export interface DashDayCellContext<T> {
  $implicit: T;
  day: DashDayKey;
  /** The period is a week or less, so there is room for words. */
  wide: boolean;
  selected: boolean;
}

export interface DashRowContext<T> {
  $implicit: T;
}

export interface DashTotalCellContext<T> {
  $implicit: T;
  value: number;
}

export interface DashSummaryCellContext {
  $implicit: DashDayKey;
  wide: boolean;
  selected: boolean;
}

export interface DashGroupHeadingContext {
  $implicit: string;
  size: number;
}

/** Required. What one row shows on one day. */
@Directive({ selector: 'ng-template[dashDayCell]' })
export class DashCalendarGridDayCell<T> {
  readonly rows = input.required<readonly T[]>({ alias: 'dashDayCell' });
  readonly template = inject<TemplateRef<DashDayCellContext<T>>>(TemplateRef);

  static ngTemplateContextGuard<T>(
    _: DashCalendarGridDayCell<T>,
    ctx: unknown,
  ): ctx is DashDayCellContext<T> {
    return true;
  }
}

/** The pinned row label. Without it, the label is `rowLabel(row)` as plain text. */
@Directive({ selector: 'ng-template[dashRowHeader]' })
export class DashCalendarGridRowHeader<T> {
  readonly rows = input.required<readonly T[]>({ alias: 'dashRowHeader' });
  readonly template = inject<TemplateRef<DashRowContext<T>>>(TemplateRef);

  static ngTemplateContextGuard<T>(
    _: DashCalendarGridRowHeader<T>,
    ctx: unknown,
  ): ctx is DashRowContext<T> {
    return true;
  }
}

/** How the total column shows its number. Without it, the number as plain text. */
@Directive({ selector: 'ng-template[dashTotalCell]' })
export class DashCalendarGridTotalCell<T> {
  readonly rows = input.required<readonly T[]>({ alias: 'dashTotalCell' });
  readonly template = inject<TemplateRef<DashTotalCellContext<T>>>(TemplateRef);

  static ngTemplateContextGuard<T>(
    _: DashCalendarGridTotalCell<T>,
    ctx: unknown,
  ): ctx is DashTotalCellContext<T> {
    return true;
  }
}

/** Adds a summary row pinned under the header, with this template in each day. */
@Directive({ selector: 'ng-template[dashSummaryCell]' })
export class DashCalendarGridSummaryCell {
  readonly template = inject<TemplateRef<DashSummaryCellContext>>(TemplateRef);

  static ngTemplateContextGuard(
    _: DashCalendarGridSummaryCell,
    ctx: unknown,
  ): ctx is DashSummaryCellContext {
    return true;
  }
}

/** Group heading content. Without it, the group name and its size. */
@Directive({ selector: 'ng-template[dashGroupHeading]' })
export class DashCalendarGridGroupHeading {
  readonly template = inject<TemplateRef<DashGroupHeadingContext>>(TemplateRef);

  static ngTemplateContextGuard(
    _: DashCalendarGridGroupHeading,
    ctx: unknown,
  ): ctx is DashGroupHeadingContext {
    return true;
  }
}

/** Extra controls in the toolbar, before the period switch. */
@Directive({ selector: '[dashCalendarGridTools]' })
export class DashCalendarGridTools {}

/** Content under the grid, such as a legend. */
@Directive({ selector: '[dashCalendarGridFooter]' })
export class DashCalendarGridFooter {}

/**
 * The optional side panel. It scrolls on its own, so it is focusable for keyboard users;
 * give the element an `aria-label`.
 */
@Directive({
  selector: '[dashCalendarGridAside]',
  host: { class: 'dash-calendar-grid__aside', tabindex: '0' },
})
export class DashCalendarGridAside {}
