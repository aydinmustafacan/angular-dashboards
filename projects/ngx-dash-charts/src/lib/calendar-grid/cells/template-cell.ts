import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams } from 'ag-grid-community';
import { GridEntry } from '../calendar-grid.rows';
import { Rendered } from './rendered';

export type TemplateCellParams = ICellRendererParams<GridEntry<unknown>> & {
  render: (entry: GridEntry<unknown>, value: unknown) => Rendered | null;
};

/** Stamps a caller's template in the label or total column, or falls back to the plain value. */
@Component({
  selector: 'dash-calendar-grid-template-cell',
  imports: [NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (view(); as view) {
      <ng-container *ngTemplateOutlet="view.template; context: view.context" />
    } @else {
      {{ params()?.valueFormatted ?? params()?.value }}
    }
  `,
  host: { class: 'dash-calendar-grid__template-cell' },
})
export class DashCalendarGridTemplateCell implements ICellRendererAngularComp {
  protected readonly params = signal<TemplateCellParams | null>(null);

  protected readonly view = computed(() => {
    const p = this.params();
    return p?.data ? p.render(p.data, p.value) : null;
  });

  agInit(params: TemplateCellParams): void {
    this.params.set(params);
  }

  refresh(params: TemplateCellParams): boolean {
    this.params.set(params);
    return true;
  }
}
