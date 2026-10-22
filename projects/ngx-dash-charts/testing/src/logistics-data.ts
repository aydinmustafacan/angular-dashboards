import type { DashAnnotation, DashDatum, DashSeries, DashSlice, DashThreshold } from 'ngx-dash-charts';

export type Region = 'all' | 'emea' | 'americas' | 'apac';

export interface WeekMeta {
  lanes: number;
  exceptions: number;
  busiestLane: string;
  weather: 'clear' | 'storms' | 'snow';
}

export interface SiteMeta {
  site: string;
  docks: number;
  manager: string;
}

export interface LogisticsData {
  weeks: Date[];
  /** Weekly shipments by transport mode — stack them. */
  shipmentsByMode: DashSeries<WeekMeta>[];
  /** Total shipments (solid) and the forecast (dashed, runs six weeks past today). */
  shipmentsVsForecast: DashSeries<WeekMeta>[];
  /** Total shipments as columns with a 4-week moving average line, on one axis. */
  shipmentsWithAverage: DashSeries<WeekMeta>[];
  onTimeRate: DashSeries[];
  onTimeTarget: DashThreshold;
  capacity: DashThreshold;
  peakSeason: DashAnnotation;
  transitDays: DashDatum[];
  damageClaims: DashDatum[];
  totalShipments: DashDatum<WeekMeta>[];
  delayCauses: DashSlice[];
  shipmentsByRegion: DashSlice[];
  throughputBySite: DashSeries<SiteMeta>[];
}

const MODES = [
  { id: 'road', name: 'Road', base: 7200 },
  { id: 'rail', name: 'Rail', base: 2400 },
  { id: 'sea', name: 'Sea', base: 1150 },
  { id: 'air', name: 'Air', base: 620 },
];

const REGION_SHARE: Record<Region, number> = { all: 1, emea: 0.42, americas: 0.36, apac: 0.22 };

const LANES = ['Rotterdam → Leipzig', 'Memphis → Dallas', 'Singapore → Santos', 'Leipzig → Milan', 'Dallas → Monterrey'];

/** Deterministic PRNG so stories and screenshots are stable. */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Mondays, oldest first, ending with the week that starts on `lastMonday`. */
export function weekStarts(count: number, lastMonday = new Date(2026, 9, 12)): Date[] {
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(lastMonday);
    d.setDate(d.getDate() - (count - 1 - i) * 7);
    return d;
  });
}

/** Seasonality: a pre-holiday peak in Nov–Dec, a January lull. */
function season(d: Date): number {
  const m = d.getMonth();
  const day = d.getDate();
  if (m === 10 && day >= 20) return 1.22;
  if (m === 11 && day < 22) return 1.28;
  if (m === 11) return 0.86;
  if (m === 0) return 0.84;
  if (m === 7) return 0.95;
  return 1;
}

const round = (v: number, step = 1) => Math.round(v / step) * step;

