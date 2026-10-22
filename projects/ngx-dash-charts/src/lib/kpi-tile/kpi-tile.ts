import {
  ChangeDetectionStrategy,
  Component,
  ViewEncapsulation,
  computed,
  forwardRef,
  input,
} from '@angular/core';
import type { ECharts, EChartsCoreOption } from 'echarts/core';
import { NgxEchartsDirective } from 'ngx-echarts';
import { DASH_CHART, DashChartBase } from '../core/chart-base';
import { axisLabel, describeX, formatDelta, formatValue, resolveGranularity } from '../core/format';
import { withAlpha } from '../core/theme';
import { DashTooltipRenderer } from '../core/tooltip';
import {
  DashDatum,
  DashGranularity,
  DashPointEvent,
  DashStatus,
  DashTableData,
  DashValueFormat,
} from '../core/types';

const STATUS_TEXT: Record<DashStatus, string> = {
  good: 'On track',
  warning: 'Watch',
  serious: 'At risk',
  critical: 'Off track',
};

/**
 * A headline number with its change and a sparkline. Hover the sparkline to read any period;
 * click a period (or the tile, for the latest one) to drill in.
 */
@Component({
  selector: 'dash-kpi-tile',
  exportAs: 'dashChart',
  imports: [NgxEchartsDirective],
  providers: [DashTooltipRenderer, { provide: DASH_CHART, useExisting: forwardRef(() => DashKpiTile) }],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    '[class.is-interactive]': 'interactive()',
    '[attr.role]': 'interactive() ? "button" : null',
    '[attr.tabindex]': 'interactive() ? 0 : null',
    '(click)': 'onTileClick()',
    '(keydown.enter)': 'onTileClick()',
    '(keydown.space)': '$event.preventDefault(); onTileClick()',
  },
  template: `
    <div class="dash-kpi__head">
      <h3 class="dash-kpi__label">{{ label() }}</h3>
      @if (status(); as s) {
        <span class="dash-kpi__status" [class]="'dash-kpi__status is-' + s">
          <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true">
            @switch (s) {
              @case ('good') { <path d="M2.5 6.2l2.3 2.3 4.7-5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" /> }
              @case ('warning') { <path d="M6 1.5l4.8 8.5H1.2z" fill="currentColor" /> }
              @case ('serious') { <path d="M6 1l5 5-5 5-5-5z" fill="currentColor" /> }
              @default { <circle cx="6" cy="6" r="4.5" fill="currentColor" /> }
            }
          </svg>
          {{ statusText() }}
        </span>
      }
    </div>
    <p class="dash-kpi__value">{{ formattedValue() }}</p>
    @if (deltaValue() !== null) {
      <p class="dash-kpi__delta" [class.is-good]="deltaGood() === true" [class.is-bad]="deltaGood() === false">
        <span aria-hidden="true">{{ deltaGlyph() }}</span>
        {{ formattedDelta() }}
        <span class="dash-kpi__delta-label">{{ deltaLabel() }}</span>
      </p>
    }
    @if (trend().length > 1) {
      <div
        echarts
        class="dash-kpi__spark"
        [options]="option()"
        [initOpts]="initOpts()"
        (chartInit)="onChartInit($event)"
      ></div>
    }
    @if (caption()) {
      <p class="dash-kpi__caption">{{ caption() }}</p>
    }
  `,
  styleUrls: ['../core/chart.css', './kpi-tile.css'],
})
export class DashKpiTile extends DashChartBase<DashPointEvent> {
  /** Defaults to the last trend value. */
  readonly value = input<number | null | undefined>(undefined);
  readonly valueFormat = input<DashValueFormat | undefined>(undefined);
  /** Relative change as a fraction. Defaults to the change between the last two trend points. */
  readonly delta = input<number | null | undefined>(undefined);
  readonly deltaLabel = input('vs. previous week');
  readonly upIsGood = input(true);
  readonly trend = input<DashDatum[]>([]);
  readonly granularity = input<DashGranularity>('auto');
  readonly status = input<DashStatus | null>(null);
  /** Overrides the default status wording (On track / Watch / At risk / Off track). */
  readonly statusLabel = input('');
  readonly caption = input('');
  /** Make the tile clickable even without a drill-down template. */
  readonly clickable = input(false);
  override readonly height = input<number | string>(44);

  protected readonly interactive = computed(() => this.clickable() || !!this.drilldownTemplate());
  private sparkIndex: number | null = null;

  private readonly current = computed(() => {
    const v = this.value();
    if (v !== undefined) return v;
    const t = this.trend();
    return t.length ? t[t.length - 1].y : null;
  });

  protected readonly deltaValue = computed(() => {
    const d = this.delta();
    if (d !== undefined) return d;
    const t = this.trend();
    if (t.length < 2) return null;
    const [prev, last] = [t[t.length - 2].y, t[t.length - 1].y];
    return prev && last !== null ? (last - prev) / Math.abs(prev) : null;
  });

  protected readonly deltaGood = computed(() => {
    const d = this.deltaValue();
    return d === null || d === 0 ? null : d > 0 === this.upIsGood();
  });

