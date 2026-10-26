import { Directive, InjectionToken, Signal, Type, computed, forwardRef, inject, input } from '@angular/core';
import type { ECharts } from 'echarts/core';
import { DASH_CHART, DashChartBase } from '../core/chart-base';
import { axisLabel, describeX, formatDelta, formatValue, resolveGranularity } from '../core/format';
import { DashTokens } from '../core/theme';
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
 * What a KPI shares with the parts projected into it (summary, visuals, custom parts).
 * Everything is derived once here, so the number, the delta and the visual never disagree.
 */
export interface DashKpiContext {
  readonly label: Signal<string>;
  readonly trend: Signal<DashDatum[]>;
  readonly value: Signal<number | null>;
  readonly formattedValue: Signal<string>;
  /** Relative change as a fraction, or null when unknown. */
  readonly delta: Signal<number | null>;
  readonly formattedDelta: Signal<string>;
  /** True when the change is good news, false when bad, null when flat or unknown. */
  readonly deltaGood: Signal<boolean | null>;
  readonly deltaLabel: Signal<string>;
  readonly status: Signal<DashStatus | null>;
  readonly statusText: Signal<string>;
  /** X-axis labels for the trend, one per point. */
  readonly periods: Signal<string[]>;
  readonly tokens: Signal<DashTokens>;
  readonly animate: Signal<boolean>;
  readonly renderer: Signal<'canvas' | 'svg'>;
  /** Tooltip for the period at `index`; also emits `pointHover`. For an ECharts `formatter`. */
  tooltipFor(index: number): HTMLElement;
  /** Records the period a click landed on, so the tile's click drills into it instead of the latest. */
  pickPeriod(index: number): void;
  /** Hands the visual's chart to the KPI for PNG export; null when the visual goes away. */
  attachChart(chart: ECharts | null): void;
}

export const DASH_KPI = new InjectionToken<DashKpiContext>('DASH_KPI');

/** For parts: the surrounding KPI's context, with a clear error when used outside one. */
export function injectKpi(part: string): DashKpiContext {
  const kpi = inject(DASH_KPI, { optional: true });
  if (!kpi) throw new Error(`<${part}> must be placed inside <dash-kpi> or <dash-kpi-tile>.`);
  return kpi;
}

/** Providers every KPI host needs: its context for parts, and itself as a chart for `dash-chart-card`. */
export function provideKpi(type: () => Type<DashKpiBase>) {
  return [
    DashTooltipRenderer,
    { provide: DASH_CHART, useExisting: forwardRef(type) },
    { provide: DASH_KPI, useFactory: () => inject(type()).context },
  ];
}

/**
 * Data, derivations and behaviour shared by `dash-kpi` (compose your own parts) and
 * `dash-kpi-tile` (the ready-made preset). Click the tile, or a period in its visual, to drill in.
 */
@Directive({
  host: {
    '[class.is-interactive]': 'interactive()',
    '[attr.role]': 'interactive() ? "button" : null',
    '[attr.tabindex]': 'interactive() ? 0 : null',
    '(click)': 'onTileClick()',
    '(keydown.enter)': 'onTileClick()',
    '(keydown.space)': '$event.preventDefault(); onTileClick()',
  },
})
export abstract class DashKpiBase extends DashChartBase<DashPointEvent> {
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
  /** Make the tile clickable even without a drill-down template. */
  readonly clickable = input(false);
  /** Height of the visual (sparkline or bars). */
  override readonly height = input<number | string>(44);

  protected readonly interactive = computed(() => this.clickable() || !!this.drilldownTemplate());
  private pickedPeriod: number | null = null;

  private readonly current = computed(() => {
    const v = this.value();
    if (v !== undefined) return v;
    const t = this.trend();
    return t.length ? t[t.length - 1].y : null;
  });

  private readonly deltaValue = computed(() => {
    const d = this.delta();
    if (d !== undefined) return d;
    const t = this.trend();
    if (t.length < 2) return null;
    const [prev, last] = [t[t.length - 2].y, t[t.length - 1].y];
    return prev && last !== null ? (last - prev) / Math.abs(prev) : null;
  });

  private readonly deltaGood = computed(() => {
    const d = this.deltaValue();
    return d === null || d === 0 ? null : d > 0 === this.upIsGood();
  });

  private readonly formattedValue = computed(() =>
    formatValue(this.current(), this.valueFormat(), this.resolvedLocale()),
  );
  private readonly formattedDelta = computed(() => {
    const d = this.deltaValue();
    return d === null ? '' : formatDelta(d, this.resolvedLocale());
  });
  private readonly statusText = computed(() => this.statusLabel() || STATUS_TEXT[this.status() ?? 'good']);
  private readonly gran = computed(() => resolveGranularity(this.granularity(), this.trend()[0]?.x));

  readonly isEmpty = computed(() => this.current() === null);

  readonly context: DashKpiContext = {
    label: this.label,
    trend: this.trend,
    value: this.current,
    formattedValue: this.formattedValue,
    delta: this.deltaValue,
    formattedDelta: this.formattedDelta,
    deltaGood: this.deltaGood,
    deltaLabel: this.deltaLabel,
    status: this.status,
    statusText: this.statusText,
    periods: computed(() => this.trend().map((d) => axisLabel(d.x, this.gran(), this.resolvedLocale()))),
    tokens: this.tokens,
    animate: this.animationOn,
    renderer: this.renderer,
    tooltipFor: (index) => {
      const ctx = this.pointAt(index);
      this.pointHover.emit(ctx);
      return this.renderTooltip(ctx, () => this.tooltips.renderPoint(ctx, this.hint(), this.resolvedLocale()));
    },
    pickPeriod: (index) => (this.pickedPeriod = index),
    attachChart: (chart) => this.chart.set(chart),
  };

  protected override ariaLabel(): string | null {
    const parts = [this.label(), this.formattedValue()];
    if (this.formattedDelta()) parts.push(`${this.formattedDelta()} ${this.deltaLabel()}`);
    if (this.status()) parts.push(this.statusText());
    return parts.filter(Boolean).join(', ');
  }

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

  protected onTileClick(): void {
    const index = this.pickedPeriod ?? this.trend().length - 1;
    this.pickedPeriod = null;
    if (!this.interactive() || index < 0) return;
    const ctx = this.pointAt(index);
    this.activate(ctx, `${this.label()}: ${ctx.xLabel}`, ctx.xDetail);
  }
}
