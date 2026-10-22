import {
  ChangeDetectionStrategy,
  Component,
  ViewEncapsulation,
  computed,
  forwardRef,
  input,
  model,
  signal,
} from '@angular/core';
import type { ECElementEvent, EChartsCoreOption } from 'echarts/core';
import { NgxEchartsDirective } from 'ngx-echarts';
import { DASH_CHART, DashChartBase } from '../core/chart-base';
import { formatShare, formatValue } from '../core/format';
import { seriesColor } from '../core/theme';
import { DashTooltipRenderer } from '../core/tooltip';
import { DashSlice, DashSliceEvent, DashTableData, DashValueFormat } from '../core/types';

interface ResolvedSlice {
  id: string;
  name: string;
  value: number;
  color: string;
  children: DashSlice[];
  meta?: unknown;
}

const OTHER_ID = '__other';

/**
 * Part-to-whole donut (or pie). Hover a slice or legend row to read it in the centre; click to
 * select it and open its drill-down; click a legend row to hide it and re-base the shares.
 * Small slices fold into "Other" so the palette never runs out.
 */
@Component({
  selector: 'dash-pie-chart',
  exportAs: 'dashChart',
  imports: [NgxEchartsDirective],
  providers: [DashTooltipRenderer, { provide: DASH_CHART, useExisting: forwardRef(() => DashPieChart) }],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    tabindex: '0',
    role: 'group',
    'aria-roledescription': 'chart',
    '(keydown)': 'onKeydown($event)',
    '(blur)': 'onBlur()',
  },
  template: `
    <div class="dash-pie" [class]="'dash-pie--legend-' + legendPosition()" [class.is-loading]="loading()">
      <div class="dash-pie__plot dash-chart">
        <div
          echarts
          class="dash-chart__canvas"
          [options]="option()"
          [initOpts]="initOpts()"
          (chartInit)="onChartInit($event)"
          (chartClick)="onSliceClick($event)"
          (chartMouseOver)="onSliceOver($event)"
          (chartMouseOut)="hoveredId.set(null)"
        ></div>
        @if (donut() && !isEmpty()) {
          <div class="dash-pie__center" aria-hidden="true">
            <span class="dash-pie__center-value">{{ center().value }}</span>
            <span class="dash-pie__center-label">{{ center().label }}</span>
          </div>
        }
        @if (isEmpty()) {
          <p class="dash-chart__empty">{{ loading() ? 'Loading…' : emptyText() }}</p>
        }
      </div>
      @if (legendPosition() !== 'none' && !isEmpty()) {
        <ul class="dash-pie__legend">
          @for (s of resolved(); track s.id) {
            <li>
              <button
                type="button"
                class="dash-pie__legend-item"
                [class.is-off]="hidden()[s.id]"
                [class.is-selected]="selectedSet().has(s.id)"
                [class.is-hovered]="hoveredId() === s.id"
                [attr.aria-pressed]="!hidden()[s.id]"
                [attr.title]="hidden()[s.id] ? 'Show ' + s.name : 'Hide ' + s.name"
                (click)="toggle(s.id)"
                (mouseenter)="highlight(s.id)"
                (mouseleave)="highlight(null)"
              >
                <span class="dash-pie__swatch" [style.background]="s.color"></span>
                <span class="dash-pie__name">{{ s.name }}</span>
                <span class="dash-pie__value">{{ format(s.value) }}</span>
                <span class="dash-pie__share">{{ hidden()[s.id] ? '–' : share(s.value) }}</span>
              </button>
            </li>
          }
        </ul>
      }
      <p class="dash-sr-only" aria-live="polite">{{ announcement() }}</p>
    </div>
  `,
  styleUrls: ['../core/chart.css', './pie-chart.css'],
})
export class DashPieChart extends DashChartBase<DashSliceEvent> {
  readonly data = input<DashSlice[]>([]);
  readonly donut = input(true);
  readonly valueFormat = input<DashValueFormat | undefined>(undefined);
  /** Caption under the total in the donut centre. */
  readonly totalLabel = input('Total');
  /** Largest number of slices drawn; the rest fold into "Other". Capped at 8 by the palette. */
  readonly maxSlices = input(6);
  readonly otherLabel = input('Other');
  /** Sort slices largest first. Colours still follow each slice's id, not its rank. */
  readonly sort = input(true);
  readonly selectionMode = input<'single' | 'multiple' | 'none'>('single');
  /** Selected slice ids. Two-way bindable: `[(selected)]`. */
  readonly selected = model<string[]>([]);
  readonly legendPosition = input<'side' | 'bottom' | 'none'>('side');
  readonly sliceLabels = input(false);
  override readonly height = input<number | string>(260);

