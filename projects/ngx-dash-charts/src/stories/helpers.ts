import { formatDelta } from '../lib/core/format';
import type { DashPointEvent, DashSlice, DashSliceEvent } from '../lib/core/types';
import type { DashStat } from '../lib/stat-list/stat-list';
import { logisticsData, type WeekMeta } from '../../testing/src/public-api';

/** Shared demo data — a fictional freight network, last 26 / 52 complete weeks. */
export const half = logisticsData({ weeks: 26 });
export const year = logisticsData({ weeks: 52 });
export const quarter = logisticsData({ weeks: 13 });

/** One stat per series at the clicked week, with its change vs. the previous week. */
export function pointStats(ctx: DashPointEvent): DashStat[] {
  const stats: DashStat[] = ctx.values.map((v) => ({
    label: v.seriesName,
    value: v.formatted,
    detail: v.delta === null ? undefined : `${v.delta >= 0 ? '▲' : '▼'} ${formatDelta(v.delta)} vs. previous`,
    tone: v.deltaIsGood === null ? null : v.deltaIsGood ? 'good' : 'bad',
  }));
  if (ctx.totalFormatted) stats.unshift({ label: 'Total', value: ctx.totalFormatted });
  return stats;
}

export function pointSlices(ctx: DashPointEvent): DashSlice[] {
  return ctx.values
    .filter((v) => (v.value ?? 0) > 0 && !v.dashed)
    .map((v) => ({ id: v.seriesId, name: v.seriesName, value: v.value!, color: v.color }));
}

export function weekStats(ctx: DashPointEvent): DashStat[] {
  const meta = (ctx.series?.meta ?? ctx.values.find((v) => v.meta)?.meta) as WeekMeta | undefined;
  if (!meta) return [];
  return [
    { label: 'Active lanes', value: String(meta.lanes) },
    { label: 'Exceptions raised', value: String(meta.exceptions) },
    { label: 'Busiest lane', value: meta.busiestLane },
    { label: 'Weather', value: meta.weather === 'clear' ? 'Clear' : meta.weather === 'snow' ? 'Snow' : 'Storms' },
  ];
}

export function sliceStats(ctx: DashSliceEvent): DashStat[] {
  return [
    { label: 'Delays', value: ctx.formatted },
    { label: 'Share of all delays', value: `${(ctx.share * 100).toFixed(1)}%` },
  ];
}

export function childStats(ctx: DashSliceEvent): DashStat[] {
  return ctx.children.map((c) => ({ label: c.name, value: String(c.value) }));
}

/** Props every drill-down story template can use. */
export const drillHelpers = { pointStats, pointSlices, weekStats, sliceStats, childStats };
