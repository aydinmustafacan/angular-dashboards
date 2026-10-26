# Code patterns for compound components

Templates for Angular 17+ (signal inputs, `@if`, standalone). Names use the KPI example; rename for your component.

## Contents
1. Context token
2. Shell
3. A part
4. Slot marker + swappable visuals
5. Preset
6. Container-query density
7. Tests

## 1. Context token

```ts
import { InjectionToken, Signal, inject } from '@angular/core';

export interface DashKpiContext {
  readonly label: Signal<string>;
  readonly trend: Signal<DashDatum[]>;
  readonly value: Signal<number | null>;
  readonly delta: Signal<number | null>;
  readonly deltaGood: Signal<boolean | null>;
  readonly formattedValue: Signal<string>;
  readonly formattedDelta: Signal<string>;
}

export const DASH_KPI = new InjectionToken<DashKpiContext>('DASH_KPI');

/** For parts: fails loudly when used outside <dash-kpi>. */
export function injectKpi(part: string): DashKpiContext {
  const ctx = inject(DASH_KPI, { optional: true });
  if (!ctx) throw new Error(`<${part}> must be placed inside <dash-kpi>.`);
  return ctx;
}
```

Expose only signals (read-only). Parts never write to the context; events go out through the shell's outputs.

## 2. Shell

```ts
@Component({
  selector: 'dash-kpi',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  // `providers` (not viewProviders): projected parts resolve through the host element's injector.
  providers: [{ provide: DASH_KPI, useExisting: forwardRef(() => DashKpi) }],
  host: {
    class: 'dash-kpi',
    '[class.has-visual]': '!!visual()',
    '[attr.role]': 'interactive() ? "button" : null',
    '[attr.tabindex]': 'interactive() ? 0 : null',
    '[attr.aria-label]': 'ariaLabel()',
    '(click)': 'activate()',
    '(keydown.enter)': 'activate()',
    '(keydown.space)': '$event.preventDefault(); activate()',
  },
  template: `
    <div class="dash-kpi__head">
      <ng-content select="dash-kpi-label" />
      <ng-content select="dash-kpi-status" />
    </div>
    <ng-content select="dash-kpi-value" />
    <ng-content select="dash-kpi-delta" />
    <div class="dash-kpi__visual"><ng-content select="[dashKpiVisual]" /></div>
    <ng-content />  <!-- caption and anything else -->
  `,
  styleUrls: ['./kpi.css'],
})
export class DashKpi implements DashKpiContext {
  readonly label = input('');
  readonly trend = input<DashDatum[]>([]);
  readonly valueInput = input<number | null | undefined>(undefined, { alias: 'value' });
  readonly deltaInput = input<number | null | undefined>(undefined, { alias: 'delta' });
  readonly upIsGood = input(true);
  readonly clickable = input(false);
  readonly activated = output<void>();

  protected readonly visual = contentChild(DashKpiVisual);

  readonly value = computed(() => { /* explicit value, else last trend point */ });
  readonly delta = computed(() => { /* explicit delta, else last two points */ });
  readonly deltaGood = computed(() => { /* sign × upIsGood */ });
  readonly formattedValue = computed(() => /* … */ '');
  readonly formattedDelta = computed(() => /* … */ '');

  protected readonly interactive = computed(() => this.clickable());
  protected readonly ariaLabel = computed(() =>
    [this.label(), this.formattedValue(), this.formattedDelta()].filter(Boolean).join(', '));

  protected activate() { if (this.interactive()) this.activated.emit(); }
}
```

Notes:
- Fixed slot order in the shell template means consumers can't break the layout by writing parts in a different order. If reordering *is* a requirement, use a single `<ng-content />` and CSS grid areas instead.
- `select` on an element name works for parts; `select="[attr]"` for interchangeable visuals.
- Wrapper divs around empty slots: hide with `.dash-kpi__visual:empty { display: none }` or the `has-visual` class.

## 3. A part

```ts
@Component({
  selector: 'dash-kpi-delta',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'dash-kpi__delta',
    '[class.is-good]': 'kpi.deltaGood() === true',
    '[class.is-bad]': 'kpi.deltaGood() === false',
    '[hidden]': 'kpi.delta() === null',
  },
  template: `<span aria-hidden="true">{{ glyph() }}</span> {{ kpi.formattedDelta() }}
             <span class="dash-kpi__delta-label">{{ label() }}</span>`,
})
export class DashKpiDelta {
  protected readonly kpi = injectKpi('dash-kpi-delta');
  readonly label = input('vs. previous period');   // local to this part only
  protected readonly glyph = computed(() => { const d = this.kpi.delta() ?? 0; return d > 0 ? '▲' : d < 0 ? '▼' : '■'; });
}
```

