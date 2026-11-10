import { describe, expect, it } from 'vitest';
import { keepSelection, nearestDay, periodDays, periodTitle } from './calendar-grid.period';
import { DataEntry, GridEntry, GroupEntry, buildEntries, compareEntries } from './calendar-grid.rows';

interface Room {
  id: string;
  name: string;
  floor: string;
  seats: number;
}

const rooms: Room[] = [
  { id: 'r1', name: 'Cedar', floor: '2', seats: 8 },
  { id: 'r2', name: 'Birch', floor: '1', seats: 4 },
  { id: 'r3', name: 'Aspen', floor: '2', seats: 12 },
  { id: 'r4', name: 'Dogwood', floor: '1', seats: 6 },
];
const options = { rowId: (r: Room) => r.id, rowLabel: (r: Room) => r.name };

describe('periodDays and periodTitle', () => {
  it('shows workdays by default and every day with weekends', () => {
    expect(periodDays('2026-11-11', 'week', false)).toEqual([
      '2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13',
    ]);
    expect(periodDays('2026-11-11', 'week', true)).toHaveLength(7);
    expect(periodDays('2026-11-11', 'month', false)).toHaveLength(21);
  });

  it('ends the title on Friday or Sunday to match the days shown', () => {
    expect(periodTitle('2026-11-11', 'week', false)).toBe('Mon 9 – Fri 13 Nov');
    expect(periodTitle('2026-11-11', 'week', true)).toBe('Mon 9 – Sun 15 Nov');
    expect(periodTitle('2026-11-11', 'month', true)).toBe('November 2026');
  });
});

describe('selection helpers', () => {
  const days = ['2026-11-09', '2026-11-10', '2026-11-11'];

  it('keeps a shown day, else today, else the first day', () => {
    expect(keepSelection(days, '2026-11-10', '2026-11-11')).toBe('2026-11-10');
    expect(keepSelection(days, '2026-12-01', '2026-11-11')).toBe('2026-11-11');
    expect(keepSelection(days, '2026-12-01', '2026-12-02')).toBe('2026-11-09');
  });

  it('moves a weekend "today" to the next shown day', () => {
    expect(nearestDay(days, '2026-11-08')).toBe('2026-11-09');
    expect(nearestDay(days, '2026-11-14')).toBe('2026-11-11');
  });
});

describe('buildEntries', () => {
  it('passes rows through when ungrouped', () => {
    const entries = buildEntries(rooms, { ...options, groupBy: null });
    expect(entries.map((e) => e.id)).toEqual(['r1', 'r2', 'r3', 'r4']);
  });

  it('orders by group then label, with a sized heading before each group', () => {
    const entries = buildEntries(rooms, { ...options, groupBy: (r) => `Floor ${r.floor}` });
    expect(entries.map((e) => (e.kind === 'group' ? `[${e.group} ${e.size}]` : e.id))).toEqual([
      '[Floor 1 2]', 'r2', 'r4', '[Floor 2 2]', 'r3', 'r1',
    ]);
  });
});

describe('compareEntries', () => {
  /** Sorts the way AG Grid does: it negates the comparator for a descending sort. */
  const sortBy = (descending: boolean, grouped: boolean) => {
    const groupBy = grouped ? (r: Room) => `Floor ${r.floor}` : null;
    const entries = buildEntries(rooms, { ...options, groupBy }) as (DataEntry<Room> | GroupEntry)[];
    const sign = descending ? -1 : 1;
    return entries
      .sort((a, b) => sign * compareEntries(a, b, (r) => r.seats, options.rowLabel, descending))
      .map((e: GridEntry<Room>) => (e.kind === 'group' ? `[${e.group}]` : e.kind === 'row' ? e.row.name : ''));
  };

  it('keeps groups A to Z with their heading first, in both directions', () => {
    expect(sortBy(false, true)).toEqual(['[Floor 1]', 'Birch', 'Dogwood', '[Floor 2]', 'Cedar', 'Aspen']);
    expect(sortBy(true, true)).toEqual(['[Floor 1]', 'Dogwood', 'Birch', '[Floor 2]', 'Aspen', 'Cedar']);
  });

  it('sorts across everything when ungrouped', () => {
    expect(sortBy(true, false)).toEqual(['Aspen', 'Cedar', 'Dogwood', 'Birch']);
  });

  it('breaks ties by label', () => {
    const tie = [{ ...rooms[0], seats: 5 }, { ...rooms[1], seats: 5 }];
    const entries = buildEntries(tie, { ...options, groupBy: null }) as DataEntry<Room>[];
    expect(compareEntries(entries[0], entries[1], (r) => r.seats, options.rowLabel, false)).toBeGreaterThan(0);
  });
});
