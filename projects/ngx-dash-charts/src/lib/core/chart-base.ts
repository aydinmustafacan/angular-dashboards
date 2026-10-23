import {
  Directive,
  InjectionToken,
  LOCALE_ID,
  Signal,
  TemplateRef,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import type { ECharts } from 'echarts/core';
import { DashDrillTemplateContext, DashDrilldownMode, DashDrilldownService } from './drilldown';
import { DashThemeService } from './theme';
import { DashTooltipRenderer, DashTooltipTemplateContext } from './tooltip';
import { DashDrillContext, DashTableData } from './types';

/** What a chart exposes to a surrounding `dash-chart-card` (table view, exports). */
export interface DashChartHandle {
  readonly label: Signal<string>;
  readonly tableData: Signal<DashTableData>;
  exportImage(): string | null;
}

export const DASH_CHART = new InjectionToken<DashChartHandle>('DASH_CHART');

/**
 * Inputs, outputs and plumbing shared by every chart: theming, tooltips (default or
 * template), click → event + optional drill-down panel, loading/empty states, export.
 */
@Directive({
  host: {
    '[attr.aria-label]': 'ariaLabel()',
    '[style.--dash-chart-height]': 'heightCss()',
    '[class.dash-fill]': 'height() === "fill"',
  },
})
export abstract class DashChartBase<E extends DashDrillContext> implements DashChartHandle {
  protected readonly theme = inject(DashThemeService);
  protected readonly tooltips = inject(DashTooltipRenderer);
  private readonly drilldown = inject(DashDrilldownService);
  private readonly defaultLocale = inject(LOCALE_ID);

  /** Accessible name; also used as the drill-down panel subtitle and export file name. */
  readonly label = input('');
  /** Plot height: pixels, any CSS length, or `'fill'` to fill a sized parent (e.g. a board cell). */
  readonly height = input<number | string>(320);
  /** Keeps the previous render at reduced opacity while new data loads. */
  readonly loading = input(false);
  readonly emptyText = input('No data for this period');
  readonly locale = input<string | undefined>(undefined);
  readonly renderer = input<'canvas' | 'svg'>('canvas');
  /** Adds hatched textures to marks so series stay distinguishable without colour. */
  readonly patterns = input(false);
  readonly animate = input(true);

  /** Replaces the default tooltip. Context: `let-ctx` — the same object click events emit. */
  readonly tooltipTemplate = input<TemplateRef<DashTooltipTemplateContext<E>> | null>(null);
  /** When set, clicking a point opens this template in a side sheet. Context: `let-ctx let-close="close"`. */
  readonly drilldownTemplate = input<TemplateRef<DashDrillTemplateContext<E>> | null>(null);
  readonly drilldownMode = input<DashDrilldownMode>('sheet');
  /** Hint shown at the bottom of the tooltip. Defaults to "Click for details" when a drill-down is set. */
  readonly clickHint = input<string | null | undefined>(undefined);

  readonly pointClick = output<E>();
  readonly pointHover = output<E | null>();

  protected readonly chart = signal<ECharts | null>(null);
  protected readonly tokens = this.theme.tokens;
  protected readonly resolvedLocale = computed(() => this.locale() ?? this.defaultLocale);
  protected readonly heightCss = computed(() => {
    const h = this.height();
    return typeof h === 'number' ? `${h}px` : h === 'fill' ? '100%' : h;
  });
  protected readonly initOpts = computed(() => ({ renderer: this.renderer() }));
  protected readonly hint = computed(() => {
    const hint = this.clickHint();
    if (hint !== undefined) return hint || null;
    return this.drilldownTemplate() ? 'Click for details' : null;
  });
  protected readonly reducedMotion =
    typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  protected readonly animationOn = computed(() => this.animate() && !this.reducedMotion);
  /** Polite live-region text describing the focused/hovered point for screen readers. */
  protected readonly announcement = signal('');

  abstract readonly tableData: Signal<DashTableData>;
  abstract readonly isEmpty: Signal<boolean>;

  protected ariaLabel(): string | null {
    return this.label() || null;
  }

  protected onChartInit(chart: ECharts): void {
    this.chart.set(chart);
  }

  /** Renders a tooltip for `ctx`, honouring a custom template. */
  protected renderTooltip(ctx: E, fallback: () => HTMLElement): HTMLElement {
    const tpl = this.tooltipTemplate();
    return tpl ? this.tooltips.renderTemplate(tpl, ctx) : fallback();
  }

  protected activate(ctx: E, title: string, subtitle: string): void {
    this.pointClick.emit(ctx);
    const template = this.drilldownTemplate();
    if (template) {
      this.drilldown.open({ template, context: ctx, title, subtitle, mode: this.drilldownMode() });
    }
  }

  exportImage(): string | null {
    const chart = this.chart();
    if (!chart) return null;
    return chart.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: this.tokens().surface });
  }
}
