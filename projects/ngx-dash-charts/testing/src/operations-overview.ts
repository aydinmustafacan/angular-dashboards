import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import {
  DashBarChart,
  DashChartCard,
  DashComboChart,
  DashKpiTile,
  DashPieChart,
  DashStatList,
  DashTrendChart,
  DashWidget,
  DashWidgetBoard,
  formatDelta,
  formatShare,
  type DashPointEvent,
  type DashSeries,
  type DashSlice,
  type DashSliceEvent,
  type DashStat,
  type DashWidgetLayout,
} from 'ngx-dash-charts';
import { logisticsData, type LogisticsData, type Region, type SiteMeta, type WeekMeta } from './logistics-data';

type Weeks = 13 | 26 | 52;

/** 4 units wide: KPI tiles 1×1, charts 2 wide, the mode chart spans the board. */
const DEFAULT_LAYOUT: DashWidgetLayout[] = [
  { id: 'shipments', kind: 'kpi', x: 0, y: 0, cols: 1, rows: 1 },
  { id: 'ontime-kpi', kind: 'kpi', x: 1, y: 0, cols: 1, rows: 1 },
  { id: 'transit', kind: 'kpi', x: 2, y: 0, cols: 1, rows: 1 },
  { id: 'claims', kind: 'kpi', x: 3, y: 0, cols: 1, rows: 1 },
  { id: 'shipments-trend', kind: 'chart', x: 0, y: 1, cols: 2, rows: 3 },
  { id: 'delays', kind: 'chart', x: 2, y: 1, cols: 2, rows: 3 },
  { id: 'modes', kind: 'wide', x: 0, y: 4, cols: 4, rows: 2 },
  { id: 'ontime', kind: 'chart', x: 0, y: 6, cols: 2, rows: 2 },
  { id: 'sites', kind: 'chart', x: 2, y: 6, cols: 2, rows: 2 },
];

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
    DashKpiTile,
    DashPieChart,
    DashStatList,
    DashTrendChart,
    DashWidget,
    DashWidgetBoard,
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
      <span class="spacer"></span>
      @if (editing()) {
        <button matButton type="button" (click)="resetLayout()">Reset layout</button>
      }
      <button matButton="tonal" type="button" [attr.aria-pressed]="editing()" (click)="editing.set(!editing())">
        {{ editing() ? 'Done editing' : 'Edit layout' }}
      </button>
    </div>
    @if (editing()) {
      <p class="edit-hint">Drag a widget to move it, or drag a chart's bottom handle to change its height. Widgets of the same size swap places. A widget can't drop into a row without room for it. With the keyboard, focus a widget and use the arrow keys.</p>
    }

    <dash-widget-board [(layout)]="layout" [editing]="editing()" [persistKey]="persistKey()">
      <ng-template dashWidget="shipments" dashWidgetLabel="Shipments last week">
        <dash-kpi-tile label="Shipments last week" height="fill" [trend]="data().totalShipments" [drilldownTemplate]="weekPanel" />
      </ng-template>
      <ng-template dashWidget="ontime-kpi" dashWidgetLabel="On-time delivery">
        <dash-kpi-tile
          label="On-time delivery"
          height="fill"
          [trend]="data().onTimeRate[0].data"
          [valueFormat]="{ style: 'percent', decimals: 1 }"
          [status]="onTimeStatus()"
          caption="Target 95%"
          [drilldownTemplate]="weekPanel"
        />
      </ng-template>
      <ng-template dashWidget="transit" dashWidgetLabel="Average transit time">
        <dash-kpi-tile
          label="Average transit time"
          height="fill"
          [trend]="data().transitDays"
          [valueFormat]="{ style: 'unit', unit: 'day', decimals: 1 }"
          [upIsGood]="false"
          [drilldownTemplate]="weekPanel"
        />
      </ng-template>
      <ng-template dashWidget="claims" dashWidgetLabel="Damage claims">
        <dash-kpi-tile label="Damage claims" height="fill" [trend]="data().damageClaims" [upIsGood]="false" [drilldownTemplate]="weekPanel" />
      </ng-template>

      <ng-template dashWidget="shipments-trend" dashWidgetLabel="Weekly shipments">
        <dash-chart-card heading="Weekly shipments" [subheading]="'Actuals and forecast, ' + scope()" [loading]="loading()">
          <dash-trend-chart
            label="Weekly shipments"
            height="fill"
            [series]="data().shipmentsVsForecast"
            [thresholds]="[data().capacity]"
            [annotations]="[data().peakSeason]"
            [loading]="loading()"
            [drilldownTemplate]="weekPanel"
          />
        </dash-chart-card>
      </ng-template>

      <ng-template dashWidget="delays" dashWidgetLabel="Why shipments ran late">
        <dash-chart-card heading="Why shipments ran late" [subheading]="'Delays by cause, ' + scope()" [loading]="loading()">
          <dash-pie-chart
            label="Delay causes"
            totalLabel="Delayed shipments"
            legendPosition="bottom"
            selectionMode="multiple"
            height="fill"
            [data]="data().delayCauses"
            [(selected)]="selectedCauses"
            [loading]="loading()"
            [drilldownTemplate]="causePanel"
          />
        </dash-chart-card>
      </ng-template>

      <ng-template dashWidget="modes" dashWidgetLabel="Shipments by transport mode">
        <dash-chart-card heading="Shipments by transport mode" subheading="Stacked by mode, with the 4-week average of the total" [loading]="loading()">
          <dash-combo-chart
            label="Shipments by transport mode"
            syncGroup="ops-weeks"
            height="fill"
            [series]="modesWithAverage()"
            [loading]="loading()"
            [zoom]="weeks() === 52 ? 'slider' : 'none'"
            [drilldownTemplate]="weekPanel"
          />
        </dash-chart-card>
      </ng-template>

      <ng-template dashWidget="ontime" dashWidgetLabel="On-time delivery trend">
        <dash-chart-card heading="On-time delivery" [subheading]="'Share delivered by the promised date, ' + scope()" [loading]="loading()">
          <dash-trend-chart
            label="On-time delivery"
            syncGroup="ops-weeks"
            height="fill"
            [series]="data().onTimeRate"
            [thresholds]="[data().onTimeTarget]"
            [yMin]="0.85"
            [yMax]="1"
            [smooth]="true"
            [showEndLabels]="true"
            [loading]="loading()"
            [drilldownTemplate]="weekPanel"
          />
        </dash-chart-card>
      </ng-template>

      <ng-template dashWidget="sites" dashWidgetLabel="Busiest sites">
        <dash-chart-card heading="Busiest sites" subheading="Pallets handled last week" [loading]="loading()">
          <dash-bar-chart
            label="Pallets handled per site"
            orientation="horizontal"
            granularity="category"
            height="fill"
            [series]="data().throughputBySite"
            [thresholds]="[{ value: siteTarget(), label: 'Site target', status: 'good' }]"
            [loading]="loading()"
            [drilldownTemplate]="sitePanel"
          />
        </dash-chart-card>
      </ng-template>
    </dash-widget-board>

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
    .spacer { flex: 1; }
    .edit-hint { margin: -8px 0 16px; color: var(--dash-ink-2); font-size: 0.875rem; max-width: 72ch; }
    .dash-demo-heading { margin: 24px 0 8px; font-size: 0.9375rem; font-weight: 600; color: var(--dash-ink); }
    .dash-demo-actions { display: flex; justify-content: flex-end; margin-top: 24px; }
  `,
})
export class OperationsOverview {
  /** Simulated network latency when filters change, to show the loading state. */
  readonly latency = input(450);
  /** localStorage key for the user's layout; `null` disables saving (e.g. in stories). */
  readonly persistKey = input<string | null>('dash-demo-operations-layout');

  protected readonly editing = signal(false);
  protected readonly layout = signal<DashWidgetLayout[]>(DEFAULT_LAYOUT);

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

  protected resetLayout(): void {
    this.layout.set(DEFAULT_LAYOUT);
  }

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
