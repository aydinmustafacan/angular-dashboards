/** A value on the x axis: a date (weekly/daily/monthly buckets), an ISO date string, or a plain category. */
export type DashX = Date | string | number;

/** How x values are bucketed and labelled. `auto` picks `week` for dates and `category` otherwise. */
export type DashGranularity = 'auto' | 'day' | 'week' | 'month' | 'category';

export interface DashDatum<M = unknown> {
  x: DashX;
  y: number | null;
  /** Anything the host wants back in tooltips, click events and drill-down panels. */
  meta?: M;
}

export type DashSeriesType = 'line' | 'area' | 'bar';

export interface DashSeries<M = unknown> {
  /** Stable id. Colour follows the id, so filtering never repaints the remaining series. */
  id: string;
  name: string;
  data: DashDatum<M>[];
  type?: DashSeriesType;
  /** Series sharing a stack id are stacked. */
  stack?: string;
  /** Fixed palette slot (1–8). Defaults to the series' position in the input array. */
  slot?: number;
  /** Explicit colour, bypassing the palette. Prefer `slot` so dark mode keeps working. */
  color?: string;
  /** Draw dashed — for forecasts, targets, previous periods. */
  dashed?: boolean;
  /** Whether an increase is good news. Drives delta colouring. Defaults to true. */
  upIsGood?: boolean;
  format?: DashValueFormat;
}

export interface DashFormatOptions {
  style?: 'number' | 'percent' | 'currency' | 'unit';
  /** 1,284 → 1.3K. Defaults to true from one million up; axes always compact. */
  compact?: boolean;
  /** Fraction digits. */
  decimals?: number;
  /** ISO currency code for `style: 'currency'`. */
  currency?: string;
  /** Intl unit (`day`, `kilogram`, `hour`) for `style: 'unit'`. */
  unit?: string;
  /** Free text appended after the number, e.g. ` pallets`. */
  suffix?: string;
}

export type DashValueFormat = DashFormatOptions | ((value: number) => string);

export type DashStatus = 'good' | 'warning' | 'serious' | 'critical';

/** A horizontal reference line — a target, a capacity limit, an SLA. */
export interface DashThreshold {
  value: number;
  label: string;
  status?: DashStatus;
}

/** A shaded x range — a holiday peak, an outage, a promotion. */
export interface DashAnnotation {
  from: DashX;
  to: DashX;
  label: string;
}

export interface DashPointValue<M = unknown> {
  seriesId: string;
  seriesName: string;
  value: number | null;
  formatted: string;
  color: string;
  dashed: boolean;
  /** Value at the previous x, when there is one. */
  previous: number | null;
  /** Relative change vs. previous, as a fraction (0.042 = +4.2%). */
  delta: number | null;
  /** True when the delta is good news, given the series' `upIsGood`. */
  deltaIsGood: boolean | null;
  /** Share of the stack total at this x, when stacked. */
  share: number | null;
  meta?: M;
}

/** Everything known about one x position. Used for tooltips, clicks and drill-down panels. */
export interface DashPointEvent<M = unknown> {
  source: 'trend' | 'bar' | 'combo' | 'kpi';
  index: number;
  x: DashX;
  xLabel: string;
  /** Secondary label, e.g. the date range for a week. */
  xDetail: string;
  /** The series under the pointer, when a specific mark was hit. */
  series: DashPointValue<M> | null;
  values: DashPointValue<M>[];
  total: number | null;
  totalFormatted: string | null;
  thresholds: (DashThreshold & { formatted: string })[];
}

export interface DashSlice<M = unknown> {
  id: string;
  name: string;
  value: number;
  slot?: number;
  color?: string;
  meta?: M;
}

export interface DashSliceEvent<M = unknown> {
  source: 'pie';
  index: number;
  id: string;
  name: string;
  value: number;
  formatted: string;
  /** Fraction of the total. */
  share: number;
  color: string;
  total: number;
  totalFormatted: string;
  /** Slices folded into "Other". Empty for regular slices. */
  children: DashSlice<M>[];
  selectedIds: string[];
  meta?: M;
}

export type DashDrillContext<M = unknown> = DashPointEvent<M> | DashSliceEvent<M>;

export interface DashTableData {
  columns: { key: string; label: string; numeric?: boolean }[];
  rows: Record<string, string | number | null>[];
}
