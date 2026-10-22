import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import {
  DashBarChart,
  DashChartCard,
  DashComboChart,
  DashGrid,
  DashKpiTile,
  DashPieChart,
  DashSpan,
  DashStatList,
  DashTrendChart,
  formatDelta,
  formatShare,
  type DashPointEvent,
  type DashSeries,
  type DashSlice,
  type DashSliceEvent,
  type DashStat,
} from 'ngx-dash-charts';
import { logisticsData, type LogisticsData, type Region, type SiteMeta, type WeekMeta } from './logistics-data';

type Weeks = 13 | 26 | 52;

const REGIONS: { value: Region; label: string }[] = [
  { value: 'all', label: 'All regions' },
  { value: 'emea', label: 'EMEA' },
  { value: 'americas', label: 'Americas' },
  { value: 'apac', label: 'APAC' },
];

/**
 * Demo dashboard composed only from public ngx-dash-charts components: a freight network's weekly
 * operations. Filters scope every chart; each chart drills into its own detail panel.
 */
@Component({
  selector: 'dash-demo-operations-overview',
  imports: [
    MatButtonModule,
    MatButtonToggleModule,
    MatFormFieldModule,
    MatSelectModule,
    DashBarChart,
    DashChartCard,
    DashComboChart,
    DashGrid,
    DashKpiTile,
    DashPieChart,
    DashSpan,
    DashStatList,
    DashTrendChart,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="filters" role="group" aria-label="Filters">
      <mat-button-toggle-group
        hideSingleSelectionIndicator
        aria-label="Period"
        [value]="weeks()"
        (change)="setWeeks($event.value)"
      >
        <mat-button-toggle [value]="13">13 weeks</mat-button-toggle>
        <mat-button-toggle [value]="26">26 weeks</mat-button-toggle>
        <mat-button-toggle [value]="52">52 weeks</mat-button-toggle>
      </mat-button-toggle-group>
      <mat-form-field appearance="outline" subscriptSizing="dynamic" class="region">
        <mat-label>Region</mat-label>
        <mat-select [value]="region()" (selectionChange)="setRegion($event.value)">
          @for (r of regions; track r.value) {
            <mat-option [value]="r.value">{{ r.label }}</mat-option>
          }
        </mat-select>
      </mat-form-field>
    </div>

    <dash-grid>
      <dash-kpi-tile [dashSpan]="3" label="Shipments last week" [trend]="data().totalShipments" [drilldownTemplate]="weekPanel" />
      <dash-kpi-tile
        [dashSpan]="3"
        label="On-time delivery"
        [trend]="data().onTimeRate[0].data"
        [valueFormat]="{ style: 'percent', decimals: 1 }"
        [status]="onTimeStatus()"
        caption="Target 95%"
        [drilldownTemplate]="weekPanel"
      />
      <dash-kpi-tile
        [dashSpan]="3"
        label="Average transit time"
        [trend]="data().transitDays"
        [valueFormat]="{ style: 'unit', unit: 'day', decimals: 1 }"
        [upIsGood]="false"
        [drilldownTemplate]="weekPanel"
      />
      <dash-kpi-tile
        [dashSpan]="3"
        label="Damage claims"
        [trend]="data().damageClaims"
        [upIsGood]="false"
        [drilldownTemplate]="weekPanel"
      />

      <dash-chart-card [dashSpan]="8" heading="Weekly shipments" [subheading]="'Actuals and forecast, ' + scope()" [loading]="loading()">
        <dash-trend-chart
          label="Weekly shipments"
          [series]="data().shipmentsVsForecast"
          [thresholds]="[data().capacity]"
          [annotations]="[data().peakSeason]"
          [loading]="loading()"
          [height]="380"
          [drilldownTemplate]="weekPanel"
        />
      </dash-chart-card>

      <dash-chart-card [dashSpan]="4" heading="Why shipments ran late" [subheading]="'Delays by cause, ' + scope()" [loading]="loading()">
        <dash-pie-chart
          label="Delay causes"
          totalLabel="Delayed shipments"
          legendPosition="bottom"
          selectionMode="multiple"
          [data]="data().delayCauses"
          [(selected)]="selectedCauses"
          [loading]="loading()"
          [height]="220"
          [drilldownTemplate]="causePanel"
        />
      </dash-chart-card>

      <dash-chart-card [dashSpan]="12" heading="Shipments by transport mode" subheading="Stacked by mode, with the 4-week average of the total" [loading]="loading()">
        <dash-combo-chart
          label="Shipments by transport mode"
          syncGroup="ops-weeks"
          [series]="modesWithAverage()"
          [loading]="loading()"
          [zoom]="weeks() === 52 ? 'slider' : 'none'"
          [height]="320"
          [drilldownTemplate]="weekPanel"
        />
      </dash-chart-card>

      <dash-chart-card [dashSpan]="6" heading="On-time delivery" [subheading]="'Share delivered by the promised date, ' + scope()" [loading]="loading()">
        <dash-trend-chart
          label="On-time delivery"
          syncGroup="ops-weeks"
          [series]="data().onTimeRate"
          [thresholds]="[data().onTimeTarget]"
          [yMin]="0.85"
          [yMax]="1"
          [smooth]="true"
          [showEndLabels]="true"
          [loading]="loading()"
          [height]="260"
          [drilldownTemplate]="weekPanel"
        />
      </dash-chart-card>

      <dash-chart-card [dashSpan]="6" heading="Busiest sites" subheading="Pallets handled last week" [loading]="loading()">
        <dash-bar-chart
          label="Pallets handled per site"
          orientation="horizontal"
          granularity="category"
          [series]="data().throughputBySite"
          [thresholds]="[{ value: siteTarget(), label: 'Site target', status: 'good' }]"
          [loading]="loading()"
          [height]="260"
          [drilldownTemplate]="sitePanel"
        />
      </dash-chart-card>
    </dash-grid>

    <ng-template #weekPanel let-ctx let-close="close">
      <dash-stat-list [items]="pointStats(ctx)" />
      @if (modeSplit(ctx); as split) {
        @if (split.length > 1) {
          <h3 class="dash-demo-heading">Mode split</h3>
          <dash-pie-chart label="Mode split" legendPosition="bottom" selectionMode="none" [data]="split" [height]="200" />
        }
      }
      @if (weekStats(ctx); as stats) {
        @if (stats.length) {
          <h3 class="dash-demo-heading">Operations</h3>
          <dash-stat-list [items]="stats" />
        }
      }
      <div class="dash-demo-actions">
        <button matButton="tonal" type="button" (click)="close()">Done</button>
      </div>
    </ng-template>

    <ng-template #causePanel let-ctx let-close="close">
      <dash-stat-list [items]="causeStats(ctx)" />
      @if (ctx.children.length) {
        <h3 class="dash-demo-heading">Included in Other</h3>
        <dash-stat-list [columns]="1" [items]="childStats(ctx)" />
      }
      <div class="dash-demo-actions">
        <button matButton="tonal" type="button" (click)="close()">Done</button>
      </div>
    </ng-template>

    <ng-template #sitePanel let-ctx let-close="close">
      <dash-stat-list [columns]="1" [items]="siteStats(ctx)" />
      <div class="dash-demo-actions">
        <button matButton="tonal" type="button" (click)="close()">Done</button>
      </div>
    </ng-template>
  `,
  styles: `
    :host { display: block; }
    .filters { display: flex; flex-wrap: wrap; align-items: center; gap: 12px 16px; margin-bottom: 20px; }
    .region { width: 200px; }
    .dash-demo-heading { margin: 24px 0 8px; font-size: 0.9375rem; font-weight: 600; color: var(--dash-ink); }
    .dash-demo-actions { display: flex; justify-content: flex-end; margin-top: 24px; }
  `,
})
export class OperationsOverview {
  /** Simulated network latency when filters change, to show the loading state. */
  readonly latency = input(450);

  protected readonly regions = REGIONS;
  protected readonly weeks = signal<Weeks>(26);
  protected readonly region = signal<Region>('all');
  protected readonly loading = signal(false);
  protected readonly selectedCauses = signal<string[]>([]);
  protected readonly data = signal<LogisticsData>(logisticsData({ weeks: 26 }));

  protected readonly scope = computed(() => {
    const r = REGIONS.find((x) => x.value === this.region())!.label.toLowerCase();
    return `last ${this.weeks()} weeks, ${r}`;
  });

  protected readonly modesWithAverage = computed<DashSeries[]>(() => [
    ...this.data().shipmentsByMode.map((s) => ({ ...s, type: 'bar' as const, stack: 'modes' })),
    { ...this.data().shipmentsWithAverage[1], slot: 7 },
  ]);

  protected readonly onTimeStatus = computed(() => {
    const d = this.data().onTimeRate[0].data;
    const last = d[d.length - 1]?.y ?? 1;
    return last >= 0.95 ? 'good' : last >= 0.92 ? 'warning' : 'critical';
  });

  protected readonly siteTarget = computed(() => Math.round((4000 * this.data().capacity.value) / 13_500 / 100) * 100);

  private timer: ReturnType<typeof setTimeout> | undefined;

  protected setWeeks(weeks: Weeks): void {
    this.weeks.set(weeks);
    this.reload();
  }

  protected setRegion(region: Region): void {
    this.region.set(region);
    this.reload();
  }

  private reload(): void {
    clearTimeout(this.timer);
    this.loading.set(true);
    this.timer = setTimeout(() => {
      this.data.set(logisticsData({ weeks: this.weeks(), region: this.region() }));
      this.loading.set(false);
    }, this.latency());
  }

  protected pointStats(ctx: DashPointEvent): DashStat[] {
    const stats: DashStat[] = ctx.values
      .filter((v) => v.value !== null)
      .map((v) => ({
        label: v.seriesName,
        value: v.formatted,
        detail: v.delta === null ? undefined : `${v.delta >= 0 ? '▲' : '▼'} ${formatDelta(v.delta)} vs. previous week`,
        tone: v.deltaIsGood === null ? null : v.deltaIsGood ? 'good' : 'bad',
      }));
    if (ctx.totalFormatted) stats.unshift({ label: 'All modes', value: ctx.totalFormatted });
    return stats;
  }

  /** Mode split for the clicked week, looked up from the current data. */
  protected modeSplit(ctx: DashPointEvent): DashSlice[] {
    const key = ctx.x instanceof Date ? ctx.x.getTime() : null;
    if (key === null) return [];
    return this.data().shipmentsByMode.flatMap((s, i) => {
      const point = s.data.find((d) => d.x instanceof Date && d.x.getTime() === key);
      return point?.y ? [{ id: s.id, name: s.name, value: point.y, slot: s.slot ?? i + 1 }] : [];
    });
  }

  protected weekStats(ctx: DashPointEvent): DashStat[] {
    const key = ctx.x instanceof Date ? ctx.x.getTime() : null;
    const meta = this.data().totalShipments.find((d) => d.x instanceof Date && d.x.getTime() === key)?.meta as
      | WeekMeta
      | undefined;
    if (!meta) return [];
    return [
      { label: 'Active lanes', value: String(meta.lanes) },
      { label: 'Exceptions raised', value: String(meta.exceptions) },
      { label: 'Busiest lane', value: meta.busiestLane },
      { label: 'Weather', value: meta.weather === 'clear' ? 'Clear' : meta.weather === 'snow' ? 'Snow' : 'Storms' },
    ];
  }

  protected causeStats(ctx: DashSliceEvent): DashStat[] {
    return [
      { label: 'Delayed shipments', value: ctx.formatted },
      { label: 'Share of all delays', value: formatShare(ctx.share) },
    ];
  }

  protected childStats(ctx: DashSliceEvent): DashStat[] {
    return ctx.children.map((c) => ({ label: c.name, value: String(c.value) }));
  }

  protected siteStats(ctx: DashPointEvent): DashStat[] {
    const m = ctx.series?.meta as SiteMeta | undefined;
    return [
      { label: 'Pallets handled', value: ctx.series?.formatted ?? '–' },
      { label: 'Loading docks', value: String(m?.docks ?? '–') },
      { label: 'Site manager', value: m?.manager ?? '–' },
    ];
  }
}
