import { Directive, Signal, computed, input, signal } from '@angular/core';
import { connect } from 'echarts/core';
import type { ECElementEvent, ECharts, EChartsCoreOption } from 'echarts/core';
import { DashChartBase } from './chart-base';
import { axisLabel, describeX, formatValue, resolveGranularity, xKey } from './format';
import { seriesColor, withAlpha } from './theme';
import {
  DashAnnotation,
  DashDatum,
  DashGranularity,
  DashPointEvent,
  DashPointValue,
  DashSeries,
  DashSeriesType,
  DashTableData,
  DashThreshold,
  DashValueFormat,
  DashX,
} from './types';

interface ModelCategory {
  x: DashX;
  label: string;
  title: string;
  detail: string;
}

interface ModelSeries {
  def: DashSeries;
  index: number;
  type: DashSeriesType;
  color: string;
  stackKey: string | null;
  values: (number | null)[];
  data: (DashDatum | null)[];
  format: DashValueFormat | undefined;
}

interface Model {
  categories: ModelCategory[];
  series: ModelSeries[];
}

/** Rounds up to a "nice" axis maximum (1, 2, 2.5, 5 × 10ⁿ). */
function niceCeil(v: number): number {
  if (v <= 0) return 0;
  const exp = Math.pow(10, Math.floor(Math.log10(v)));
  for (const step of [1, 2, 2.5, 5, 10]) if (step * exp >= v) return step * exp;
  return 10 * exp;
}

/** Smallest "nice" step (1, 2, 2.5, 5 × 10ⁿ) at least `raw`. */
function niceStep(raw: number): number {
  const exp = Math.pow(10, Math.floor(Math.log10(raw)));
  for (const step of [1, 2, 2.5, 5, 10]) if (step * exp >= raw - 1e-12) return step * exp;
  return 10 * exp;
}

/**
 * Shared engine for x/y charts (trend, bar, combo). Single value axis by design — two measures
 * on different scales belong in two charts, not on a second y-axis.
 */
@Directive({
  host: {
    tabindex: '0',
    role: 'group',
    'aria-roledescription': 'chart',
    '(keydown)': 'onKeydown($event)',
    '(blur)': 'hideTip()',
  },
})
export abstract class DashCartesianChartBase extends DashChartBase<DashPointEvent> {
  readonly series = input<DashSeries[]>([]);
  readonly granularity = input<DashGranularity>('auto');
  /** Default value format; a series' own `format` wins. */
  readonly valueFormat = input<DashValueFormat | undefined>(undefined);
  /** Stack every series without its own `stack` id. */
  readonly stacked = input(false);
  readonly thresholds = input<DashThreshold[]>([]);
  readonly annotations = input<DashAnnotation[]>([]);
  readonly yMin = input<number | undefined>(undefined);
  readonly yMax = input<number | undefined>(undefined);
  /** Short unit caption above the value axis, e.g. "Shipments". */
  readonly yLabel = input('');
  /** `inside`: drag to pan, Ctrl/⌘ + wheel to zoom. `slider`: adds a range handle under the chart. */
  readonly zoom = input<'none' | 'inside' | 'slider'>('none');
  readonly legend = input<'auto' | 'show' | 'hide'>('auto');
  /** Show change vs. previous point in tooltips. */
  readonly showDelta = input(true);
  /** Charts sharing a group id move their crosshairs and tooltips together. */
  readonly syncGroup = input<string | null>(null);
  /** Index of the point to mark as selected. Updated on click; settable by the host. */
  readonly selectedIndex = input<number | null>(null);

  protected abstract readonly source: DashPointEvent['source'];
  protected abstract defaultType(): DashSeriesType;
  protected horizontal(): boolean {
    return false;
  }
  protected valueLabels(): 'auto' | 'show' | 'hide' {
    return 'hide';
  }
  protected smoothLines(): boolean {
    return false;
  }
  protected endLabels(): boolean {
    return false;
  }

  private readonly clickedIndex = signal<number | null>(null);
  protected readonly markedIndex = computed(() => this.clickedIndex() ?? this.selectedIndex());
  private readonly hiddenSeries = signal<Record<string, boolean>>({});
  private readonly activeIndex = signal<number | null>(null);
  private hoveredSeriesId: string | null = null;
  private lastHoverIndex: number | null = null;