export function logisticsData(options: { weeks?: number; region?: Region; seed?: number } = {}): LogisticsData {
  const count = options.weeks ?? 26;
  const region = options.region ?? 'all';
  const rand = mulberry32((options.seed ?? 42) + count * 7 + region.length);
  const share = REGION_SHARE[region];
  // Always generate a full year so the last N weeks look the same whatever N is.
  const all = weekStarts(52);
  const weeks = all.slice(-count);
  const offset = all.length - count;

  const meta: WeekMeta[] = all.map(() => ({
    lanes: round(180 + rand() * 40),
    exceptions: round(12 + rand() * 30),
    busiestLane: LANES[Math.floor(rand() * LANES.length)],
    weather: rand() > 0.85 ? (rand() > 0.5 ? 'snow' : 'storms') : 'clear',
  }));

  const byMode = MODES.map((mode) => {
    const values = all.map((d, i) => {
      const growth = 1 + i * 0.0035;
      const noise = 0.93 + rand() * 0.14;
      const strike = i === 38 && mode.id === 'sea' ? 0.45 : 1;
      return round(mode.base * share * season(d) * growth * noise * strike, 1);
    });
    return { mode, values };
  });

  const totals = all.map((_, i) => byMode.reduce((sum, m) => sum + m.values[i], 0));
  const visible = <T,>(arr: T[]) => arr.slice(offset);

  const shipmentsByMode: DashSeries<WeekMeta>[] = byMode.map(({ mode, values }, i) => ({
    id: mode.id,
    name: mode.name,
    slot: i + 1,
    data: visible(values).map((y, j) => ({ x: weeks[j], y, meta: meta[offset + j] })),
  }));

  const totalShipments: DashDatum<WeekMeta>[] = visible(totals).map((y, j) => ({ x: weeks[j], y, meta: meta[offset + j] }));

  // Forecast overlaps the last 8 actual weeks and runs 6 weeks ahead.
  const future = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(weeks[weeks.length - 1]);
    d.setDate(d.getDate() + (i + 1) * 7);
    return d;
  });
  const lastTotal = totals[totals.length - 1];
  const forecast: DashDatum<WeekMeta>[] = [
    ...weeks.slice(-8).map((x, i) => ({ x, y: round(totals[all.length - 8 + i] * (0.97 + rand() * 0.06), 10) })),
    ...future.map((x) => ({ x, y: round(lastTotal * season(x) * (1.01 + rand() * 0.03), 10) })),
  ];

  const shipmentsVsForecast: DashSeries<WeekMeta>[] = [
    { id: 'shipments', name: 'Shipments', slot: 1, data: totalShipments },
    { id: 'forecast', name: 'Forecast', slot: 2, dashed: true, data: forecast },
  ];

  const average = totals.map((_, i) => {
    const win = totals.slice(Math.max(0, i - 3), i + 1);
    return round(win.reduce((a, b) => a + b, 0) / win.length);
  });

  const shipmentsWithAverage: DashSeries<WeekMeta>[] = [
    { id: 'shipments', name: 'Shipments', slot: 1, type: 'bar', data: totalShipments },
    {
      id: 'avg4',
      name: '4-week average',
      slot: 2,
      type: 'line',
      data: visible(average).map((y, j) => ({ x: weeks[j], y })),
    },
  ];

  const onTime = all.map((d) => {
    const strain = season(d) > 1.1 ? 0.035 : 0;
    return Math.min(0.995, 0.955 - strain + (rand() - 0.5) * 0.03);
  });

  const onTimeRate: DashSeries[] = [
    {
      id: 'ontime',
      name: 'On-time delivery',
      slot: 3,
      format: { style: 'percent', decimals: 1 },
      data: visible(onTime).map((y, j) => ({ x: weeks[j], y })),
    },
  ];

  const peakStart = all.find((d) => d.getMonth() === 10 && d.getDate() >= 20) ?? all[0];
  const peakEnd = all.find((d) => d.getMonth() === 11 && d.getDate() >= 15) ?? all[1];

  const causes: [string, string, number][] = [
    ['weather', 'Weather', 412],
    ['capacity', 'Carrier capacity', 356],
    ['customs', 'Customs hold', 241],
    ['backlog', 'Warehouse backlog', 198],
    ['address', 'Address issues', 121],
    ['breakdown', 'Vehicle breakdown', 87],
    ['docs', 'Missing documents', 54],
    ['damage', 'Damaged in transit', 31],
  ];

  const sites: [string, string, number, number, string][] = [
    ['rtm', 'Rotterdam DC', 4820, 24, 'A. Visser'],
    ['mem', 'Memphis Hub', 4410, 30, 'J. Okafor'],
    ['sin', 'Singapore Gateway', 3980, 18, 'L. Tan'],
    ['lej', 'Leipzig', 3120, 16, 'M. Krause'],
    ['dfw', 'Dallas Crossdock', 2760, 14, 'R. Alvarez'],
    ['ssz', 'Santos Port', 1940, 10, 'C. Lima'],
  ];

  return {
    weeks,
    shipmentsByMode,
    shipmentsVsForecast,
    shipmentsWithAverage,
    onTimeRate,
    onTimeTarget: { value: 0.95, label: 'Target 95%', status: 'good' },
    capacity: { value: round(13_500 * share, 100), label: 'Network capacity', status: 'serious' },
    peakSeason: { from: peakStart, to: peakEnd, label: 'Peak season' },
    transitDays: visible(all.map((d) => +(2.7 + (season(d) - 1) * 2 + rand() * 0.4).toFixed(2))).map((y, j) => ({ x: weeks[j], y })),
    damageClaims: visible(all.map(() => round((22 + rand() * 20) * share))).map((y, j) => ({ x: weeks[j], y })),
    totalShipments,
    delayCauses: causes.map(([id, name, v]) => ({ id, name, value: round(v * share * (0.85 + rand() * 0.3)) })),
    shipmentsByRegion: [
      { id: 'emea', name: 'EMEA', value: round(totals[totals.length - 1] * 0.42) },
      { id: 'americas', name: 'Americas', value: round(totals[totals.length - 1] * 0.36) },
      { id: 'apac', name: 'APAC', value: round(totals[totals.length - 1] * 0.22) },
    ],
    throughputBySite: [
      {
        id: 'pallets',
        name: 'Pallets handled',
        slot: 1,
        data: sites.map(([, site, v, docks, manager]) => ({
          x: site,
          y: round(v * (0.92 + rand() * 0.16)),
          meta: { site, docks, manager },
        })),
      },
    ],
  };
}