  protected readonly formattedValue = computed(() =>
    formatValue(this.current(), this.valueFormat(), this.resolvedLocale()),
  );
  protected readonly formattedDelta = computed(() => {
    const d = this.deltaValue();
    return d === null ? '' : formatDelta(d, this.resolvedLocale());
  });
  protected readonly deltaGlyph = computed(() => {
    const d = this.deltaValue() ?? 0;
    return d > 0 ? '▲' : d < 0 ? '▼' : '■';
  });
  protected readonly statusText = computed(() => this.statusLabel() || STATUS_TEXT[this.status() ?? 'good']);

  readonly isEmpty = computed(() => this.current() === null);

  protected override ariaLabel(): string | null {
    const parts = [this.label(), this.formattedValue()];
    if (this.formattedDelta()) parts.push(`${this.formattedDelta()} ${this.deltaLabel()}`);
    if (this.status()) parts.push(this.statusText());
    return parts.filter(Boolean).join(', ');
  }

  private readonly gran = computed(() => resolveGranularity(this.granularity(), this.trend()[0]?.x));

  readonly tableData = computed<DashTableData>(() => ({
    columns: [
      { key: 'x', label: 'Period' },
      { key: 'y', label: this.label() || 'Value', numeric: true },
    ],
    rows: this.trend().map((d) => {
      const x = describeX(d.x, this.gran(), this.resolvedLocale());
      return { x: x.detail ? `${x.label}, ${x.detail}` : x.label, y: formatValue(d.y, this.valueFormat(), this.resolvedLocale()) };
    }),
  }));

  pointAt(index: number): DashPointEvent {
    const t = this.trend();
    const d = t[index];
    const prev = index > 0 ? t[index - 1].y : null;
    const delta = d.y !== null && prev ? (d.y - prev) / Math.abs(prev) : null;
    const x = describeX(d.x, this.gran(), this.resolvedLocale());
    const value = {
      seriesId: 'value',
      seriesName: this.label(),
      value: d.y,
      formatted: formatValue(d.y, this.valueFormat(), this.resolvedLocale()),
      color: this.tokens().accent,
      dashed: false,
      previous: prev,
      delta,
      deltaIsGood: delta === null || delta === 0 ? null : delta > 0 === this.upIsGood(),
      share: null,
      meta: d.meta,
    };
    return {
      source: 'kpi',
      index,
      x: d.x,
      xLabel: x.label,
      xDetail: x.detail,
      series: value,
      values: [value],
      total: null,
      totalFormatted: null,
      thresholds: [],
    };
  }

  protected readonly option = computed<EChartsCoreOption>(() => {
    const t = this.tokens();
    const data = this.trend();
    const last = data.length - 1;
    const locale = this.resolvedLocale();
    return {
      backgroundColor: 'transparent',
      animation: this.animationOn(),
      grid: { left: 4, right: 6, top: 6, bottom: 4 },
      aria: { enabled: true, label: { description: `${this.label()} trend` } },
      xAxis: {
        type: 'category',
        show: false,
        boundaryGap: false,
        data: data.map((d) => axisLabel(d.x, this.gran(), locale)),
      },
      yAxis: { type: 'value', show: false, scale: true },
      tooltip: {
        trigger: 'axis',
        confine: true,
        padding: 0,
        borderWidth: 0,
        backgroundColor: 'transparent',
        extraCssText: 'box-shadow:none;',
        className: 'dash-tip-host',
        transitionDuration: 0.12,
        axisPointer: { type: 'line', lineStyle: { color: t.baseline, width: 1 } },
        formatter: (params: { dataIndex: number }[]) => {
          const ctx = this.pointAt(params[0].dataIndex);
          this.pointHover.emit(ctx);
          return this.renderTooltip(ctx, () => this.tooltips.renderPoint(ctx, this.hint(), locale));
        },
      },
      series: [
        {
          type: 'line',
          data: data.map((d, i) =>
            i === last
              ? { value: d.y, symbol: 'circle', symbolSize: 8, itemStyle: { color: t.accent, borderColor: t.surface, borderWidth: 2 } }
              : d.y,
          ),
          showSymbol: true,
          symbol: 'none',
          lineStyle: { width: 2, color: t.muted, cap: 'round', join: 'round' },
          areaStyle: { color: withAlpha(t.muted, 0.08) },
          emphasis: { disabled: true },
        },
      ],
    };
  });

  protected override onChartInit(chart: ECharts): void {
    super.onChartInit(chart);
    chart.getZr().on('click', (e: { offsetX: number; offsetY: number }) => {
      const n = this.trend().length;
      const point: [number, number] = [e.offsetX, e.offsetY];
      if (!n || !chart.containPixel({ gridIndex: 0 }, point)) return;
      const [raw] = chart.convertFromPixel({ gridIndex: 0 }, point) as number[];
      this.sparkIndex = Math.min(n - 1, Math.max(0, Math.round(raw)));
    });
  }

  protected onTileClick(): void {
    const index = this.sparkIndex ?? this.trend().length - 1;
    this.sparkIndex = null;
    if (!this.interactive() || index < 0) return;
    const ctx = this.pointAt(index);
    this.activate(ctx, `${this.label()}: ${ctx.xLabel}`, ctx.xDetail);
  }
}
