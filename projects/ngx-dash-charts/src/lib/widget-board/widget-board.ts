import {
  ChangeDetectionStrategy,
  afterNextRender,
  Component,
  Directive,
  ElementRef,
  Injector,
  OnInit,
  TemplateRef,
  ViewEncapsulation,
  computed,
  contentChildren,
  effect,
  inject,
  input,
  model,
  signal,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { Gridster, GridsterItem, type GridsterConfig, type GridsterItemConfig } from 'angular-gridster2';
import {
  DASH_BOARD_COLUMNS,
  DASH_WIDGET_LIMITS,
  type DashMoveDirection,
  type DashWidgetLayout,
  isCompatibleLayout,
  moveWidget,
  normalizeLayout,
  readingOrder,
} from './layout';

/** Declares the content of one widget: `<ng-template dashWidget="trend" dashWidgetLabel="Weekly shipments">`. */
@Directive({ selector: 'ng-template[dashWidget]' })
export class DashWidget {
  readonly id = input.required<string>({ alias: 'dashWidget' });
  /** Name used by the edit-mode handle and screen-reader announcements. */
  readonly label = input('', { alias: 'dashWidgetLabel' });
  readonly template = inject(TemplateRef);
}

type BoardItem = GridsterItemConfig & DashWidgetLayout;

const DIRECTIONS: { dir: DashMoveDirection; label: string }[] = [
  { dir: 'up', label: 'Move up' },
  { dir: 'down', label: 'Move down' },
  { dir: 'left', label: 'Move left' },
  { dir: 'right', label: 'Move right' },
];

const KEY_TO_DIRECTION: Record<string, DashMoveDirection> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
};

/**
 * Drag-and-drop dashboard board (angular-gridster2 underneath). One unit is one KPI tile and the
 * board is four units wide. KPI tiles are 1×1, charts 2 wide and 2–3 tall, wide widgets span the
 * board. A drop that needs room the target row doesn't have is refused; same-sized widgets swap.
 *
 * Outside `editing`, widgets behave normally (hover, click, drill down). In `editing`, each widget
 * becomes a drag handle, charts can be resized in height, and arrow keys or the widget menu move
 * the focused widget.
 */
