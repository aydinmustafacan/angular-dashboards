import { ChangeDetectionStrategy, Component, ViewEncapsulation, forwardRef, input } from '@angular/core';
import { NgxEchartsDirective } from 'ngx-echarts';
import { DASH_CHART } from '../core/chart-base';
import { DashCartesianChartBase } from '../core/cartesian';
import { CARTESIAN_TEMPLATE } from '../core/chart-template';
import { DashTooltipRenderer } from '../core/tooltip';
import { DashPointEvent, DashSeriesType } from '../core/types';

/**
 * Lines and areas over time (weekly by default). Crosshair tooltip listing every series with
 * change vs. the previous period; click anywhere in a column to drill into that period.
 */
@Component({
  selector: 'dash-trend-chart',
  exportAs: 'dashChart',
  imports: [NgxEchartsDirective],
  providers: [DashTooltipRenderer, { provide: DASH_CHART, useExisting: forwardRef(() => DashTrendChart) }],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  template: CARTESIAN_TEMPLATE,
  styleUrl: '../core/chart.css',
})
export class DashTrendChart extends DashCartesianChartBase {
  /** Fill under every line (individual series can still opt in with `type: 'area'`). */
  readonly area = input(false);
  readonly smooth = input(false);
  /** Print the latest value at the end of each line (up to four lines). */
  readonly showEndLabels = input(false);

  protected readonly source: DashPointEvent['source'] = 'trend';

  protected defaultType(): DashSeriesType {
    return this.area() ? 'area' : 'line';
  }

  protected override smoothLines(): boolean {
    return this.smooth();
  }

  protected override endLabels(): boolean {
    return this.showEndLabels();
  }
}
