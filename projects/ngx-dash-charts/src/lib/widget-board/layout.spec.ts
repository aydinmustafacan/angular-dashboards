import {
  DashWidgetLayout,
  compactUp,
  isCompatibleLayout,
  isValidLayout,
  moveWidget,
  normalizeLayout,
} from './layout';

const kpi = (id: string, x: number, y = 0): DashWidgetLayout => ({ id, kind: 'kpi', x, y, cols: 1, rows: 1 });
const chart = (id: string, x: number, y: number, rows = 2): DashWidgetLayout => ({ id, kind: 'chart', x, y, cols: 2, rows });
const wide = (id: string, y: number): DashWidgetLayout => ({ id, kind: 'wide', x: 0, y, cols: 4, rows: 2 });

const board = (): DashWidgetLayout[] => [
  kpi('a', 0),
  kpi('b', 1),
  kpi('c', 2),
  kpi('d', 3),
  chart('trend', 0, 1, 3),
  chart('pie', 2, 1, 3),
  wide('combo', 4),
];

const at = (items: DashWidgetLayout[] | null, id: string) => items?.find((i) => i.id === id);

describe('widget board layout', () => {
  it('accepts the default board', () => {
    expect(isValidLayout(board())).toBe(true);
  });

  it('rejects overlaps, out-of-bounds and sizes outside the kind limits', () => {
    expect(isValidLayout([kpi('a', 0), kpi('b', 0)])).toBe(false);
    expect(isValidLayout([chart('c', 3, 0)])).toBe(false);
    expect(isValidLayout([{ ...chart('c', 0, 0), cols: 3 }])).toBe(false);
    expect(isValidLayout([{ ...kpi('k', 0), rows: 2 }])).toBe(false);
  });

  it('normalizes sizes to the kind limits and keeps widgets on the board', () => {
    const [n] = normalizeLayout([{ id: 'c', kind: 'chart', x: 3, y: 0, cols: 4, rows: 9 }]);
    expect(n).toMatchObject({ x: 2, cols: 2, rows: 3 });
  });

  it('compacts widgets upwards to close gaps', () => {
    const items = compactUp([kpi('a', 0), chart('c', 0, 5)]);
    expect(at(items, 'c')?.y).toBe(1);
  });

  it('swaps a KPI with its same-sized neighbour', () => {
    const next = moveWidget(board(), 'a', 'right');
    expect(at(next, 'a')?.x).toBe(1);
    expect(at(next, 'b')?.x).toBe(0);
  });

  it('swaps two same-sized charts side by side', () => {
    const next = moveWidget(board(), 'trend', 'right');
    expect(at(next, 'trend')?.x).toBe(2);
    expect(at(next, 'pie')?.x).toBe(0);
  });

  it('hops a chart past the wide widget, then swaps it with a same-width chart', () => {
    const items = [...board(), chart('ontime', 0, 6), chart('sites', 2, 6)];
    const once = moveWidget(items, 'trend', 'down')!;
    expect(isValidLayout(once)).toBe(true);
    expect(at(once, 'combo')!.y).toBe(4);
    expect(at(once, 'trend')).toMatchObject({ x: 0, y: 6 });
    const twice = moveWidget(once, 'trend', 'down')!;
    expect(isValidLayout(twice)).toBe(true);
    expect(at(twice, 'trend')!.y).toBeGreaterThan(at(twice, 'ontime')!.y);
  });

  it('hops a lone chart up past the wide widget', () => {
    const items = [...board(), chart('ontime', 0, 6)];
    const next = moveWidget(items, 'ontime', 'up')!;
    expect(at(next, 'ontime')!.y).toBeLessThan(at(next, 'combo')!.y);
  });

  it('moves the wide widget up above the charts', () => {
    const next = moveWidget(board(), 'combo', 'up')!;
    expect(isValidLayout(next)).toBe(true);
    expect(at(next, 'combo')!.y).toBe(1);
    expect(at(next, 'trend')!.y).toBe(3);
  });

  it('refuses to move a KPI into a full row of charts', () => {
    expect(moveWidget(board(), 'a', 'down')).toBeNull();
  });

  it('refuses to move a chart into the KPI row, which has no room', () => {
    expect(moveWidget(board(), 'trend', 'up')).toBeNull();
  });

  it('refuses moves off the board', () => {
    expect(moveWidget(board(), 'a', 'left')).toBeNull();
    expect(moveWidget(board(), 'pie', 'right')).toBeNull();
  });

  it('only restores stored layouts with the same widgets', () => {
    expect(isCompatibleLayout(board(), board())).toBe(true);
    expect(isCompatibleLayout(board().slice(1), board())).toBe(false);
    expect(isCompatibleLayout([...board().slice(0, 6), { ...wide('combo', 4), kind: 'chart' }], board())).toBe(false);
    expect(isCompatibleLayout('nope', board())).toBe(false);
  });
});
