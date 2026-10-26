import { Component, computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { DashDatum, DashPointEvent } from '../core/types';
import { injectKpi } from './kpi-base';
import { DashKpi } from './kpi';
import { DashKpiCaption, DashKpiSummary, DashKpiVisual } from './kpi-parts';
import { DashKpiTile } from './kpi-tile';

// jsdom has no matchMedia; the theme service listens for colour-scheme changes with it.
beforeAll(() => {
  window.matchMedia ??= ((query: string) =>
    ({ matches: false, media: query, addEventListener() {}, removeEventListener() {} }) as unknown as MediaQueryList);
});

const weeks: DashDatum[] = [
  { x: '2026-09-28', y: 100 },
  { x: '2026-10-05', y: 120 },
  { x: '2026-10-12', y: 90 },
];

/** A custom visual: proves anything marked dashKpiVisual can read the shared data. */
@Component({
  selector: 'test-points',
  template: '{{ kpi.trend().length }} points, last {{ kpi.formattedValue() }}',
})
class TestPoints {
  protected readonly kpi = injectKpi('test-points');
}

@Component({
  imports: [DashKpi, DashKpiCaption, DashKpiVisual, TestPoints],
  template: `
    <dash-kpi label="Claims" [trend]="trend()" [upIsGood]="upIsGood()" [value]="value()" [clickable]="true" (pointClick)="clicked = $event">
      <test-points dashKpiVisual />
      <dash-kpi-caption>Target <strong>80</strong></dash-kpi-caption>
    </dash-kpi>
  `,
})
class ComposedHost {
  readonly trend = signal(weeks);
  readonly upIsGood = signal(true);
  readonly value = signal<number | undefined>(undefined);
  clicked: DashPointEvent | null = null;
}

function render<T>(type: new () => T) {
  const fixture = TestBed.createComponent(type);
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  return { fixture, el, text: (sel: string) => el.querySelector(sel)?.textContent?.replace(/\s+/g, ' ').trim() ?? null };
}

describe('dash-kpi', () => {
  it('derives the value and delta from the last two trend points', () => {
    const { text } = render(ComposedHost);
    expect(text('.dash-kpi__value')).toBe('90');
    expect(text('.dash-kpi__delta')).toContain('25');
    expect(text('.dash-kpi__delta')).toContain('▼');
  });

  it('colours a fall as good news when upIsGood is false', () => {
    const { fixture, el } = render(ComposedHost);
    expect(el.querySelector('.dash-kpi__delta')!.classList).toContain('is-bad');
    fixture.componentInstance.upIsGood.set(false);
    fixture.detectChanges();
    expect(el.querySelector('.dash-kpi__delta')!.classList).toContain('is-good');
  });

  it('prefers an explicit value over the trend', () => {
    const { fixture, text } = render(ComposedHost);
    fixture.componentInstance.value.set(42);
    fixture.detectChanges();
    expect(text('.dash-kpi__value')).toBe('42');
  });

  it('places a custom visual in the visual slot and shares the data with it', () => {
    const { el, text } = render(ComposedHost);
    const visual = el.querySelector('test-points')!;
    expect(visual.classList).toContain('dash-kpi__visual');
    expect(text('test-points')).toBe('3 points, last 90');
    expect(visual.nextElementSibling?.tagName.toLowerCase()).toBe('dash-kpi-caption');
    expect(el.querySelector('dash-kpi-caption strong')?.textContent).toBe('80');
  });

  it('drills into the latest period when the tile is clicked', () => {
    const { fixture, el } = render(ComposedHost);
    (el.querySelector('dash-kpi') as HTMLElement).click();
    expect(fixture.componentInstance.clicked?.index).toBe(2);
    expect(fixture.componentInstance.clicked?.series?.delta).toBeCloseTo(-0.25);
  });

  it('builds its accessible name from the summary, whatever parts are present', () => {
    const { el } = render(ComposedHost);
    expect(el.querySelector('dash-kpi')!.getAttribute('aria-label')).toMatch(/^Claims, 90, .*25.*vs\. previous week$/);
  });

  it('explains when a part is used outside a KPI', () => {
    expect(() => TestBed.createComponent(DashKpiSummary)).toThrow(/inside <dash-kpi> or <dash-kpi-tile>/);
  });
});

@Component({
  imports: [DashKpiTile],
  template: `<dash-kpi-tile label="Shipments" [trend]="trend" [visual]="visual()" caption="Target 95%" />`,
})
class PresetHost {
  readonly trend = weeks;
  readonly visual = signal<'line' | 'bars' | 'none'>('none');
}

describe('dash-kpi-tile', () => {
  it('can leave the visual out and still show the numbers and caption', () => {
    const { el, text } = render(PresetHost);
    expect(el.querySelector('.dash-kpi__visual')).toBeNull();
    expect(text('.dash-kpi__value')).toBe('90');
    expect(text('.dash-kpi__caption')).toBe('Target 95%');
  });

  it('still exposes its trend as table data for dash-chart-card', () => {
    const fixture = TestBed.createComponent(DashKpiTile);
    fixture.componentRef.setInput('label', 'Shipments');
    fixture.componentRef.setInput('trend', weeks);
    fixture.componentRef.setInput('visual', 'none');
    const rows = computed(() => fixture.componentInstance.tableData().rows);
    expect(rows().length).toBe(3);
    expect(rows()[2]['y']).toBe('90');
  });
});
