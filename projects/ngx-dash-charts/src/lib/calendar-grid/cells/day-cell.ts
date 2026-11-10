import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, TemplateRef, computed, signal } from '@angular/core';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams } from 'ag-grid-community';
import { injectCalendarGrid } from '../calendar-grid.context';
import { GridEntry } from '../calendar-grid.rows';
import { DashDayCellContext, DashSummaryCellContext } from '../calendar-grid.slots';
import { DayColumnParams, rendered } from './rendered';

export type DayCellParams = ICellRendererParams<GridEntry<unknown>> &
  DayColumnParams & {
    dayTemplate: () => TemplateRef<DashDayCellContext<unknown>> | undefined;
    summaryTemplate: () => TemplateRef<DashSummaryCellContext> | undefined;
  };

/** Stamps the caller's day template, or the summary template in the pinned row. */
@Component({
  selector: 'dash-calendar-grid-day-cell',
  imports: [NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (view(); as view) {
      <ng-container *ngTemplateOutlet="view.template; context: view.context" />
    }
  `,
  host: {
    class: 'dash-calendar-grid__day-cell',
    '[class.is-wide]': 'grid.wide()',
    '[class.is-week-start]': 'params()?.weekStart',
    '[class.is-selected]': 'selected()',
  },
})
export class DashCalendarGridDayCellRenderer implements ICellRendererAngularComp {
  protected readonly grid = injectCalendarGrid('dash-calendar-grid-day-cell');
  protected readonly params = signal<DayCellParams | null>(null);

  protected readonly selected = computed(() => this.params()?.day === this.grid.selectedDay());

  protected readonly view = computed(() => {
    const p = this.params();
    const entry = p?.data;
    if (!p || !entry) return null;
    const wide = this.grid.wide();
    const selected = this.selected();
    if (entry.kind === 'row') {
      return rendered(p.dayTemplate(), { $implicit: entry.row, day: p.day, wide, selected });
    }
    if (entry.kind === 'summary') {
      return rendered(p.summaryTemplate(), { $implicit: p.day, wide, selected });
    }
    return null;
  });

  agInit(params: DayCellParams): void {
    this.params.set(params);
  }

  refresh(params: DayCellParams): boolean {
    this.params.set(params);
    return true;
  }
}
