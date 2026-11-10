import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  ViewEncapsulation,
  computed,
  contentChild,
  effect,
  forwardRef,
  inject,
  input,
  model,
  output,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { AgGridAngular } from 'ag-grid-angular';
import {
  CellClickedEvent,
  CellKeyDownEvent,
  ColDef,
  FullWidthCellKeyDownEvent,
  GetRowIdParams,
  GridApi,
  IsFullWidthRowParams,
  RowHeightParams,
  SuppressHeaderKeyboardEventParams,
} from 'ag-grid-community';
import { calendarGridModules, calendarGridTheme } from './calendar-grid.ag-grid';
import { DASH_CALENDAR_GRID, DashCalendarGridContext } from './calendar-grid.context';
import { DashCalendarRange, DashDayKey, formatDay, isMonday, shiftAnchor } from './calendar-grid.dates';
import {
  DASH_CALENDAR_RANGES,
  DashCalendarRangeOption,
  keepSelection,
  nearestDay,
  periodDays,
  periodTitle,
} from './calendar-grid.period';
import {
  DataEntry,
  GridEntry,
  GroupEntry,
  SortKey,
  SummaryEntry,
  buildEntries,
  compareEntries,
} from './calendar-grid.rows';
import {
  DashCalendarGridAside,
  DashCalendarGridDayCell,
  DashCalendarGridFooter,
  DashCalendarGridGroupHeading,
  DashCalendarGridRowHeader,
  DashCalendarGridSummaryCell,
  DashCalendarGridTotalCell,
} from './calendar-grid.slots';
import { DashCalendarGridDayCellRenderer } from './cells/day-cell';
import { DashCalendarGridDayHeader } from './cells/day-header';
import { DashCalendarGridGroupHeadingRenderer } from './cells/group-heading';
import { DayColumnParams, rendered } from './cells/rendered';
import { DashCalendarGridTemplateCell } from './cells/template-cell';

export interface DashCalendarGridCellEvent<T> {
  row: T;
  day: DashDayKey;
}

/** Below this width the total column stops being pinned and the label column narrows. */
const NARROW = 640;
const SUMMARY: SummaryEntry = { kind: 'summary', id: 'summary' };

/**
 * Rows against days, with calendar controls (previous, next, Today, period length), on AG Grid.
 * The caller decides what a row is and what each cell shows, through templates; optional regions
 * appear when their template or slot is given:
 *
 * - `ng-template [dashDayCell]` (required): one row on one day
 * - `ng-template [dashRowHeader]`: the pinned row label
 * - `ng-template dashSummaryCell`: adds a summary row pinned under the header
 * - `[total]` (+ `ng-template [dashTotalCell]`): adds a sortable total column
 * - `[groupBy]` (+ `ng-template dashGroupHeading`): groups rows under headings
 * - `[dashCalendarGridTools]`, `[dashCalendarGridFooter]`, `[dashCalendarGridAside]`: slots
 *
 * The grid responds to its own width: `@container dash-calendar-grid (…)` works in templates too.
 */
