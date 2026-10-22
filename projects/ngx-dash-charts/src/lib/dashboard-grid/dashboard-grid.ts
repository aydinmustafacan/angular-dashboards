import { ChangeDetectionStrategy, Component, Directive, ViewEncapsulation, input } from '@angular/core';

/**
 * 12-column responsive grid for dashboard layouts. Children set their width with `dashSpan`
 * (and optionally `dashSpanMd` for medium containers); on narrow containers every child spans
 * the full row. Breakpoints follow the grid's own width, not the viewport.
 */
@Component({
  selector: 'dash-grid',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: { '[style.--dash-grid-gap]': 'gap()' },
  template: '<ng-content />',
  styles: `
    dash-grid {
      display: grid;
      grid-template-columns: repeat(12, minmax(0, 1fr));
      gap: var(--dash-grid-gap, 16px);
      container-type: inline-size;
    }
    dash-grid > * {
      grid-column: span 12;
      min-width: 0;
    }
    dash-grid > .dash-grid-item {
      grid-column: span var(--dash-span, 12);
    }
    @container (max-width: 1023px) {
      dash-grid > .dash-grid-item {
        grid-column: span var(--dash-span-md, 12);
      }
    }
    @container (max-width: 639px) {
      dash-grid > .dash-grid-item {
        grid-column: span 12;
      }
    }
  `,
})
export class DashGrid {
  readonly gap = input('16px');
}

/** Number of the 12 grid columns this child spans on wide containers (≥ 1024px). */
@Directive({
  selector: '[dashSpan]',
  host: {
    class: 'dash-grid-item',
    '[style.--dash-span]': 'dashSpan()',
    '[style.--dash-span-md]': 'dashSpanMd() ?? (dashSpan() <= 6 ? 6 : 12)',
  },
})
export class DashSpan {
  readonly dashSpan = input(12);
  /** Span between 640px and 1023px. Defaults to half for items up to half width, else full. */
  readonly dashSpanMd = input<number | undefined>(undefined);
}
