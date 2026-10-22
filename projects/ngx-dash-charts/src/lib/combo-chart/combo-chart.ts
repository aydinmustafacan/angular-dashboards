import { ChangeDetectionStrategy, Component, ViewEncapsulation, forwardRef, input } from '@angular/core';
import { NgxEchartsDirective } from 'ngx-echarts';
import { DASH_CHART } from '../core/chart-base';
import { DashCartesianChartBase } from '../core/cartesian';
import { CARTESIAN_TEMPLATE } from '../core/chart-template';
import { DashTooltipRenderer } from '../core/tooltip';
import { DashPointEvent, DashSeriesType } from '../core/types';

/**
 * Columns and lines on one shared value axis — e.g. weekly volume by mode as stacked columns with
 * a moving average or plan line on top. Set `type` per series; untyped series render as columns.
 *
 * There is deliberately no second y-axis: for measures on different scales, use two charts.
 */
@Component({
  selector: 'dash-combo-chart',
  exportAs: 'dashChart',
  imports: [NgxEchartsDirective],
  providers: [DashTooltipRenderer, { provide: DASH_CHART, useExisting: forwardRef(() => DashComboChart) }],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  template: CARTESIAN_TEMPLATE,
  styleUrl: '../core/chart.css',
})
export class DashComboChart extends DashCartesianChartBase {
  readonly smooth = input(false);

  protected readonly source: DashPointEvent['source'] = 'combo';

  protected defaultType(): DashSeriesType {
    return 'bar';
  }

  protected override smoothLines(): boolean {
    return this.smooth();
  }
}
