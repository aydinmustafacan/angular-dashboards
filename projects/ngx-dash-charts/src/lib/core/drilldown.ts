import {
  ChangeDetectionStrategy,
  Component,
  Injectable,
  TemplateRef,
  ViewEncapsulation,
  inject,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { DashDrillContext } from './types';

export type DashDrilldownMode = 'sheet' | 'dialog';

/** Template context for drill-down panels: `<ng-template let-ctx let-close="close">`. */
export interface DashDrillTemplateContext<T = DashDrillContext> {
  $implicit: T;
  close: () => void;
}

export interface DashDrillOptions<T = DashDrillContext> {
  template: TemplateRef<DashDrillTemplateContext<T>>;
  context: T;
  title: string;
  subtitle?: string;
  mode?: DashDrilldownMode;
}

let nextId = 0;

@Component({
  selector: 'dash-drill-sheet',
  imports: [NgTemplateOutlet, MatButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  template: `
    <header class="dash-drill__head">
      <div class="dash-drill__titles">
        <h2 class="dash-drill__title" [id]="titleId">{{ data.title }}</h2>
        @if (data.subtitle) {
          <p class="dash-drill__subtitle">{{ data.subtitle }}</p>
        }
      </div>
      <button matIconButton type="button" class="dash-drill__close" aria-label="Close details" (click)="close()">
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
          <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none" />
        </svg>
      </button>
    </header>
    <div class="dash-drill__body">
      <ng-container *ngTemplateOutlet="data.template; context: { $implicit: data.context, close: close }" />
    </div>
  `,
  styles: `
    .dash-drill-panel .mat-mdc-dialog-surface {
      display: flex;
      flex-direction: column;
      background: var(--dash-surface, #fbfcfc);
      color: var(--dash-ink, #15202b);
      font-family: var(--dash-font, inherit);
    }
    .dash-drill-panel--sheet .mat-mdc-dialog-surface {
      border-radius: 16px 0 0 16px;
      animation: dash-sheet-in 240ms cubic-bezier(0.2, 0, 0, 1);
    }
    @keyframes dash-sheet-in {
      from { transform: translateX(24px); opacity: 0; }
    }
    @media (prefers-reduced-motion: reduce) {
      .dash-drill-panel--sheet .mat-mdc-dialog-surface { animation: none; }
    }
    dash-drill-sheet { display: flex; flex-direction: column; min-height: 0; flex: 1; }
    .dash-drill__head {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 20px 12px 16px 24px;
      border-bottom: 1px solid var(--dash-grid, #e3e7ea);
    }
    .dash-drill__titles { flex: 1; min-width: 0; }
    .dash-drill__title { margin: 0; font-size: 1.375rem; line-height: 1.75rem; font-weight: 600; }
    .dash-drill__subtitle { margin: 2px 0 0; color: var(--dash-ink-2, #4d5a66); font-size: 0.875rem; }
    .dash-drill__close { color: var(--dash-ink-2, #4d5a66); }
    .dash-drill__body { padding: 20px 24px 28px; overflow: auto; flex: 1; }
  `,
})
export class DashDrillSheetComponent {
  protected readonly data = inject<DashDrillOptions>(MAT_DIALOG_DATA);
  private readonly ref = inject(MatDialogRef<DashDrillSheetComponent>);
  protected readonly titleId = `dash-drill-title-${nextId++}`;
  protected readonly close = () => this.ref.close();
}

/** Opens drill-down panels as a right-hand side sheet (default) or a centred dialog. */
@Injectable({ providedIn: 'root' })
export class DashDrilldownService {
  private readonly dialog = inject(MatDialog);
  private current: MatDialogRef<DashDrillSheetComponent> | null = null;

  open<T extends DashDrillContext>(options: DashDrillOptions<T>): MatDialogRef<DashDrillSheetComponent> {
    // Clicking another point while a panel is open replaces it instead of stacking dialogs.
    this.current?.close();
    const sheet = (options.mode ?? 'sheet') === 'sheet';
    const ref = this.dialog.open(DashDrillSheetComponent, {
      data: options,
      panelClass: ['dash-drill-panel', sheet ? 'dash-drill-panel--sheet' : 'dash-drill-panel--dialog'],
      position: sheet ? { right: '0', top: '0' } : undefined,
      height: sheet ? '100dvh' : undefined,
      width: sheet ? 'min(460px, 100vw)' : 'min(600px, calc(100vw - 32px))',
      maxWidth: '100vw',
      maxHeight: sheet ? '100dvh' : 'calc(100dvh - 32px)',
      ariaLabel: options.title,
      autoFocus: 'dialog',
      restoreFocus: true,
    });
    this.current = ref;
    ref.afterClosed().subscribe(() => {
      if (this.current === ref) this.current = null;
    });
    return ref;
  }
}
