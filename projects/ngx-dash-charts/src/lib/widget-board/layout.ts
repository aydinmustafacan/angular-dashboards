/**
 * Pure layout rules for `dash-widget-board`. One unit is one KPI tile; the board is
 * `DASH_BOARD_COLUMNS` units wide. Kept free of Angular and gridster so it is easy to test.
 */

/** `kpi`: 1×1 tile. `chart`: two units wide. `wide`: the full board width. */
export type DashWidgetKind = 'kpi' | 'chart' | 'wide';

export interface DashWidgetLayout {
  id: string;
  kind: DashWidgetKind;
  x: number;
  y: number;
  cols: number;
  rows: number;
}

export interface DashWidgetLimits {
  minCols: number;
  maxCols: number;
  minRows: number;
  maxRows: number;
}

export type DashMoveDirection = 'up' | 'down' | 'left' | 'right';

export const DASH_BOARD_COLUMNS = 4;

export const DASH_WIDGET_LIMITS: Record<DashWidgetKind, DashWidgetLimits> = {
  kpi: { minCols: 1, maxCols: 1, minRows: 1, maxRows: 1 },
  chart: { minCols: 2, maxCols: 2, minRows: 2, maxRows: 3 },
  wide: { minCols: DASH_BOARD_COLUMNS, maxCols: DASH_BOARD_COLUMNS, minRows: 2, maxRows: 3 },
};

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

export function overlaps(a: DashWidgetLayout, b: DashWidgetLayout): boolean {
  return a.x < b.x + b.cols && b.x < a.x + a.cols && a.y < b.y + b.rows && b.y < a.y + a.rows;
}

/** Clamps every widget to its kind's size limits and to the board width. */
export function normalizeLayout(items: DashWidgetLayout[], columns = DASH_BOARD_COLUMNS): DashWidgetLayout[] {
  return items.map((item) => {
    const limits = DASH_WIDGET_LIMITS[item.kind];
    const cols = clamp(item.cols, limits.minCols, Math.min(limits.maxCols, columns));
    const rows = clamp(item.rows, limits.minRows, limits.maxRows);
    return { ...item, cols, rows, x: clamp(Math.round(item.x), 0, columns - cols), y: Math.max(0, Math.round(item.y)) };
  });
}

/** True when every widget respects its limits, fits the board and nothing overlaps. */
export function isValidLayout(items: DashWidgetLayout[], columns = DASH_BOARD_COLUMNS): boolean {
  const ids = new Set<string>();
  for (const item of items) {
    const limits = DASH_WIDGET_LIMITS[item.kind];
    if (!limits || ids.has(item.id)) return false;
    ids.add(item.id);
    if (item.cols < limits.minCols || item.cols > limits.maxCols) return false;
    if (item.rows < limits.minRows || item.rows > limits.maxRows) return false;
    if (item.x < 0 || item.y < 0 || item.x + item.cols > columns) return false;
  }
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) if (overlaps(items[i], items[j])) return false;
  }
  return true;
}

/** Slides every widget up as far as it goes, top-left first, so the board has no holes. */
export function compactUp(items: DashWidgetLayout[]): DashWidgetLayout[] {
  const ordered = [...items].sort((a, b) => a.y - b.y || a.x - b.x);
  const placed: DashWidgetLayout[] = [];
  for (const item of ordered) {
    let y = item.y;
    while (y > 0 && !placed.some((p) => overlaps({ ...item, y: y - 1 }, p))) y--;
    placed.push({ ...item, y });
  }
  const byId = new Map(placed.map((p) => [p.id, p]));
  return items.map((item) => byId.get(item.id)!);
}

/**
 * Groups widgets into rows ("bands"): widgets whose vertical spans overlap share a band.
 * Each band is ordered left to right.
 */
export function toBands(items: DashWidgetLayout[]): DashWidgetLayout[][] {
  const bands: DashWidgetLayout[][] = [];
  let current: DashWidgetLayout[] = [];
  let bottom = -1;
  for (const item of readingOrder(items)) {
    if (current.length && item.y >= bottom) {
      bands.push(current);
      current = [];
    }
    current.push(item);
    bottom = Math.max(bottom, item.y + item.rows);
  }
  if (current.length) bands.push(current);
  return bands.map((band) => [...band].sort((a, b) => a.x - b.x));
}

/** Lays bands out top to bottom, widgets left to right within each band. */
function packBands(bands: DashWidgetLayout[][]): DashWidgetLayout[] {
  const out: DashWidgetLayout[] = [];
  let y = 0;
  for (const band of bands) {
    if (!band.length) continue;
    let x = 0;
    for (const item of band) {
      out.push({ ...item, x, y });
      x += item.cols;
    }
    y += Math.max(...band.map((i) => i.rows));
  }
  return out;
}

const width = (band: DashWidgetLayout[]) => band.reduce((sum, i) => sum + i.cols, 0);

/**
 * Keyboard-friendly move by one step.
 *
 * - Left / right reorders the widget within its row.
 * - Up / down moves it to the neighbouring row: it joins that row when there is free width,
 *   swaps with a widget of the same width when there isn't, and hops past a full-width widget.
 *   A widget leaving the top or bottom row on its own starts a new row there.
 * - Anything else would need room the target row doesn't have, so the move is refused (`null`).
 */
