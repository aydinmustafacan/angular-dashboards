import { DOCUMENT, DestroyRef, Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { DashStatus } from './types';

/** Resolved design tokens the charts paint with. Read from `--dash-*` CSS custom properties. */
export interface DashTokens {
  dark: boolean;
  font: string;
  surface: string;
  ink: string;
  ink2: string;
  muted: string;
  grid: string;
  baseline: string;
  accent: string;
  goodText: string;
  badText: string;
  series: string[];
  status: Record<DashStatus, string>;
}

const LIGHT: DashTokens = {
  dark: false,
  font: 'system-ui, -apple-system, "Segoe UI", sans-serif',
  surface: '#fbfcfc',
  ink: '#15202b',
  ink2: '#4d5a66',
  muted: '#7d8893',
  grid: '#e3e7ea',
  baseline: '#c2c9cf',
  accent: '#1d4f91',
  goodText: '#006300',
  badText: '#b42828',
  series: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'],
  status: { good: '#0ca30c', warning: '#fab219', serious: '#ec835a', critical: '#d03b3b' },
};

const TOKEN_NAMES: Record<Exclude<keyof DashTokens, 'dark' | 'series' | 'status'>, string> = {
  font: '--dash-font',
  surface: '--dash-surface',
  ink: '--dash-ink',
  ink2: '--dash-ink-2',
  muted: '--dash-muted',
  grid: '--dash-grid',
  baseline: '--dash-baseline',
  accent: '--dash-accent',
  goodText: '--dash-good-text',
  badText: '--dash-bad-text',
};

/**
 * Exposes the current chart tokens as a signal. Re-reads them when the OS colour scheme
 * changes or when `data-theme` / `class` / `style` changes on `<html>`, so charts repaint
 * on a theme toggle without any wiring in the host app.
 */
@Injectable({ providedIn: 'root' })
export class DashThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  readonly tokens = signal<DashTokens>(LIGHT);

  constructor() {
    if (!this.browser) return;
    this.refresh();
    const media = this.document.defaultView?.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => this.refresh();
    media?.addEventListener('change', onChange);
    const observer = new MutationObserver(onChange);
    observer.observe(this.document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme', 'class', 'style'],
    });
    inject(DestroyRef).onDestroy(() => {
      media?.removeEventListener('change', onChange);
      observer.disconnect();
    });
  }

  refresh(): void {
    const root = this.document.documentElement;
    const css = this.document.defaultView!.getComputedStyle(root);
    const read = (name: string) => css.getPropertyValue(name).trim();
    const next: DashTokens = { ...LIGHT, series: [...LIGHT.series], status: { ...LIGHT.status } };
    for (const [key, name] of Object.entries(TOKEN_NAMES)) {
      const value = read(name);
      if (value) (next as unknown as Record<string, string>)[key] = value;
    }
    for (let i = 0; i < 8; i++) next.series[i] = read(`--dash-series-${i + 1}`) || next.series[i];
    for (const s of Object.keys(next.status) as DashStatus[]) {
      next.status[s] = read(`--dash-status-${s}`) || next.status[s];
    }
    next.dark = isDark(next.surface);
    const prev = this.tokens();
    if (JSON.stringify(prev) !== JSON.stringify(next)) this.tokens.set(next);
  }
}

function isDark(color: string): boolean {
  const m = /^#([0-9a-f]{6})$/i.exec(color);
  if (!m) return false;
  const n = parseInt(m[1], 16);
  const lum = 0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255);
  return lum < 128;
}

/** Colour for a palette slot (1-based). Slots past 8 wrap — callers should fold to "Other" first. */
export function seriesColor(tokens: DashTokens, slot: number): string {
  return tokens.series[(slot - 1) % tokens.series.length];
}

export function withAlpha(color: string, alpha: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(color);
  if (!m) return color;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}