Text parts that accept rich content are just `template: '<ng-content />'` with a host class (`dash-kpi-caption`, `dash-kpi-label`).

## 4. Slot marker + swappable visuals

```ts
@Directive({ selector: '[dashKpiVisual]' })
export class DashKpiVisual {}

@Component({
  selector: 'dash-kpi-spark-bars',
  imports: [NgxEchartsDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div echarts [options]="option()"></div>`,
})
export class DashKpiSparkBars {
  private readonly kpi = injectKpi('dash-kpi-spark-bars');
  protected readonly option = computed(() => ({ /* bars from this.kpi.trend() */ }));
}
```

To make the marker implicit, add it as a host directive on each visual: `hostDirectives: [DashKpiVisual]` — then consumers write `<dash-kpi-spark-bars />` without the attribute, but `select="[dashKpiVisual]"` no longer matches (selection is by template attributes), so select by element names instead: `select="dash-kpi-sparkline, dash-kpi-spark-bars, dash-kpi-progress"`. Pick one approach and document it; the explicit attribute is more open to third-party visuals.

## 5. Preset

```ts
@Component({
  selector: 'dash-kpi-tile',
  imports: [DashKpi, DashKpiStatus, DashKpiValue, DashKpiDelta, DashKpiSparkline, DashKpiSparkBars, DashKpiVisual, DashKpiCaption],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <dash-kpi [label]="label()" [trend]="trend()" [value]="value()" [delta]="delta()" [upIsGood]="upIsGood()">
      <dash-kpi-label>{{ label() }}</dash-kpi-label>
      @if (status(); as s) { <dash-kpi-status [status]="s" /> }
      <dash-kpi-value />
      <dash-kpi-delta [label]="deltaLabel()" />
      @switch (visual()) {
        @case ('line') { <dash-kpi-sparkline dashKpiVisual /> }
        @case ('bars') { <dash-kpi-spark-bars dashKpiVisual /> }
      }
      @if (caption()) { <dash-kpi-caption>{{ caption() }}</dash-kpi-caption> }
    </dash-kpi>
  `,
})
export class DashKpiTile {
  readonly visual = input<'line' | 'bars' | 'none'>('line');
  // …same inputs as before, forwarded
}
```

The preset is allowed to use flags — it's the "configuration" layer on top of the "composition" layer. Keep it small; when a request doesn't fit it, the answer is "compose it", not "add another flag".

## 6. Container-query density

```css
.dash-kpi { container: dash-kpi / inline-size; }

/* Only when the host has a definite height (e.g. a board cell with height="fill"):
   `size` containment makes an auto-height element collapse to 0. */
.dash-kpi.dash-fill { container-type: size; }

@container dash-kpi (max-width: 200px) {
  .dash-kpi__value { font-size: 1.5rem; }
  .dash-kpi__delta-label { display: none; }
}
@container dash-kpi (max-height: 130px) {
  .dash-kpi__visual, dash-kpi-caption { display: none; }
}
```

Size queries measure the container's **content box** (minus padding and border), so derive thresholds from what the parts need — e.g. summary height + a readable visual — not from the outer tile size. Then check them against the real layouts the component ships in (board cells, grid rows): a threshold that's 10px too high silently hides the visual everywhere.

A container can't query itself — the rules apply to *descendants* of the element with `container-type`. Put interior styles on parts, not on the shell host.

Priority when space runs out: caption → visual → delta label → status word (keep icon) → shrink value. Label and value always stay.

## 7. Tests

```ts
it('derives delta from the last two trend points', () => {
  const fixture = TestBed.createComponent(DashKpi);
  fixture.componentRef.setInput('trend', [{ x: 1, y: 100 }, { x: 2, y: 110 }]);
  expect(fixture.componentInstance.delta()).toBeCloseTo(0.1);
});

it('explains misuse outside the shell', () => {
  expect(() => TestBed.createComponent(DashKpiDelta)).toThrow(/inside <dash-kpi>/);
});
```

For parts, test through a small host component that renders `<dash-kpi …><dash-kpi-delta /></dash-kpi>` so DI resolves the real context.