  protected readonly hoveredId = signal<string | null>(null);
  protected readonly hidden = signal<Record<string, boolean>>({});
  private readonly activeIndex = signal<number | null>(null);

  protected readonly selectedSet = computed(() => new Set(this.selected()));

  /** Slices after sorting and folding, in legend order. */
  protected readonly resolved = computed<ResolvedSlice[]>(() => {
    const t = this.tokens();
    const input = this.data().map((s, i) => ({ s, slot: s.slot ?? i + 1 }));
    const ordered = this.sort() ? [...input].sort((a, b) => b.s.value - a.s.value) : input;
    const max = Math.min(8, Math.max(2, this.maxSlices()));
    const keep = ordered.length > max ? ordered.slice(0, max - 1) : ordered;
    const folded = ordered.length > max ? ordered.slice(max - 1).map((o) => o.s) : [];
    const slices: ResolvedSlice[] = keep.map(({ s, slot }) => ({
      id: s.id,
      name: s.name,
      value: s.value,
      color: s.color ?? seriesColor(t, slot),
      children: [],
      meta: s.meta,
    }));
    if (folded.length) {
      slices.push({
        id: OTHER_ID,
        name: this.otherLabel(),
        value: folded.reduce((sum, s) => sum + s.value, 0),
        color: t.muted,
        children: folded,
      });
    }
    return slices;
  });

  private readonly visible = computed(() => this.resolved().filter((s) => !this.hidden()[s.id]));
  private readonly total = computed(() => this.visible().reduce((sum, s) => sum + s.value, 0));

  readonly isEmpty = computed(() => this.total() <= 0 && this.resolved().every((s) => s.value <= 0));

  protected readonly center = computed(() => {
    const focusId = this.hoveredId() ?? (this.selected().length === 1 ? this.selected()[0] : null);
    const focus = focusId ? this.visible().find((s) => s.id === focusId) : undefined;
    if (focus) return { value: this.format(focus.value), label: `${focus.name}, ${this.share(focus.value)}` };
    return { value: this.format(this.total()), label: this.totalLabel() };
  });

  readonly tableData = computed<DashTableData>(() => ({
    columns: [
      { key: 'name', label: 'Segment' },
      { key: 'value', label: 'Value', numeric: true },
      { key: 'share', label: 'Share', numeric: true },
    ],
    rows: this.resolved().map((s) => ({
      name: s.name,
      value: this.format(s.value),
      share: this.hidden()[s.id] ? '–' : this.share(s.value),
    })),
  }));

  protected readonly option = computed<EChartsCoreOption>(() => {
    const t = this.tokens();
    const mode = this.selectionMode();
    const selected = this.selectedSet();
    const donut = this.donut();
    return {
      backgroundColor: 'transparent',
      animation: this.animationOn(),
      animationDurationUpdate: 300,
      textStyle: { fontFamily: t.font, color: t.ink2 },
      aria: { enabled: true, label: { description: this.label() || undefined }, decal: { show: this.patterns() } },
      tooltip: {
        trigger: 'item',
        confine: true,
        padding: 0,
        borderWidth: 0,
        backgroundColor: 'transparent',
        extraCssText: 'box-shadow:none;',
        className: 'dash-tip-host',
        transitionDuration: 0.12,
        formatter: (p: { dataIndex: number }) => {
          const ctx = this.sliceEvent(p.dataIndex);
          return this.renderTooltip(ctx, () => this.tooltips.renderSlice(ctx, this.hint(), this.resolvedLocale()));
        },
      },
      series: [
        {
          type: 'pie',
          id: 'slices',
          radius: donut ? ['60%', '84%'] : [0, '84%'],
          center: ['50%', '50%'],
          padAngle: 0.6,
          minAngle: 2,
          avoidLabelOverlap: true,
          selectedMode: mode === 'none' ? false : mode,
          selectedOffset: 7,
          itemStyle: { borderColor: t.surface, borderWidth: 2, borderRadius: 4 },
          label: this.sliceLabels()
            ? { show: true, color: t.ink2, fontFamily: t.font, fontSize: 12, formatter: '{b}' }
            : { show: false },
          labelLine: { show: this.sliceLabels(), lineStyle: { color: t.baseline } },
          emphasis: { scale: true, scaleSize: 5, label: { show: this.sliceLabels() } },
          data: this.visible().map((s) => ({
            id: s.id,
            name: s.name,
            value: s.value,
            selected: selected.has(s.id),
            itemStyle: { color: s.color },
          })),
        },
      ],
    };
  });

