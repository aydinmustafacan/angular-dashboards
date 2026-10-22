import { ChangeDetectionStrategy, Component, ViewEncapsulation, forwardRef, input } from '@angular/core';
import { NgxEchartsDirective } from 'ngx-echarts';
import { DASH_CHART } from '../core/chart-base';
import { DashCartesianChartBase } from '../core/cartesian';
import { CARTESIAN_TEMPLATE } from '../core/chart-template';
import { DashTooltipRenderer } from '../core/tooltip';
import { DashPointEvent, DashSeriesType } from '../core/types';

/**
 * Grouped or stacked bars, vertical or horizontal. Each bar is its own hit target: hovering lifts
 * it and shows its value, share of the stack and change; clicking opens its drill-down.
 */
@Component({
  selector: 'dash-bar-chart',
  exportAs: 'dashChart',
  imports: [NgxEchartsDirective],
  providers: [DashTooltipRenderer, { provide: DASH_CHART, useExisting: forwardRef(() => DashBarChart) }],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  template: CARTESIAN_TEMPLATE,
  styleUrl: '../core/chart.css',
})
export class DashBarChart extends DashCartesianChartBase {
  /** Bars grow from the left — best for long category names and rankings. */
  readonly orientation = input<'vertical' | 'horizontal'>('vertical');
  /** `auto` labels bar ends when there is a single series and few bars. */
  readonly showValues = input<'auto' | 'show' | 'hide'>('auto');
  /** `item`: tooltip per bar. `axis`: one tooltip for the whole group. */
  readonly tooltipMode = input<'item' | 'axis'>('item');

  protected readonly source: DashPointEvent['source'] = 'bar';

  protected defaultType(): DashSeriesType {
    return 'bar';
  }

  protected override horizontal(): boolean {
    return this.orientation() === 'horizontal';
  }

  protected override valueLabels(): 'auto' | 'show' | 'hide' {
    return this.showValues();
  }

  protected override tooltipTrigger(): 'axis' | 'item' {
    return this.tooltipMode();
  }
}