  protected readonly model: Signal<Model> = computed(() => {
    const defs = this.series();
    const tokens = this.tokens();
    const keys = new Map<string, DashX>();
    for (const s of defs) for (const d of s.data) if (!keys.has(xKey(d.x))) keys.set(xKey(d.x), d.x);
    let xs = [...keys.values()];
    const granularity = resolveGranularity(this.granularity(), xs[0]);
    if (granularity !== 'category') {
      xs = xs.sort((a, b) => new Date(a as string).getTime() - new Date(b as string).getTime());
    }
    const locale = this.resolvedLocale();
    const categories = xs.map((x) => {
      const d = describeX(x, granularity, locale);
      return { x, label: axisLabel(x, granularity, locale), title: d.label, detail: d.detail };
    });
    const position = new Map(xs.map((x, i) => [xKey(x), i]));
    const series = defs.map((def, index): ModelSeries => {
      const values: (number | null)[] = new Array(xs.length).fill(null);
      const data: (DashDatum | null)[] = new Array(xs.length).fill(null);
      for (const d of def.data) {
        const i = position.get(xKey(d.x))!;
        values[i] = d.y;
        data[i] = d;
      }
      return {
        def,
        index,
        type: def.type ?? this.defaultType(),
        color: def.color ?? seriesColor(tokens, def.slot ?? index + 1),
        stackKey: def.stack ?? (this.stacked() ? '__all' : null),
        values,
        data,
        format: def.format ?? this.valueFormat(),
      };
    });
    return { categories, series };
  });

  private readonly visibleSeries = computed(() => {
    const hidden = this.hiddenSeries();
    return this.model().series.filter((s) => !hidden[s.def.name]);
  });

  readonly isEmpty = computed(() => {
    const m = this.model();
    return m.categories.length === 0 || m.series.every((s) => s.values.every((v) => v === null));
  });

  readonly tableData = computed<DashTableData>(() => {
    const m = this.model();
    const locale = this.resolvedLocale();
    return {
      columns: [
        { key: 'x', label: this.horizontal() ? 'Category' : 'Period' },
        ...m.series.map((s) => ({ key: s.def.id, label: s.def.name, numeric: true })),
      ],
      rows: m.categories.map((c, i) => {
        const row: Record<string, string | number | null> = { x: c.detail ? `${c.title}, ${c.detail}` : c.title };
        for (const s of m.series) row[s.def.id] = formatValue(s.values[i], s.format, locale);
        return row;
      }),
    };
  });

  /** Everything known about the x at `index` — tooltip, click and drill-down context. */
  pointAt(index: number, focusSeriesId: string | null = null): DashPointEvent {
    const m = this.model();
    const cat = m.categories[index];
    const locale = this.resolvedLocale();
    const visible = this.visibleSeries();
    const stackTotals = new Map<string, { total: number; count: number }>();
    for (const s of visible) {
      if (!s.stackKey) continue;
      const entry = stackTotals.get(s.stackKey) ?? { total: 0, count: 0 };
      entry.total += s.values[index] ?? 0;
      entry.count++;
      stackTotals.set(s.stackKey, entry);
    }
    const values = visible.map((s): DashPointValue => {
      const value = s.values[index];
      const previous = index > 0 ? s.values[index - 1] : null;
      const delta =
        this.showDelta() && value !== null && previous !== null && previous !== 0
          ? (value - previous) / Math.abs(previous)
          : null;
      const stack = s.stackKey ? stackTotals.get(s.stackKey) : undefined;
      return {
        seriesId: s.def.id,
        seriesName: s.def.name,
        value,
        formatted: formatValue(value, s.format, locale),
        color: s.color,
        dashed: !!s.def.dashed,
        previous,
        delta,
        deltaIsGood: delta === null || delta === 0 ? null : delta > 0 === (s.def.upIsGood ?? true),
        share: stack && stack.count > 1 && value !== null && stack.total ? value / stack.total : null,
        meta: s.data[index]?.meta,
      };
    });
    const stacks = [...stackTotals.entries()].filter(([, v]) => v.count > 1);
    const total = stacks.length === 1 ? stacks[0][1].total : null;
    const totalFormat = visible.find((s) => s.stackKey === stacks[0]?.[0])?.format;
    return {
      source: this.source,
      index,
      x: cat.x,
      xLabel: cat.title,
      xDetail: cat.detail,
      series: values.find((v) => v.seriesId === focusSeriesId) ?? null,
      values,
      total,
      totalFormatted: total === null ? null : formatValue(total, totalFormat, locale),
      thresholds: this.thresholds().map((th) => ({
        ...th,
        formatted: formatValue(th.value, this.valueFormat() ?? m.series[0]?.format, locale),
      })),
    };
  }

