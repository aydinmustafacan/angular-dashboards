import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { IHeaderAngularComp } from 'ag-grid-angular';
import { IHeaderParams } from 'ag-grid-community';
import { formatDay } from '../calendar-grid.dates';
import { injectCalendarGrid } from '../calendar-grid.context';
import { DayColumnParams } from './rendered';

type Params = IHeaderParams & DayColumnParams;

/**
 * A date in the header. Clicking it, or pressing Enter or Space while the header cell has
 * focus (handled by the column's `suppressHeaderKeyboardEvent`), selects the day.
 */
@Component({
  selector: 'dash-calendar-grid-day-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="dash-calendar-grid__date" [class.is-today]="isToday()" aria-hidden="true">
      <span class="dash-calendar-grid__dow">{{ weekday() }}</span>
      <span class="dash-calendar-grid__num">{{ dayOfMonth() }}</span>
    </span>
    <span class="dash-sr-only">{{ fullLabel() }}</span>
  `,
  host: {
    class: 'dash-calendar-grid__day-header',
    '[class.is-week-start]': 'weekStart()',
    '[class.is-selected]': 'selected()',
    '(click)': 'select()',
  },
})
export class DashCalendarGridDayHeader implements IHeaderAngularComp {
  private readonly grid = injectCalendarGrid('dash-calendar-grid-day-header');
  private readonly params = signal<Params | null>(null);

  private readonly day = computed(() => this.params()?.day ?? '');
  protected readonly weekStart = computed(() => this.params()?.weekStart ?? false);
  protected readonly selected = computed(() => this.day() === this.grid.selectedDay());
  protected readonly isToday = computed(() => this.day() === this.grid.today());

  protected readonly weekday = computed(() =>
    this.day() ? formatDay(this.day(), this.grid.wide() ? 'EEE' : 'EEEEE') : '',
  );
  protected readonly dayOfMonth = computed(() => (this.day() ? formatDay(this.day(), 'd') : ''));
  protected readonly fullLabel = computed(() => {
    if (!this.day()) return '';
    const label = formatDay(this.day(), 'EEEE d MMMM');
    return [label, this.isToday() && 'today', this.selected() && 'selected']
      .filter(Boolean)
      .join(', ');
  });

  agInit(params: Params): void {
    this.params.set(params);
  }

  refresh(params: Params): boolean {
    this.params.set(params);
    return true;
  }

  protected select(): void {
    if (this.day()) this.grid.select(this.day());
  }
}
