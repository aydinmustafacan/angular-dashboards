import { EmbeddedViewRef, Injectable, Injector, OnDestroy, TemplateRef, inject } from '@angular/core';
import { formatDelta, formatShare } from './format';
import { DashPointEvent, DashSliceEvent } from './types';

/** Template context for custom tooltips: `<ng-template let-ctx>`. */
export interface DashTooltipTemplateContext<T> {
  $implicit: T;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  // Labels come from host data — always textContent, never innerHTML.
  if (text !== undefined) node.textContent = text;
  return node;
}

function head(title: string, detail: string): HTMLElement {
  const h = el('div', 'dash-tip__head');
  h.append(el('span', 'dash-tip__title', title));
  if (detail) h.append(el('span', 'dash-tip__detail', detail));
  return h;
}

function foot(hint: string): HTMLElement {
  return el('div', 'dash-tip__foot', hint);
}

/**
 * Renders chart tooltips as DOM elements handed to ECharts. One instance per chart.
 * The default look is a compact "waybill": heading strip, value rows, perforation, action hint.
 */
@Injectable()
export class DashTooltipRenderer implements OnDestroy {
  private readonly injector = inject(Injector);
  private view: EmbeddedViewRef<DashTooltipTemplateContext<unknown>> | null = null;
  private template: TemplateRef<unknown> | null = null;
  private readonly customHost = el('div', 'dash-tip dash-tip--custom');

  renderTemplate<T>(template: TemplateRef<DashTooltipTemplateContext<T>>, ctx: T): HTMLElement {
    if (this.template !== template) {
      this.view?.destroy();
      this.template = template as TemplateRef<unknown>;
      this.view = (template as TemplateRef<DashTooltipTemplateContext<unknown>>).createEmbeddedView(
        { $implicit: ctx },
        this.injector,
      );
      this.customHost.replaceChildren(...(this.view.rootNodes as Node[]));
    } else {
      this.view!.context.$implicit = ctx;
    }
    this.view!.detectChanges();
    return this.customHost;
  }

  renderPoint(ctx: DashPointEvent, hint: string | null, locale: string): HTMLElement {
    const root = el('div', 'dash-tip');
    root.append(head(ctx.xLabel, ctx.xDetail));
    const body = el('div', 'dash-tip__body');
    const focusId = ctx.series?.seriesId;
    for (const v of ctx.values) {
      const row = el('div', 'dash-tip__row');
      if (focusId && v.seriesId !== focusId) row.classList.add('is-dim');
      const key = el('span', v.dashed ? 'dash-tip__key is-dashed' : 'dash-tip__key');
      key.style.setProperty('--dash-key', v.color);
      row.append(key, el('span', 'dash-tip__value', v.formatted), el('span', 'dash-tip__name', v.seriesName));
      if (v.delta !== null && Number.isFinite(v.delta)) {
        const tone = v.deltaIsGood === null ? '' : v.deltaIsGood ? ' is-good' : ' is-bad';
        const delta = el('span', 'dash-tip__delta' + tone, `${v.delta >= 0 ? '▲' : '▼'} ${formatDelta(v.delta, locale)}`);
        delta.title = 'Change vs. previous';
        row.append(delta);
      } else if (v.share !== null) {
        row.append(el('span', 'dash-tip__delta', formatShare(v.share, locale)));
      }
      body.append(row);
    }
    if (ctx.totalFormatted) {
      const row = el('div', 'dash-tip__row dash-tip__row--total');
      row.append(el('span', 'dash-tip__key is-blank'), el('span', 'dash-tip__value', ctx.totalFormatted), el('span', 'dash-tip__name', 'Total'));
      body.append(row);
    }
    for (const t of ctx.thresholds) {
      const row = el('div', 'dash-tip__row dash-tip__row--ref');
      const key = el('span', 'dash-tip__key is-dashed');
      key.style.setProperty('--dash-key', 'var(--dash-muted, #7d8893)');
      row.append(key, el('span', 'dash-tip__value', t.formatted), el('span', 'dash-tip__name', t.label));
      body.append(row);
    }
    root.append(body);
    if (hint) root.append(foot(hint));
    return root;
  }

  renderSlice(ctx: DashSliceEvent, hint: string | null, locale: string): HTMLElement {
    const root = el('div', 'dash-tip');
    root.append(head(ctx.name, `${formatShare(ctx.share, locale)} of ${ctx.totalFormatted}`));
    const body = el('div', 'dash-tip__body');
    const row = el('div', 'dash-tip__row');
    const key = el('span', 'dash-tip__key is-dot');
    key.style.setProperty('--dash-key', ctx.color);
    row.append(key, el('span', 'dash-tip__value', ctx.formatted));
    body.append(row);
    if (ctx.children.length) {
      const list = el('div', 'dash-tip__children');
      for (const child of ctx.children.slice(0, 5)) {
        const r = el('div', 'dash-tip__row dash-tip__row--child');
        r.append(el('span', 'dash-tip__name', child.name), el('span', 'dash-tip__delta', formatShare(child.value / ctx.total, locale)));
        list.append(r);
      }
      if (ctx.children.length > 5) list.append(el('div', 'dash-tip__more', `and ${ctx.children.length - 5} more`));
      body.append(list);
    }
    root.append(body);
    if (hint) root.append(foot(hint));
    return root;
  }

  ngOnDestroy(): void {
    this.view?.destroy();
  }
}