  protected readonly option = computed<EChartsCoreOption>(() => {
    const t = this.tokens();
    const m = this.model();
    const visible = this.visibleSeries();
    const horizontal = this.horizontal();
    const locale = this.resolvedLocale();
    const axisFormat = this.valueFormat() ?? m.series[0]?.format;
    const hasBars = m.series.some((s) => s.type === 'bar');
    const showLegend = this.legend() === 'show' || (this.legend() === 'auto' && m.series.length > 1);
    const zoom = this.zoom();
    const marked = this.markedIndex();
    const trigger = this.tooltipTrigger();
    const thresholds = this.thresholds();
    const tMax = thresholds.length ? Math.max(...thresholds.map((th) => th.value)) : null;
    const endLabels = this.endLabels() && visible.filter((s) => s.type !== 'bar').length <= 4;

    // Only the outermost segment of each stack gets rounded data-ends.
    const stackTop = new Map<string, string>();
    for (const s of visible) if (s.stackKey && s.type === 'bar') stackTop.set(s.stackKey, s.def.id);
    const firstVisible = visible[0]?.def.id;
    const valueLabels =
      this.valueLabels() === 'show' ||
      (this.valueLabels() === 'auto' && visible.length === 1 && m.categories.length <= 16);

    const categoryAxis = {
      type: 'category',
      data: m.categories.map((c) => c.label),
      boundaryGap: hasBars,
      axisLine: { lineStyle: { color: t.baseline } },
      axisTick: { show: false },
      axisLabel: { color: t.muted, hideOverlap: true, fontFamily: t.font, margin: 10 },
      inverse: horizontal,
    };
    const [yMin, yMax] = [this.yMin(), this.yMax()];
    const valueAxis = {
      type: 'value',
      // With both bounds fixed, ECharts splits evenly into odd ticks; pick a round interval instead.
      interval: yMin !== undefined && yMax !== undefined ? niceStep((yMax - yMin) / 4) : undefined,
      min: this.yMin(),
      max: this.yMax() ?? (tMax !== null ? (v: { max: number }) => niceCeil(Math.max(v.max, tMax)) : undefined),
      name: this.yLabel() || undefined,
      nameLocation: 'end',
      nameGap: 14,
      nameTextStyle: { color: t.muted, align: horizontal ? 'right' : 'left', fontFamily: t.font },
      splitNumber: 4,
      axisLabel: {
        color: t.muted,
        fontFamily: t.font,
        formatter: (v: number) =>
          typeof axisFormat === 'function'
            ? axisFormat(v)
            : formatValue(v, { ...axisFormat, compact: true, decimals: undefined }, locale),
      },
      splitLine: { lineStyle: { color: t.grid, type: 'solid', width: 1 } },
    };

    const series = m.series.map((s) => {
      const isTop = s.stackKey ? stackTop.get(s.stackKey) === s.def.id : true;
      const marks: Record<string, unknown> = {};
      if (s.def.id === firstVisible) {
        const lines: unknown[] = thresholds.map((th) => ({
          yAxis: horizontal ? undefined : th.value,
          xAxis: horizontal ? th.value : undefined,
          name: th.label,
          // Reference lines stay neutral so they never read as another series.
          lineStyle: { color: t.ink2, type: [4, 4], width: 1, opacity: 0.7 },
          label: {
            formatter: th.label,
            position: horizontal ? 'end' : 'insideEndTop',
            color: t.ink2,
            fontFamily: t.font,
            fontSize: 11,
          },
        }));
        if (marked !== null && marked < m.categories.length) {
          lines.push({
            [horizontal ? 'yAxis' : 'xAxis']: marked,
            lineStyle: { color: t.accent, type: 'solid', width: 1.5 },
            label: { show: false },
          });
        }
        if (lines.length) marks['markLine'] = { symbol: 'none', silent: true, animation: false, data: lines };
        const areas = this.annotations().flatMap((a) => {
          const from = m.categories.findIndex((c) => xKey(c.x) === xKey(a.from));
          const to = m.categories.findIndex((c) => xKey(c.x) === xKey(a.to));
          if (from < 0 || to < 0) return [];
          const axis = horizontal ? 'yAxis' : 'xAxis';
          return [[{ [axis]: from, name: a.label }, { [axis]: to }]];
        });
        if (areas.length) {
          marks['markArea'] = {
            silent: true,
            itemStyle: { color: withAlpha(t.ink, t.dark ? 0.08 : 0.04) },
            label: { color: t.muted, fontFamily: t.font, fontSize: 11, position: 'insideTop', distance: 6 },
            data: areas,
          };
        }
      }
      const base = {
        id: s.def.id,
        name: s.def.name,
        data: s.values,
        stack: s.stackKey ?? undefined,
        ...marks,
      };
      if (s.type === 'bar') {
        const r = isTop ? 4 : 0;
        return {
          ...base,
          type: 'bar',
          barMaxWidth: 24,
          barGap: '10%',
          itemStyle: {
            color: s.color,
            borderRadius: horizontal ? [0, r, r, 0] : [r, r, 0, 0],
            borderColor: s.stackKey ? t.surface : undefined,
            borderWidth: s.stackKey ? 1 : 0,
            decal: s.def.dashed ? { symbol: 'rect', dashArrayX: [1, 0], dashArrayY: [2, 4], rotation: Math.PI / 4, color: withAlpha(t.surface, 0.5) } : undefined,
          },
          emphasis: { focus: trigger === 'item' ? 'self' : 'none' },
          blur: { itemStyle: { opacity: 0.35 } },
          label: valueLabels
            ? {
                show: true,
                position: horizontal ? 'right' : 'top',
                color: t.ink2,
                fontFamily: t.font,
                fontSize: 11,
                formatter: (p: { value: number }) => formatValue(p.value, s.format, locale),
              }
            : undefined,
        };
      }
      const showSymbols = m.categories.length <= 16;
      return {
        ...base,
        type: 'line',
        smooth: this.smoothLines() ? 0.25 : false,
        connectNulls: false,
        symbol: 'circle',
        symbolSize: 8,
        showSymbol: showSymbols,
        lineStyle: { width: 2, color: s.color, type: s.def.dashed ? [6, 4] : 'solid', cap: 'round', join: 'round' },
        itemStyle: { color: s.color, borderColor: t.surface, borderWidth: 2 },
        areaStyle: s.type === 'area' ? { color: withAlpha(s.color, s.stackKey ? 0.22 : 0.12) } : undefined,
        emphasis: { focus: 'series', scale: 1.4, lineStyle: { width: 2.5 } },
        blur: { lineStyle: { opacity: 0.25 }, itemStyle: { opacity: 0.25 }, areaStyle: { opacity: 0.06 } },
        endLabel: endLabels
          ? {
              show: true,
              color: t.ink2,
              fontFamily: t.font,
              fontWeight: 600,
              distance: 8,
              formatter: (p: { value: number }) => formatValue(p.value, s.format, locale),
            }
          : undefined,
        z: 3,
      };
    });

    return {
      backgroundColor: 'transparent',
      animation: this.animationOn(),
      animationDuration: 450,
      animationDurationUpdate: 300,
      animationEasing: 'cubicOut',
      textStyle: { fontFamily: t.font, color: t.ink2 },
      color: m.series.map((s) => s.color),
      aria: { enabled: true, label: { description: this.label() || undefined }, decal: { show: this.patterns() } },
      grid: {
        left: 4,
        right: endLabels ? 56 : 12,
        top: showLegend ? 48 : this.yLabel() ? 28 : 12,
        bottom: zoom === 'slider' ? 52 : 4,
        containLabel: true,
      },
      legend: showLegend
        ? {
            top: 0,
            left: 0,
            itemGap: 20,
            itemWidth: 20,
            itemHeight: 10,
            textStyle: { color: t.ink2, fontFamily: t.font, fontSize: 13 },
            inactiveColor: t.grid,
            selected: Object.fromEntries(m.series.map((s) => [s.def.name, !this.hiddenSeries()[s.def.name]])),
            data: m.series.map((s) => ({ name: s.def.name, icon: s.type === 'bar' ? 'roundRect' : undefined })),
          }
        : { show: false },
      tooltip: {
        trigger,
        confine: true,
        padding: 0,
        borderWidth: 0,
        backgroundColor: 'transparent',
        extraCssText: 'box-shadow:none;',
        className: 'dash-tip-host',
        transitionDuration: 0.12,
        axisPointer: hasBars
          ? { type: 'shadow', shadowStyle: { color: withAlpha(t.ink, t.dark ? 0.08 : 0.04) } }
          : { type: 'line', lineStyle: { color: t.baseline, width: 1 }, label: { show: false } },
        formatter: (params: unknown) => this.formatTooltip(params),
      },
      dataZoom:
        zoom === 'none'
          ? []
          : [
              {
                type: 'inside',
                [horizontal ? 'yAxisIndex' : 'xAxisIndex']: 0,
                zoomOnMouseWheel: 'ctrl',
                moveOnMouseWheel: false,
                moveOnMouseMove: true,
              },
              ...(zoom === 'slider' && !horizontal
                ? [
                    {
                      type: 'slider',
                      xAxisIndex: 0,
                      height: 22,
                      bottom: 8,
                      borderColor: t.grid,
                      backgroundColor: 'transparent',
                      fillerColor: withAlpha(t.accent, 0.1),
                      dataBackground: { lineStyle: { color: t.baseline }, areaStyle: { color: withAlpha(t.ink, 0.05) } },
                      selectedDataBackground: { lineStyle: { color: t.accent }, areaStyle: { color: withAlpha(t.accent, 0.12) } },
                      handleStyle: { color: t.surface, borderColor: t.accent },
                      moveHandleStyle: { color: withAlpha(t.accent, 0.3) },
                      textStyle: { color: t.muted, fontFamily: t.font },
                    },
                  ]
                : []),
            ],
      xAxis: horizontal ? valueAxis : categoryAxis,
      yAxis: horizontal ? categoryAxis : valueAxis,
      series,
    };
  });

