import { ChangeDetectionStrategy, Component, ViewEncapsulation, input } from '@angular/core';
import { DashKpiBase, provideKpi } from './kpi-base';
import { DashKpiCaption, DashKpiSparkBars, DashKpiSparkline, DashKpiSummary } from './kpi-parts';

export type DashKpiVisualKind = 'line' | 'bars' | 'none';

/**
 * A headline number with its change and a small visual. Hover the visual to read any period;
 * click a period (or the tile, for the latest one) to drill in.
 *
 * Need a different visual or a caption with markup? Compose a `dash-kpi` instead:
 *
 * ```html
 * <dash-kpi label="On-time delivery" [trend]="weeks">
 *   <my-target-gauge dashKpiVisual [target]="0.95" />
 *   <dash-kpi-caption>Target <strong>95%</strong></dash-kpi-caption>
 * </dash-kpi>
 * ```
 */
@Component({
  selector: 'dash-kpi-tile',
  exportAs: 'dashChart',
  imports: [DashKpiSummary, DashKpiSparkline, DashKpiSparkBars, DashKpiCaption],
  providers: provideKpi(() => DashKpiTile),
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  template: `
    <dash-kpi-summary />
    @switch (visual()) {
      @case ('line') { <dash-kpi-sparkline /> }
      @case ('bars') { <dash-kpi-spark-bars /> }
    }
    @if (caption()) {
      <dash-kpi-caption>{{ caption() }}</dash-kpi-caption>
    }
  `,
  styleUrls: ['../core/chart.css', './kpi-tile.css'],
})
export class DashKpiTile extends DashKpiBase {
  /** `line` (default) is a sparkline, `bars` a bar per period, `none` leaves just the numbers. */
  readonly visual = input<DashKpiVisualKind>('line');
  readonly caption = input('');
}
