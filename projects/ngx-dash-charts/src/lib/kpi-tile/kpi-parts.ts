import { ChangeDetectionStrategy, Component, DestroyRef, Directive, ElementRef, computed, inject } from '@angular/core';
import type { ECharts, EChartsCoreOption } from 'echarts/core';
import { NgxEchartsDirective } from 'ngx-echarts';
import { withAlpha } from '../core/theme';
import { DashKpiContext, injectKpi } from './kpi-base';

/** Label, status, headline value and delta. Every KPI renders this first. */
@Component({
  selector: 'dash-kpi-summary',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'dash-kpi__summary' },
  template: `
    <div class="dash-kpi__head">
      <h3 class="dash-kpi__label">{{ kpi.label() }}</h3>
      @if (kpi.status(); as s) {
        <span class="dash-kpi__status" [class]="'dash-kpi__status is-' + s">
          <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true">
            @switch (s) {
              @case ('good') { <path d="M2.5 6.2l2.3 2.3 4.7-5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" /> }
              @case ('warning') { <path d="M6 1.5l4.8 8.5H1.2z" fill="currentColor" /> }
              @case ('serious') { <path d="M6 1l5 5-5 5-5-5z" fill="currentColor" /> }
              @default { <circle cx="6" cy="6" r="4.5" fill="currentColor" /> }
            }
          </svg>
          {{ kpi.statusText() }}
        </span>
      }
    </div>
    <p class="dash-kpi__value">{{ kpi.formattedValue() }}</p>
    @if (kpi.delta() !== null) {
      <p class="dash-kpi__delta" [class.is-good]="kpi.deltaGood() === true" [class.is-bad]="kpi.deltaGood() === false">
        <span aria-hidden="true">{{ glyph() }}</span>
        {{ kpi.formattedDelta() }}
        <span class="dash-kpi__delta-label">{{ kpi.deltaLabel() }}</span>
      </p>
    }
  `,
})
export class DashKpiSummary {
  protected readonly kpi = injectKpi('dash-kpi-summary');
  protected readonly glyph = computed(() => {
    const d = this.kpi.delta() ?? 0;
    return d > 0 ? '▲' : d < 0 ? '▼' : '■';
  });
}

/** Small print under the visual. Accepts markup: `<dash-kpi-caption>Target <strong>95%</strong></dash-kpi-caption>`. */
@Component({
  selector: 'dash-kpi-caption',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'dash-kpi__caption' },
  template: '<ng-content />',
})
export class DashKpiCaption {}

/**
 * Marks a custom element as the KPI's visual, so `dash-kpi` places and sizes it like the
 * built-in ones. Inside, read the shared data with `injectKpi()`.
 */
@Directive({
  selector: '[dashKpiVisual]',
  host: { class: 'dash-kpi__visual' },
})
export class DashKpiVisual {}

/** Plumbing shared by the built-in ECharts visuals: chart hand-off, period clicks, tooltip. */
@Directive({
  host: { class: 'dash-kpi__visual', '[class.is-hidden]': 'kpi.trend().length < 2' },
})
abstract class DashKpiSparkBase {
  protected readonly kpi: DashKpiContext = injectKpi(inject(ElementRef).nativeElement.localName);
  protected readonly initOpts = computed(() => ({ renderer: this.kpi.renderer() }));
  abstract readonly option: () => EChartsCoreOption;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.kpi.attachChart(null));
  }

  protected onChartInit(chart: ECharts): void {
    this.kpi.attachChart(chart);
    chart.getZr().on('click', (e: { offsetX: number; offsetY: number }) => {
      const n = this.kpi.trend().length;
      const point: [number, number] = [e.offsetX, e.offsetY];
      if (!n || !chart.containPixel({ gridIndex: 0 }, point)) return;
      const [raw] = chart.convertFromPixel({ gridIndex: 0 }, point) as number[];
      this.kpi.pickPeriod(Math.min(n - 1, Math.max(0, Math.round(raw))));
    });
  }

  /** Everything but the series: hidden axes, an axis tooltip that renders the dash tooltip. */
  protected frame(boundaryGap: boolean, pointer: object): EChartsCoreOption {
    const kpi = this.kpi;
    return {
      backgroundColor: 'transparent',
      animation: kpi.animate(),
      grid: { left: 4, right: 6, top: 6, bottom: 4 },
      aria: { enabled: true, label: { description: `${kpi.label()} trend` } },
      xAxis: { type: 'category', show: false, boundaryGap, data: kpi.periods() },
      tooltip: {
        trigger: 'axis',
        confine: true,
        padding: 0,
        borderWidth: 0,
        backgroundColor: 'transparent',
        extraCssText: 'box-shadow:none;',
        className: 'dash-tip-host',
        transitionDuration: 0.12,
        axisPointer: pointer,
        formatter: (params: { dataIndex: number }[]) => kpi.tooltipFor(params[0].dataIndex),
      },
    };
  }
}

const SPARK_TEMPLATE = `
  @if (kpi.trend().length > 1) {
    <div echarts class="dash-kpi__spark" [options]="option()" [initOpts]="initOpts()" (chartInit)="onChartInit($event)"></div>
  }
`;

/** Line and soft area, latest point marked. The default KPI visual. */
@Component({
  selector: 'dash-kpi-sparkline',
  imports: [NgxEchartsDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: SPARK_TEMPLATE,
})
export class DashKpiSparkline extends DashKpiSparkBase {
  readonly option = computed<EChartsCoreOption>(() => {
    const t = this.kpi.tokens();
    const data = this.kpi.trend();
    const last = data.length - 1;
    return {
      ...this.frame(false, { type: 'line', lineStyle: { color: t.baseline, width: 1 } }),
      yAxis: { type: 'value', show: false, scale: true },
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
}

/**
 * One bar per period, latest in the accent colour. Bars start at zero, so use it for counts
 * and volumes; for rates that move within a narrow band the sparkline reads better.
 */
@Component({
  selector: 'dash-kpi-spark-bars',
  imports: [NgxEchartsDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: SPARK_TEMPLATE,
})
export class DashKpiSparkBars extends DashKpiSparkBase {
  readonly option = computed<EChartsCoreOption>(() => {
    const t = this.kpi.tokens();
    const data = this.kpi.trend();
    const last = data.length - 1;
    return {
      ...this.frame(true, { type: 'shadow', shadowStyle: { color: withAlpha(t.muted, 0.12) } }),
      yAxis: { type: 'value', show: false },
      series: [
        {
          type: 'bar',
          data: data.map((d, i) => (i === last ? { value: d.y, itemStyle: { color: t.accent } } : d.y)),
          barCategoryGap: '30%',
          itemStyle: { color: withAlpha(t.muted, 0.45), borderRadius: [2, 2, 0, 0] },
          emphasis: { disabled: true },
        },
      ],
    };
  });
}