  protected tooltipTrigger(): 'axis' | 'item' {
    return 'axis';
  }

  private formatTooltip(params: unknown): HTMLElement | string {
    const list = (Array.isArray(params) ? params : [params]) as { dataIndex: number; seriesId?: string }[];
    if (!list.length) return '';
    const index = list[0].dataIndex;
    const focus = this.tooltipTrigger() === 'item' ? (list[0].seriesId ?? null) : this.hoveredSeriesId;
    const ctx = this.pointAt(index, focus);
    if (index !== this.lastHoverIndex) {
      this.lastHoverIndex = index;
      this.pointHover.emit(ctx);
      this.announce(ctx);
    }
    return this.renderTooltip(ctx, () => this.tooltips.renderPoint(ctx, this.hint(), this.resolvedLocale()));
  }

  private announce(ctx: DashPointEvent): void {
    const parts = ctx.values.map((v) => `${v.seriesName} ${v.formatted}`);
    this.announcement.set(`${ctx.xLabel}${ctx.xDetail ? ', ' + ctx.xDetail : ''}: ${parts.join(', ')}`);
  }

  protected override onChartInit(chart: ECharts): void {
    super.onChartInit(chart);
    const group = this.syncGroup();
    if (group) {
      chart.group = group;
      connect(group);
    }
    // Clicking anywhere in a column selects that x — readers aim at a date, not at a 2px line.
    chart.getZr().on('click', (e: { offsetX: number; offsetY: number }) => {
      const index = this.indexAt([e.offsetX, e.offsetY]);
      if (index !== null) this.select(index, this.hoveredSeriesId);
    });
  }

