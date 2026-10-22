import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { DashTableData } from '../core/types';

/** Plain, accessible table view of a chart's data. Used by `dash-chart-card`; usable on its own. */
@Component({
  selector: 'dash-data-table',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="wrap" [style.max-height]="maxHeight()" tabindex="0" [attr.aria-label]="caption() || null" role="region">
      <table>
        @if (caption()) {
          <caption>{{ caption() }}</caption>
        }
        <thead>
          <tr>
            @for (col of data().columns; track col.key) {
              <th scope="col" [class.num]="col.numeric">{{ col.label }}</th>
            }
          </tr>
        </thead>
        <tbody>
          @for (row of data().rows; track $index) {
            <tr>
              @for (col of data().columns; track col.key; let first = $first) {
                @if (first) {
                  <th scope="row">{{ row[col.key] }}</th>
                } @else {
                  <td [class.num]="col.numeric">{{ row[col.key] ?? '–' }}</td>
                }
              }
            </tr>
          }
        </tbody>
      </table>
    </div>
  `,
  styles: `
    :host { display: block; font-family: var(--dash-font, system-ui, sans-serif); }
    .wrap { overflow: auto; border-radius: 8px; outline: none; }
    .wrap:focus-visible { outline: 2px solid var(--dash-accent, #1d4f91); outline-offset: 2px; }
    table { width: 100%; border-collapse: collapse; font-size: 0.875rem; color: var(--dash-ink, #15202b); }
    caption { text-align: left; padding-bottom: 8px; color: var(--dash-ink-2, #4d5a66); }
    th, td { padding: 7px 12px; text-align: left; border-bottom: 1px solid var(--dash-grid, #e3e7ea); white-space: nowrap; }
    thead th {
      position: sticky; top: 0; z-index: 1;
      background: var(--dash-surface, #fbfcfc);
      color: var(--dash-ink-2, #4d5a66);
      font-weight: 500;
      border-bottom-color: var(--dash-baseline, #c2c9cf);
    }
    tbody th { font-weight: 500; }
    .num { text-align: right; font-variant-numeric: tabular-nums; }
    tbody tr:hover { background: color-mix(in srgb, var(--dash-ink, #15202b) 4%, transparent); }
  `,
})
export class DashDataTable {
  readonly data = input.required<DashTableData>();
  readonly caption = input('');
  readonly maxHeight = input('360px');
}
