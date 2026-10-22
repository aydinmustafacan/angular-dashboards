import { Component, DOCUMENT, computed, effect, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { isoWeek, weekRange } from 'ngx-dash-charts';
import { OperationsOverview, weekStarts } from 'ngx-dash-charts/testing';

type Theme = 'system' | 'light' | 'dark';
const THEME_KEY = 'dash-showcase-theme';
const NEXT: Record<Theme, Theme> = { system: 'light', light: 'dark', dark: 'system' };
const LABEL: Record<Theme, string> = { system: 'Following system theme', light: 'Light theme', dark: 'Dark theme' };

function readTheme(): Theme {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch {
    return 'system';
  }
}

@Component({
  imports: [MatButtonModule, MatTooltipModule, OperationsOverview],
  selector: 'app-root',
  styleUrl: './app.scss',
  templateUrl: './app.html',
})
export class App {
  private readonly document = inject(DOCUMENT);
  protected readonly theme = signal<Theme>(readTheme());
  protected readonly themeLabel = computed(() => `${LABEL[this.theme()]}. Switch to ${LABEL[NEXT[this.theme()]].toLowerCase()}`);

  private readonly lastWeek = weekStarts(1)[0];
  protected readonly weekLabel = `Week ${isoWeek(this.lastWeek)}, ${weekRange(this.lastWeek)} ${this.lastWeek.getFullYear()}`;

  constructor() {
    effect(() => {
      const theme = this.theme();
      const root = this.document.documentElement;
      if (theme === 'system') delete root.dataset['theme'];
      else root.dataset['theme'] = theme;
      try {
        localStorage.setItem(THEME_KEY, theme);
      } catch {
        // Storage unavailable (private mode) — the toggle still works for this visit.
      }
    });
  }

  protected cycleTheme(): void {
    this.theme.update((t) => NEXT[t]);
  }
}