export function moveWidget(
  items: DashWidgetLayout[],
  id: string,
  direction: DashMoveDirection,
  columns = DASH_BOARD_COLUMNS,
): DashWidgetLayout[] | null {
  const item = items.find((i) => i.id === id);
  if (!item) return null;
  const bands = toBands(items);
  // Hand-dragged layouts with widgets stacked inside a row aren't rows; use free-space moves.
  if (bands.some((band) => width(band) > columns)) return moveFreeform(items, item, direction, columns);

  const b = bands.findIndex((band) => band.some((i) => i.id === id));
  const band = bands[b];
  const index = band.findIndex((i) => i.id === id);
  const next = bands.map((band) => [...band]);

  if (direction === 'left' || direction === 'right') {
    const j = index + (direction === 'left' ? -1 : 1);
    if (j < 0 || j >= band.length) return null;
    [next[b][index], next[b][j]] = [next[b][j], next[b][index]];
    return finish(items, packBands(next), columns);
  }

  const step = direction === 'up' ? -1 : 1;
  const t = b + step;
  if (t < 0 || t >= bands.length) {
    // Leaving the top or bottom row: only meaningful if the widget shares its row.
    if (band.length === 1) return null;
    next[b].splice(index, 1);
    direction === 'up' ? next.unshift([item]) : next.push([item]);
    return finish(items, packBands(next), columns);
  }

  const target = bands[t];
  if (columns - width(target) >= item.cols) {
    // Join the row, as close to the widget's current column as possible.
    next[b].splice(index, 1);
    const at = target.findIndex((o) => o.x > item.x);
    next[t].splice(at < 0 ? target.length : at, 0, item);
    return finish(items, packBands(next), columns);
  }

  const partners = target.filter((o) => o.cols === item.cols);
  if (partners.length) {
    const partner = partners.reduce((best, o) => (Math.abs(o.x - item.x) < Math.abs(best.x - item.x) ? o : best));
    next[b][index] = partner;
    next[t][target.indexOf(partner)] = item;
    return finish(items, packBands(next), columns);
  }

  if (band.length === 1 && item.cols === columns) {
    // A wide widget trades places with the whole neighbouring row.
    [next[b], next[t]] = [next[t], next[b]];
    return finish(items, packBands(next), columns);
  }

  if (target.length === 1 && target[0].cols === columns) {
    // Hop past a full-width widget into a row of its own.
    next[b].splice(index, 1);
    next.splice(direction === 'up' ? t : t + 1, 0, [item]);
    return finish(items, packBands(next), columns);
  }

  return null;
}

/** Returns `next` if it is valid and actually changes the layout; otherwise `null`. */
function finish(items: DashWidgetLayout[], next: DashWidgetLayout[], columns: number): DashWidgetLayout[] | null {
  if (!isValidLayout(next, columns)) return null;
  const byId = new Map(next.map((n) => [n.id, n]));
  const changed = items.some((i) => {
    const n = byId.get(i.id)!;
    return n.x !== i.x || n.y !== i.y;
  });
  return changed ? items.map((i) => byId.get(i.id)!) : null;
}

/** Fallback for layouts that aren't row-shaped: move into free space of the widget's own size. */
function moveFreeform(
  items: DashWidgetLayout[],
  item: DashWidgetLayout,
  direction: DashMoveDirection,
  columns: number,
): DashWidgetLayout[] | null {
  const dx = direction === 'left' ? -1 : direction === 'right' ? 1 : 0;
  const dy = direction === 'up' ? -1 : direction === 'down' ? 1 : 0;
  const others = items.filter((i) => i.id !== item.id);
  for (let step = 1; step <= 50; step++) {
    const moved = { ...item, x: item.x + dx * step, y: item.y + dy * step };
    if (moved.x < 0 || moved.y < 0 || moved.x + moved.cols > columns) return null;
    if (!others.some((o) => overlaps(o, moved))) {
      return finish(items, compactUp(items.map((i) => (i.id === item.id ? moved : i))), columns);
    }
  }
  return null;
}

/** Widgets in reading order (top to bottom, left to right) — used for the stacked mobile view. */
export function readingOrder(items: DashWidgetLayout[]): DashWidgetLayout[] {
  return [...items].sort((a, b) => a.y - b.y || a.x - b.x);
}

/** True when `stored` has exactly the same widget ids and kinds as `current` and is valid. */
export function isCompatibleLayout(stored: unknown, current: DashWidgetLayout[], columns = DASH_BOARD_COLUMNS): stored is DashWidgetLayout[] {
  if (!Array.isArray(stored) || stored.length !== current.length) return false;
  const kinds = new Map(current.map((c) => [c.id, c.kind]));
  const ok = stored.every(
    (s) =>
      s && typeof s.id === 'string' && kinds.get(s.id) === s.kind &&
      ['x', 'y', 'cols', 'rows'].every((k) => Number.isInteger(s[k])),
  );
  return ok && isValidLayout(stored as DashWidgetLayout[], columns);
}
