import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';
import { DashKpiBase, provideKpi } from './kpi-base';
import { DashKpiSummary } from './kpi-parts';

/**
 * A KPI you assemble yourself: the summary (label, status, value, delta) is built in, and you
 * project the visual and caption — or leave them out.
 *
 * ```html
 * <dash-kpi label="Shipments last week" [trend]="weeks">
 *   <dash-kpi-spark-bars />
 *   <dash-kpi-caption>Peak season starts <a href="/calendar">Nov 20</a></dash-kpi-caption>
 * </dash-kpi>
 * ```
 *
 * Any element marked `dashKpiVisual` takes the visual's place; it can read the KPI's data with
 * `injectKpi()`. For the common case, `dash-kpi-tile` does this for you.
 */
@Component({
  selector: 'dash-kpi',
  exportAs: 'dashChart',
  imports: [DashKpiSummary],
  providers: provideKpi(() => DashKpi),
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  template: `
    <dash-kpi-summary />
    <ng-content select="[dashKpiVisual], dash-kpi-sparkline, dash-kpi-spark-bars" />
    <ng-content />
  `,
  styleUrls: ['../core/chart.css', './kpi-tile.css'],
})
export class DashKpi extends DashKpiBase {}