@Component({
  selector: 'dash-calendar-grid',
  imports: [AgGridAngular, MatButtonModule, MatButtonToggleModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  providers: [{ provide: DASH_CALENDAR_GRID, useExisting: forwardRef(() => DashCalendarGrid) }],
  host: {
    class: 'dash-calendar-grid',
    '[class.has-aside]': '!!aside()',
    '[class.is-narrow]': 'narrow()',
  },
  template: `
    <div class="dash-calendar-grid__layout">
      <section class="dash-calendar-grid__main" [attr.aria-label]="label()">
        <div class="dash-calendar-grid__toolbar">
          <div class="dash-calendar-grid__period">
            <button matIconButton type="button" aria-label="Previous period" (click)="shift(-1)">
              <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                <path d="M15.4 7.4 14 6l-6 6 6 6 1.4-1.4-4.6-4.6z" fill="currentColor" />
              </svg>
            </button>
            <button matIconButton type="button" aria-label="Next period" (click)="shift(1)">
              <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                <path d="M10 6 8.6 7.4l4.6 4.6-4.6 4.6L10 18l6-6z" fill="currentColor" />
              </svg>
            </button>
            <h2 class="dash-calendar-grid__title" aria-live="polite">{{ title() }}</h2>
            <button matButton="outlined" type="button" (click)="goToToday()">Today</button>
          </div>

          <div class="dash-calendar-grid__tools">
            <ng-content select="[dashCalendarGridTools]" />
            @if (ranges().length > 1) {
              <mat-button-toggle-group
                hideSingleSelectionIndicator
                aria-label="Period length"
                [value]="range()"
                (change)="range.set($event.value)"
              >
                @for (option of ranges(); track option.value) {
                  <mat-button-toggle [value]="option.value">{{ option.label }}</mat-button-toggle>
                }
              </mat-button-toggle-group>
            }
          </div>
        </div>

        <ag-grid-angular
          class="dash-calendar-grid__grid"
          [modules]="modules"
          [theme]="theme"
          [columnDefs]="columnDefs()"
          [defaultColDef]="defaultColDef"
          [rowData]="entries()"
          [pinnedTopRowData]="pinned()"
          [getRowId]="getRowId"
          [getRowHeight]="getRowHeight"
          [isFullWidthRow]="isFullWidthRow"
          [fullWidthCellRenderer]="groupRenderer"
          [fullWidthCellRendererParams]="groupRendererParams"
          [headerHeight]="52"
          domLayout="autoHeight"
          [suppressMultiSort]="true"
          [suppressMovableColumns]="true"
          [suppressColumnVirtualisation]="true"
          [ensureDomOrder]="true"
          [animateRows]="false"
          [overlayNoRowsTemplate]="noRows()"
          (gridReady)="onGridReady($event.api)"
          (cellClicked)="onCellClicked($event)"
          (cellKeyDown)="onCellKeyDown($event)"
        />

        @if (footer()) {
          <div class="dash-calendar-grid__footer">
            <ng-content select="[dashCalendarGridFooter]" />
          </div>
        }
      </section>

      <ng-content select="[dashCalendarGridAside]" />
    </div>
  `,
  styleUrl: './calendar-grid.css',
})
export class DashCalendarGrid<T> implements DashCalendarGridContext {
  // Rows
  readonly rows = input.required<readonly T[]>();
  readonly rowId = input.required<(row: T) => string>();
  /** Sorts the label column, and is its text when there is no `dashRowHeader` template. */
  readonly rowLabel = input.required<(row: T) => string>();
  readonly groupBy = input<((row: T) => string) | null>(null);
  readonly total = input<((row: T) => number) | null>(null);

  // Calendar
  readonly today = input.required<DashDayKey>();
  readonly range = model<DashCalendarRange>('month');
  readonly anchor = model.required<DashDayKey>();
  readonly selectedDay = model.required<DashDayKey>();
  /** The period lengths to offer. With one, the switch is hidden. */
  readonly ranges = input<readonly DashCalendarRangeOption[]>(DASH_CALENDAR_RANGES);
  readonly weekends = input(false);

  // Words
  /** The grid's accessible name. */
  readonly label = input.required<string>();
  readonly rowHeaderLabel = input('Name');
  readonly totalLabel = input('Total');
  readonly summaryLabel = input('');
  readonly summaryTotal = input('');
  readonly emptyMessage = input('Nothing to show.');

  // Sizes
  readonly rowHeight = input(40);
  readonly wideRowHeight = input(46);
  readonly rowHeaderWidth = input(212);

  /** A row's day was clicked, or Enter or Space was pressed on it. The day is also selected. */
  readonly cellActivated = output<DashCalendarGridCellEvent<T>>();

  private readonly dayCell = contentChild.required<DashCalendarGridDayCell<T>>(DashCalendarGridDayCell);
  private readonly rowHeader = contentChild<DashCalendarGridRowHeader<T>>(DashCalendarGridRowHeader);
  private readonly totalCell = contentChild<DashCalendarGridTotalCell<T>>(DashCalendarGridTotalCell);
  private readonly summaryCell = contentChild(DashCalendarGridSummaryCell);
  private readonly groupHeading = contentChild(DashCalendarGridGroupHeading);
  protected readonly footer = contentChild(DashCalendarGridFooter);
  protected readonly aside = contentChild(DashCalendarGridAside);

  private readonly api = signal<GridApi<GridEntry<T>> | null>(null);
  protected readonly narrow = signal(false);

  readonly days = computed(() => periodDays(this.anchor(), this.range(), this.weekends()));
  readonly wide = computed(() => this.days().length <= 7);
  protected readonly title = computed(() =>
    periodTitle(this.anchor(), this.range(), this.weekends()),
  );

  protected readonly entries = computed(() =>
    buildEntries(this.rows(), {
      rowId: this.rowId(),
      rowLabel: this.rowLabel(),
      groupBy: this.groupBy(),
    }),
  );

  protected readonly pinned = computed(() => (this.summaryCell() ? [SUMMARY] : []));

  protected readonly columnDefs = computed<ColDef<GridEntry<T>>[]>(() => {
    const narrow = this.narrow();
    const wide = this.wide();
    const label = this.rowLabel();
    const total = this.total();

    const columns: ColDef<GridEntry<T>>[] = [
      {
        colId: 'label',
        headerName: this.rowHeaderLabel(),
        pinned: 'left',
        width: narrow ? Math.round(this.rowHeaderWidth() * 0.62) : this.rowHeaderWidth(),
        sortable: true,
        initialSort: 'asc',
        sortingOrder: ['asc', 'desc'],
        comparator: this.comparator(label),
        cellClass: 'label-col',
        headerClass: 'label-col',
        cellRenderer: DashCalendarGridTemplateCell,
        cellRendererParams: {
          render: (entry: GridEntry<T>) =>
            entry.kind === 'row'
              ? rendered(this.rowHeader()?.template, { $implicit: entry.row })
              : null,
        },
        valueGetter: ({ data }) =>
          data?.kind === 'row' ? label(data.row) : data?.kind === 'summary' ? this.summaryLabel() : '',
      },
      ...this.days().map((day, i): ColDef<GridEntry<T>> => {
        const params: DayColumnParams = { day, weekStart: i > 0 && isMonday(day) };
        const gap = params.weekStart ? 6 : 0;
        return {
          colId: day,
          headerName: formatDay(day, 'EEEE d MMMM'),
          // A week stretches to fill the grid; longer periods stay compact.
          ...(wide ? { flex: 1, minWidth: 124 + gap } : { width: 32 + gap }),
          headerComponent: DashCalendarGridDayHeader,
          headerComponentParams: params,
          headerClass: 'day-col',
          cellRenderer: DashCalendarGridDayCellRenderer,
          cellRendererParams: {
            ...params,
            dayTemplate: () => this.dayCell().template,
            summaryTemplate: () => this.summaryCell()?.template,
          },
          cellClass: 'day-col',
          suppressHeaderKeyboardEvent: (p) => this.onHeaderKey(p, day),
        };
      }),
    ];

    if (total) {
      columns.push({
        colId: 'total',
        headerName: this.totalLabel(),
        pinned: narrow ? null : 'right',
        width: 100,
        sortable: true,
        sortingOrder: ['asc', 'desc'],
        comparator: this.comparator(total),
        type: 'rightAligned',
        cellClass: 'total-col',
        headerClass: 'total-col',
        cellRenderer: DashCalendarGridTemplateCell,
        cellRendererParams: {
          render: (entry: GridEntry<T>, value: unknown) =>
            entry.kind === 'row'
              ? rendered(this.totalCell()?.template, { $implicit: entry.row, value: value as number })
              : null,
        },
        valueGetter: ({ data }) =>
          data?.kind === 'row' ? total(data.row) : data?.kind === 'summary' ? this.summaryTotal() : '',
      });
    }
    return columns;
  });

  // Grid configuration. Callbacks are arrow properties, so their references stay stable.
  protected readonly modules = calendarGridModules;
  protected readonly theme = calendarGridTheme;
  protected readonly groupRenderer = DashCalendarGridGroupHeadingRenderer;
  protected readonly groupRendererParams = { template: () => this.groupHeading()?.template };
  protected readonly noRows = computed(
    () => `<span class="dash-calendar-grid__empty">${escapeHtml(this.emptyMessage())}</span>`,
  );
  protected readonly defaultColDef: ColDef<GridEntry<T>> = {
    sortable: false,
    resizable: false,
    suppressMovable: true,
    suppressHeaderMenuButton: true,
    suppressHeaderContextMenu: true,
  };

  protected readonly getRowId = ({ data }: GetRowIdParams<GridEntry<T>>) => data.id;

  protected readonly isFullWidthRow = ({ rowNode }: IsFullWidthRowParams<GridEntry<T>>) =>
    rowNode.data?.kind === 'group';

  protected readonly getRowHeight = ({ data }: RowHeightParams<GridEntry<T>>) =>
    data?.kind === 'row' ? (this.wide() ? this.wideRowHeight() : this.rowHeight()) : 28;

  constructor() {
    // Row heights are cached per row, and they depend on the period length.
    effect(() => {
      this.wide();
      this.rowHeight();
      this.wideRowHeight();
      this.api()?.resetRowHeights();
    });
    this.observeWidth();
  }

  select(day: DashDayKey): void {
    this.selectedDay.set(day);
  }

  protected shift(direction: 1 | -1): void {
    const anchor = shiftAnchor(this.anchor(), this.range(), direction);
    this.anchor.set(anchor);
    const days = periodDays(anchor, this.range(), this.weekends());
    this.selectedDay.set(keepSelection(days, this.selectedDay(), this.today()));
  }

  protected goToToday(): void {
    this.anchor.set(this.today());
    this.selectedDay.set(nearestDay(this.days(), this.today()));
  }

  protected onGridReady(api: GridApi<GridEntry<T>>): void {
    this.api.set(api);
  }

  protected onCellClicked({ colDef, data }: CellClickedEvent<GridEntry<T>>): void {
    this.activate(colDef, data);
  }

  protected onCellKeyDown(
    event: CellKeyDownEvent<GridEntry<T>> | FullWidthCellKeyDownEvent<GridEntry<T>>,
  ): void {
    const key = event.event as KeyboardEvent | undefined;
    if (!key || !('colDef' in event) || !isActivation(key)) return;
    if (this.activate(event.colDef, event.data)) key.preventDefault();
  }

  private activate(colDef: ColDef<GridEntry<T>>, entry: GridEntry<T> | undefined): boolean {
    const day = (colDef.cellRendererParams as DayColumnParams | undefined)?.day;
    if (!day) return false;
    this.select(day);
    if (entry?.kind === 'row') this.cellActivated.emit({ row: entry.row, day });
    return true;
  }

  private onHeaderKey(
    { event }: SuppressHeaderKeyboardEventParams<GridEntry<T>>,
    day: DashDayKey,
  ): boolean {
    if (event.type !== 'keydown' || !isActivation(event)) return false;
    event.preventDefault();
    this.select(day);
    return true;
  }

  /** Pinned rows are never sorted, so only rows and group headings arrive here. */
  private comparator(key: SortKey<T>): ColDef<GridEntry<T>>['comparator'] {
    return (_a, _b, nodeA, nodeB, descending) =>
      compareEntries(
        nodeA.data as DataEntry<T> | GroupEntry,
        nodeB.data as DataEntry<T> | GroupEntry,
        key,
        this.rowLabel(),
        descending,
      );
  }

  /** The grid adapts to its own width, not the screen's, so it works in any layout. */
  private observeWidth(): void {
    if (typeof ResizeObserver === 'undefined') return;
    const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    // Only crossing the threshold changes the signal, so most resizes change nothing.
    const observer = new ResizeObserver(([entry]) =>
      this.narrow.set(entry.contentRect.width < NARROW),
    );
    observer.observe(host);
    inject(DestroyRef).onDestroy(() => observer.disconnect());
  }
}

function isActivation(event: KeyboardEvent): boolean {
  return event.key === 'Enter' || event.key === ' ';
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}
