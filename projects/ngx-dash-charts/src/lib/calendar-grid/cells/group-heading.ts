import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, TemplateRef, computed, signal } from '@angular/core';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams } from 'ag-grid-community';
import { GridEntry } from '../calendar-grid.rows';
import { DashGroupHeadingContext } from '../calendar-grid.slots';
import { rendered } from './rendered';

export type GroupHeadingParams = ICellRendererParams<GridEntry<unknown>> & {
  template: () => TemplateRef<DashGroupHeadingContext> | undefined;
};

/**
 * Full-width group heading. It doesn't scroll sideways, so the name stays in view.
 * AG Grid gives a full-width row no cell of its own, so the heading is the row's cell.
 */
@Component({
  selector: 'dash-calendar-grid-group-heading',
  imports: [NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (group(); as group) {
      @if (view(); as view) {
        <ng-container *ngTemplateOutlet="view.template; context: view.context" />
      } @else {
        <span class="dash-calendar-grid__group-name">{{ group.group }}</span>
        <span>{{ group.size }}</span>
      }
    }
  `,
  host: { class: 'dash-calendar-grid__group-heading', role: 'gridcell' },
})
export class DashCalendarGridGroupHeadingRenderer implements ICellRendererAngularComp {
  private readonly params = signal<GroupHeadingParams | null>(null);

  protected readonly group = computed(() => {
    const entry = this.params()?.data;
    return entry?.kind === 'group' ? entry : null;
  });

  protected readonly view = computed(() => {
    const group = this.group();
    const template = this.params()?.template();
    return group ? rendered(template, { $implicit: group.group, size: group.size }) : null;
  });

  agInit(params: GroupHeadingParams): void {
    this.params.set(params);
  }

  refresh(params: GroupHeadingParams): boolean {
    this.params.set(params);
    return true;
  }
}
