import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export interface DashStat {
  label: string;
  value: string;
  /** Secondary line, e.g. "▲ 4.2% vs. previous week". */
  detail?: string;
  tone?: 'good' | 'bad' | null;
}

/** Compact facts grid for drill-down panels and card footers. */
@Component({
  selector: 'dash-stat-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[style.--dash-stat-columns]': 'columns()' },
  template: `
    <dl>
      @for (item of items(); track item.label) {
        <div class="stat">
          <dt>{{ item.label }}</dt>
          <dd class="value">{{ item.value }}</dd>
          @if (item.detail) {
            <dd class="detail" [class.is-good]="item.tone === 'good'" [class.is-bad]="item.tone === 'bad'">{{ item.detail }}</dd>
          }
        </div>
      }
    </dl>
  `,
  styles: `
    :host { display: block; font-family: var(--dash-font, system-ui, sans-serif); }
    dl {
      display: grid;
      grid-template-columns: repeat(var(--dash-stat-columns, 2), minmax(0, 1fr));
      gap: 1px;
      margin: 0;
      overflow: hidden;
      border: 1px solid var(--dash-grid, #e3e7ea);
      border-radius: 12px;
      background: var(--dash-grid, #e3e7ea);
    }
    .stat { padding: 12px 14px; background: var(--dash-surface, #fbfcfc); min-width: 0; }
    /* A lone item in the last row stretches across instead of leaving an empty cell. */
    :host([style*='--dash-stat-columns: 2']) .stat:last-child:nth-child(odd) { grid-column: 1 / -1; }
    dt { color: var(--dash-ink-2, #4d5a66); font-size: 0.8125rem; }
    dd { margin: 0; }
    .value { margin-top: 2px; color: var(--dash-ink, #15202b); font-size: 1.25rem; font-weight: 600; line-height: 1.3; }
    .detail { color: var(--dash-ink-2, #4d5a66); font-size: 0.75rem; }
    .detail.is-good { color: var(--dash-good-text, #006300); }
    .detail.is-bad { color: var(--dash-bad-text, #b42828); }
  `,
})
export class DashStatList {
  readonly items = input<DashStat[]>([]);
  readonly columns = input(2);
}
