import { ChangeDetectionStrategy, Component, DOCUMENT, computed, contentChild, inject, input, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { DASH_CHART } from '../core/chart-base';
import { csvCell } from '../core/format';
import { DashDataTable } from '../data-table/data-table';

/**
 * Material card that frames a chart: heading, optional controls, loading bar, and a menu to
 * switch to a table view or download the chart as PNG / CSV.
 *
 * ```html
 * <dash-chart-card heading="Weekly shipments" subheading="Last 26 weeks">
 *   <mat-button-toggle-group dashCardActions>…</mat-button-toggle-group>
 *   <dash-trend-chart [series]="series" />
 * </dash-chart-card>
 * ```
 */
@Component({
  selector: 'dash-chart-card',
  imports: [MatButtonModule, MatMenuModule, MatProgressBarModule, DashDataTable],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { role: 'region', '[attr.aria-label]': 'heading()' },
  template: `
    @if (loading()) {
      <mat-progress-bar class="bar" mode="indeterminate" aria-label="Loading" />
    }
    <header class="head">
      <div class="titles">
        <h2 class="heading">{{ heading() }}</h2>
        @if (subheading()) {
          <p class="subheading">{{ subheading() }}</p>
        }
      </div>
      <div class="actions">
        <ng-content select="[dashCardActions]" />
        @if (menu()) {
          <button matIconButton type="button" class="more" [matMenuTriggerFor]="cardMenu" aria-label="Chart options">
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
              <circle cx="12" cy="5" r="1.8" fill="currentColor" />
              <circle cx="12" cy="12" r="1.8" fill="currentColor" />
              <circle cx="12" cy="19" r="1.8" fill="currentColor" />
            </svg>
          </button>
          <mat-menu #cardMenu="matMenu" xPosition="before">
            <button mat-menu-item type="button" [disabled]="!chart()" (click)="tableView.set(!tableView())">
              {{ tableView() ? 'Show chart' : 'Show as table' }}
            </button>
            <button mat-menu-item type="button" [disabled]="!chart() || tableView()" (click)="downloadPng()">Download PNG</button>
            <button mat-menu-item type="button" [disabled]="!chart()" (click)="downloadCsv()">Download CSV</button>
          </mat-menu>
        }
      </div>
    </header>
    <div class="body" [class.is-hidden]="tableView()">
      <ng-content />
    </div>
    @if (tableView() && chart(); as c) {
      <dash-data-table class="table" [data]="c.tableData()" [caption]="heading()" />
    }
    <ng-content select="[dashCardFooter]" />
  `,
  styles: `
    :host {
      position: relative;
      display: flex;
      flex-direction: column;
      gap: 12px;
      min-width: 0;
      padding: 18px 20px 16px;
      overflow: hidden;
      border: 1px solid var(--dash-border, rgba(21, 32, 43, 0.12));
      border-radius: 16px;
      background: var(--dash-surface, #fbfcfc);
      color: var(--dash-ink, #15202b);
      font-family: var(--dash-font, system-ui, sans-serif);
    }
    .bar { position: absolute; top: 0; left: 0; right: 0; }
    .head { display: flex; align-items: flex-start; gap: 12px; flex-wrap: wrap; }
    .titles { flex: 1 1 200px; min-width: 0; }
    .heading { margin: 0; font-size: 1.0625rem; line-height: 1.4; font-weight: 600; }
    .subheading { margin: 2px 0 0; color: var(--dash-ink-2, #4d5a66); font-size: 0.8125rem; line-height: 1.4; }
    .actions { display: flex; align-items: center; gap: 8px; margin: -6px -10px -6px 0; }
    .more { color: var(--dash-ink-2, #4d5a66); }
    .body { flex: 1 1 auto; min-height: 0; }
    .body.is-hidden { display: none; }
    .table { flex: 1 1 auto; min-height: 0; }
  `,
})
export class DashChartCard {
  private readonly document = inject(DOCUMENT);

  readonly heading = input.required<string>();
  readonly subheading = input('');
  /** Shows an indeterminate bar along the top edge. */
  readonly loading = input(false);
  /** Shows the table / PNG / CSV menu (when the card contains a dash chart). */
  readonly menu = input(true);

  protected readonly chart = contentChild(DASH_CHART, { descendants: true });
  protected readonly tableView = signal(false);
  private readonly fileName = computed(() =>
    (this.heading() || 'chart').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
  );

  protected downloadPng(): void {
    const url = this.chart()?.exportImage();
    if (url) this.download(url, `${this.fileName()}.png`);
  }

  protected downloadCsv(): void {
    const data = this.chart()?.tableData();
    if (!data) return;
    const lines = [
      data.columns.map((c) => csvCell(c.label)).join(','),
      ...data.rows.map((r) => data.columns.map((c) => csvCell(r[c.key] ?? null)).join(',')),
    ];
    const url = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' }));
    this.download(url, `${this.fileName()}.csv`);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  private download(href: string, name: string): void {
    const a = this.document.createElement('a');
    a.href = href;
    a.download = name;
    a.click();
  }
}