  protected format(value: number): string {
    return formatValue(value, this.valueFormat(), this.resolvedLocale());
  }

  protected share(value: number): string {
    const total = this.total();
    return total ? formatShare(value / total, this.resolvedLocale()) : '–';
  }

  private sliceEvent(index: number): DashSliceEvent {
    const s = this.visible()[index];
    const total = this.total();
    return {
      source: 'pie',
      index,
      id: s.id,
      name: s.name,
      value: s.value,
      formatted: this.format(s.value),
      share: total ? s.value / total : 0,
      color: s.color,
      total,
      totalFormatted: this.format(total),
      children: s.children,
      selectedIds: this.selected(),
      meta: s.meta,
    };
  }

  protected onSliceOver(e: ECElementEvent): void {
    const s = this.visible()[e.dataIndex];
    if (!s) return;
    this.hoveredId.set(s.id);
    const ctx = this.sliceEvent(e.dataIndex);
    this.pointHover.emit(ctx);
    this.announcement.set(`${ctx.name}: ${ctx.formatted}, ${formatShare(ctx.share, this.resolvedLocale())}`);
  }

  protected onSliceClick(e: ECElementEvent): void {
    this.activateIndex(e.dataIndex);
  }

  private activateIndex(index: number): void {
    const s = this.visible()[index];
    if (!s) return;
    const mode = this.selectionMode();
    if (mode !== 'none') {
      const current = this.selected();
      const on = !current.includes(s.id);
      this.selected.set(
        mode === 'single' ? (on ? [s.id] : []) : on ? [...current, s.id] : current.filter((id) => id !== s.id),
      );
    }
    const ctx = this.sliceEvent(index);
    this.activate(ctx, ctx.name, [`${ctx.formatted}, ${formatShare(ctx.share, this.resolvedLocale())} of total`, this.label()].filter(Boolean).join(' — '));
  }

  protected toggle(id: string): void {
    this.hidden.update((h) => ({ ...h, [id]: !h[id] }));
    if (this.hidden()[id]) this.selected.update((sel) => sel.filter((s) => s !== id));
  }

  protected highlight(id: string | null): void {
    const chart = this.chart();
    this.hoveredId.set(id);
    if (!chart) return;
    chart.dispatchAction({ type: 'downplay', seriesIndex: 0 });
    const index = id === null ? -1 : this.visible().findIndex((s) => s.id === id);
    if (index >= 0) chart.dispatchAction({ type: 'highlight', seriesIndex: 0, dataIndex: index });
  }

  protected onKeydown(e: KeyboardEvent): void {
    const n = this.visible().length;
    const chart = this.chart();
    if (!n || !chart) return;
    const current = this.activeIndex();
    let next: number;
    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        next = current === null ? 0 : (current + 1) % n;
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        next = current === null ? n - 1 : (current - 1 + n) % n;
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (current !== null) this.activateIndex(current);
        return;
      case 'Escape':
        this.onBlur();
        return;
      default:
        return;
    }
    e.preventDefault();
    this.activeIndex.set(next);
    this.highlight(this.visible()[next].id);
    chart.dispatchAction({ type: 'showTip', seriesIndex: 0, dataIndex: next });
    this.onSliceOver({ dataIndex: next } as ECElementEvent);
  }

  protected onBlur(): void {
    this.activeIndex.set(null);
    this.highlight(null);
    this.chart()?.dispatchAction({ type: 'hideTip' });
  }
}
