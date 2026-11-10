/** A row the caller passed in. */
export interface DataEntry<T> {
  kind: 'row';
  id: string;
  row: T;
  group: string | null;
}

/** A heading drawn across the full width of the grid before each group. */
export interface GroupEntry {
  kind: 'group';
  id: string;
  group: string;
  size: number;
}

/** The summary row pinned under the header. */
export interface SummaryEntry {
  kind: 'summary';
  id: 'summary';
}

export type GridEntry<T> = DataEntry<T> | GroupEntry | SummaryEntry;

export interface EntryOptions<T> {
  rowId: (row: T) => string;
  rowLabel: (row: T) => string;
  groupBy: ((row: T) => string) | null;
}

/**
 * Wraps the caller's rows for the grid. Grouped, rows are ordered by group then label and a
 * heading goes before each group; the grid's own sort then reorders inside each group.
 */
export function buildEntries<T>(rows: readonly T[], options: EntryOptions<T>): GridEntry<T>[] {
  const { rowId, rowLabel, groupBy } = options;
  const entries: DataEntry<T>[] = rows.map((row) => ({
    kind: 'row',
    id: rowId(row),
    row,
    group: groupBy ? groupBy(row) : null,
  }));
  if (!groupBy) return entries;

  entries.sort(
    (a, b) => a.group!.localeCompare(b.group!) || rowLabel(a.row).localeCompare(rowLabel(b.row)),
  );
  const sizes = new Map<string, number>();
  for (const e of entries) sizes.set(e.group!, (sizes.get(e.group!) ?? 0) + 1);

  const result: GridEntry<T>[] = [];
  let current: string | null = null;
  for (const entry of entries) {
    if (entry.group !== current) {
      current = entry.group!;
      result.push({ kind: 'group', id: `group:${current}`, group: current, size: sizes.get(current)! });
    }
    result.push(entry);
  }
  return result;
}

export type SortKey<T> = (row: T) => string | number;

/**
 * Comparator for a sortable column. AG Grid negates the result for a descending sort, so the
 * group order and heading position are negated back here: groups stay A to Z with their
 * heading first, and only the rows inside each group reverse. Ties fall back to the label.
 */
export function compareEntries<T>(
  a: DataEntry<T> | GroupEntry,
  b: DataEntry<T> | GroupEntry,
  key: SortKey<T>,
  label: (row: T) => string,
  descending: boolean,
): number {
  const keep = descending ? -1 : 1;
  if (a.group !== b.group) return (a.group ?? '').localeCompare(b.group ?? '') * keep;
  if (a.kind === 'group') return -keep;
  if (b.kind === 'group') return keep;
  const ka = key(a.row);
  const kb = key(b.row);
  const result =
    typeof ka === 'number' && typeof kb === 'number' ? ka - kb : String(ka).localeCompare(String(kb));
  return result || label(a.row).localeCompare(label(b.row));
}