@Component({
  selector: 'dash-widget-board',
  imports: [Gridster, GridsterItem, NgTemplateOutlet, MatButtonModule, MatMenuModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  template: `
    <gridster class="dash-board" [class.is-editing]="editing()" [options]="options()">
      @for (item of items(); track item.id) {
        <gridster-item class="dash-board__cell" [class.is-editing]="editing()" [item]="item">
          <div class="dash-board__content" [attr.inert]="editing() ? '' : null">
            @if (templateFor(item.id); as tpl) {
              <ng-container *ngTemplateOutlet="tpl" />
            }
          </div>
          @if (editing()) {
            <div
              class="dash-board__chrome dash-drag-handle"
              tabindex="0"
              role="button"
              [attr.data-widget-id]="item.id"
              aria-roledescription="draggable widget"
              [attr.aria-label]="labelFor(item.id) + ', row ' + (item.y + 1) + ', column ' + (item.x + 1) + '. Drag, or use the arrow keys, to move.'"
              (keydown)="onKeydown($event, item.id)"
            >
              <span class="dash-board__badge">
                <svg viewBox="0 0 12 16" width="10" height="14" aria-hidden="true">
                  <circle cx="3" cy="3" r="1.4" /><circle cx="9" cy="3" r="1.4" />
                  <circle cx="3" cy="8" r="1.4" /><circle cx="9" cy="8" r="1.4" />
                  <circle cx="3" cy="13" r="1.4" /><circle cx="9" cy="13" r="1.4" />
                </svg>
                <span class="dash-board__name">{{ labelFor(item.id) }}</span>
                <span class="dash-board__size">{{ item.cols }} × {{ item.rows }}</span>
              </span>
              <button
                matIconButton
                type="button"
                class="dash-board__menu"
                [matMenuTriggerFor]="moveMenu"
                [attr.aria-label]="'Move ' + labelFor(item.id)"
                (mousedown)="$event.stopPropagation()"
                (touchstart)="$event.stopPropagation()"
              >
                <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                  <path d="M12 3l3 3h-2v4h4V8l3 3-3 3v-2h-4v4h2l-3 3-3-3h2v-4H7v2l-3-3 3-3v2h4V6H9z" fill="currentColor" />
                </svg>
              </button>
              <mat-menu #moveMenu="matMenu" xPosition="before">
                @for (d of directions; track d.dir) {
                  <button mat-menu-item type="button" [disabled]="!canMove(item.id, d.dir)" (click)="move(item.id, d.dir)">
                    {{ d.label }}
                  </button>
                }
              </mat-menu>
            </div>
          }
        </gridster-item>
      }
    </gridster>
    <p class="dash-sr-only" aria-live="polite">{{ announcement() }}</p>
  `,
  styleUrl: './widget-board.css',
})
export class DashWidgetBoard implements OnInit {
  /** Widget positions and sizes. Two-way bindable: `[(layout)]`. */
  readonly layout = model.required<DashWidgetLayout[]>();
  readonly editing = input(false);
  /** Height of one row unit in pixels — a KPI tile's height. */
  readonly rowHeight = input(160);
  readonly gap = input(16);
  /** Below this board width, widgets stack in one column and dragging is off. */
  readonly stackBelow = input(640);
  /** When set, the layout is saved to and restored from localStorage under this key. */
  readonly persistKey = input<string | null>(null);

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  protected readonly directions = DIRECTIONS;
  protected readonly announcement = signal('');
  private readonly widgets = contentChildren(DashWidget);
  private readonly templates = computed(() => new Map(this.widgets().map((w) => [w.id(), w])));
  private syncQueued = false;

  /** Gridster mutates these objects in place while dragging; `sync()` copies them back to `layout`. */
  protected readonly items = computed<BoardItem[]>(() => {
    const editing = this.editing();
    return readingOrder(normalizeLayout(this.layout())).map((l) => {
      const limits = DASH_WIDGET_LIMITS[l.kind];
      return {
        ...l,
        minItemCols: limits.minCols,
        maxItemCols: limits.maxCols,
        minItemRows: limits.minRows,
        maxItemRows: limits.maxRows,
        dragEnabled: editing,
        resizeEnabled: editing && limits.minRows !== limits.maxRows,
      };
    });
  });

  protected readonly options = computed<GridsterConfig>(() => {
    const editing = this.editing();
    return {
      gridType: 'verticalFixed',
      fixedRowHeight: this.rowHeight(),
      keepFixedHeightInMobile: true,
      mobileBreakpoint: this.stackBelow(),
      setGridSize: true,
      minCols: DASH_BOARD_COLUMNS,
      maxCols: DASH_BOARD_COLUMNS,
      minRows: 1,
      maxRows: 200,
      margin: this.gap(),
      outerMargin: false,
      compactType: 'compactUp',
      // No pushing: a widget only lands where it fits. Same-sized widgets swap.
      pushItems: false,
      swap: true,
      swapWhileDragging: false,
      displayGrid: editing ? 'onDrag&Resize' : 'none',
      disableWarnings: true,
      draggable: { enabled: editing, ignoreContent: true, dragHandleClass: 'dash-drag-handle' },
      resizable: {
        enabled: editing,
        handles: { s: true, e: false, n: false, w: false, se: false, ne: false, sw: false, nw: false },
      },
      itemChangeCallback: () => this.queueSync(),
    };
  });

  constructor() {
    effect(() => {
      const key = this.persistKey();
      const layout = this.layout();
      if (!key) return;
      try {
        localStorage.setItem(key, JSON.stringify(layout));
      } catch {
        // Storage unavailable (private mode, quota): the board still works for this visit.
      }
    });
  }

  ngOnInit(): void {
    const key = this.persistKey();
    if (!key) return;
    try {
      const stored = JSON.parse(localStorage.getItem(key) ?? 'null');
      if (isCompatibleLayout(stored, this.layout())) this.layout.set(stored);
    } catch {
      // Unreadable or corrupt entry — keep the host's default layout.
    }
  }

  protected templateFor(id: string): TemplateRef<unknown> | null {
    return this.templates().get(id)?.template ?? null;
  }

  protected labelFor(id: string): string {
    return this.templates().get(id)?.label() || id;
  }

  protected canMove(id: string, dir: DashMoveDirection): boolean {
    return moveWidget(this.layout(), id, dir) !== null;
  }

  protected move(id: string, dir: DashMoveDirection): void {
    const next = moveWidget(this.layout(), id, dir);
    const name = this.labelFor(id);
    if (!next) {
      this.announcement.set(`Can't move ${name} ${dir}: there is no room for it there.`);
      return;
    }
    this.layout.set(next);
    const placed = next.find((i) => i.id === id)!;
    this.announcement.set(`Moved ${name} to row ${placed.y + 1}, column ${placed.x + 1}.`);
    // Widgets render in reading order, so the moved one may change DOM position and lose focus.
    afterNextRender(
      () => {
        const handle = this.host.nativeElement.querySelector<HTMLElement>(`[data-widget-id="${CSS.escape(id)}"]`);
        handle?.focus({ preventScroll: true });
        handle?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      },
      { injector: this.injector },
    );
  }

  protected onKeydown(e: KeyboardEvent, id: string): void {
    const dir = KEY_TO_DIRECTION[e.key];
    if (!dir || e.target !== e.currentTarget) return;
    e.preventDefault();
    this.move(id, dir);
  }

  /** Gridster reports each moved widget separately (including compaction); emit one layout. */
  private queueSync(): void {
    if (this.syncQueued) return;
    this.syncQueued = true;
    queueMicrotask(() => {
      this.syncQueued = false;
      const next = this.items().map(({ id, kind, x, y, cols, rows }) => ({ id, kind, x, y, cols, rows }));
      const current = this.layout();
      const changed = next.some((n) => {
        const c = current.find((i) => i.id === n.id);
        return !c || c.x !== n.x || c.y !== n.y || c.cols !== n.cols || c.rows !== n.rows;
      });
      if (changed) this.layout.set(next);
    });
  }
}