  protected onMouseOver(e: ECElementEvent): void {
    if (e.componentType === 'series') this.hoveredSeriesId = e.seriesId ?? null;
  }

  protected onMouseOut(): void {
    this.hoveredSeriesId = null;
  }

  protected onGlobalOut(): void {
    this.lastHoverIndex = null;
    this.pointHover.emit(null);
  }

  protected onLegendChange(e: { selected: Record<string, boolean> }): void {
    this.hiddenSeries.set(Object.fromEntries(Object.entries(e.selected).map(([k, v]) => [k, !v])));
  }

  private indexAt(point: [number, number]): number | null {
    const chart = this.chart();
    const n = this.model().categories.length;
    if (!chart || !n || !chart.containPixel({ gridIndex: 0 }, point)) return null;
    const value = chart.convertFromPixel({ gridIndex: 0 }, point) as number[];
    const raw = this.horizontal() ? value[1] : value[0];
    return Math.min(n - 1, Math.max(0, Math.round(raw)));
  }

  private select(index: number, seriesId: string | null): void {
    this.clickedIndex.set(index);
    this.activeIndex.set(index);
    const ctx = this.pointAt(index, seriesId);
    this.activate(ctx, ctx.xLabel, [ctx.xDetail, this.label()].filter(Boolean).join(' — '));
  }

  protected onKeydown(e: KeyboardEvent): void {
    const n = this.model().categories.length;
    const chart = this.chart();
    if (!n || !chart) return;
    const current = this.activeIndex();
    let next = current ?? n - 1;
    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        next = current === null ? n - 1 : Math.min(n - 1, current + 1);
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        next = current === null ? n - 1 : Math.max(0, current - 1);
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = n - 1;
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        this.select(next, null);
        return;
      case 'Escape':
        this.hideTip();
        this.clickedIndex.set(null);
        return;
      default:
        return;
    }
    e.preventDefault();
    this.activeIndex.set(next);
    const seriesIndex = Math.max(0, this.model().series.findIndex((s) => s === this.visibleSeries()[0]));
    chart.dispatchAction({ type: 'showTip', seriesIndex, dataIndex: next });
  }

  hideTip(): void {
    this.chart()?.dispatchAction({ type: 'hideTip' });
  }
}

