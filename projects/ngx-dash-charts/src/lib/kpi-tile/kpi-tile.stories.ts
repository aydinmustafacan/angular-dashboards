import type { Meta, StoryObj } from '@storybook/angular-vite';
import { argsToTemplate, moduleMetadata } from '@storybook/angular-vite';
import { fn } from 'storybook/test';
import { DashKpiTile } from './kpi-tile';
import { DashKpi } from './kpi';
import { DashKpiCaption, DashKpiSparkBars, DashKpiSparkline, DashKpiVisual } from './kpi-parts';
import { DashStatList } from '../stat-list/stat-list';
import { DashGrid, DashSpan } from '../dashboard-grid/dashboard-grid';
import { drillHelpers, half } from '../../stories/helpers';

const meta: Meta<DashKpiTile> = {
  title: 'Charts/KPI tile',
  component: DashKpiTile,
  decorators: [moduleMetadata({ imports: [DashStatList, DashGrid, DashSpan, DashKpi, DashKpiSparkline, DashKpiSparkBars, DashKpiCaption, DashKpiVisual] })],
  parameters: {
    docs: {
      description: {
        component:
          'A headline number with its change and a 12+ point sparkline. The value and delta default to the last two trend points. `upIsGood` decides whether a rise is coloured as good or bad news. Status always pairs an icon with a word, never colour alone. Hover the sparkline to read any week; click a week (or the tile, for the latest) to drill in. `visual` picks a sparkline, bars or nothing; for anything else, compose a `dash-kpi` (see Composed).',
      },
    },
  },
  render: (args) => ({
    props: args,
    template: `<div style="max-width:300px"><dash-kpi-tile ${argsToTemplate(args)} /></div>`,
  }),
  args: {
    label: 'Shipments last week',
    trend: half.totalShipments,
    upIsGood: true,
    deltaLabel: 'vs. previous week',
    status: null,
    visual: 'line',
    clickable: false,
    pointClick: fn(),
  },
  argTypes: {
    status: { control: 'inline-radio', options: [null, 'good', 'warning', 'serious', 'critical'] },
    visual: { control: 'inline-radio', options: ['line', 'bars', 'none'] },
    drilldownTemplate: { control: false },
    tooltipTemplate: { control: false },
  },
};
export default meta;
type Story = StoryObj<DashKpiTile>;

export const Shipments: Story = {};

export const OnTimeWithStatus: Story = {
  args: {
    label: 'On-time delivery',
    trend: half.onTimeRate[0].data,
    valueFormat: { style: 'percent', decimals: 1 },
    status: 'warning',
    caption: 'Target 95%',
  },
};

/** For damage claims a drop is good news — `upIsGood: false` flips the delta colour. */
export const DownIsGood: Story = {
  args: { label: 'Damage claims', trend: half.damageClaims, upIsGood: false },
};

export const TransitTime: Story = {
  args: {
    label: 'Average transit time',
    trend: half.transitDays,
    valueFormat: { style: 'unit', unit: 'day', decimals: 1 },
    upIsGood: false,
  },
};

/** A row of tiles in the dashboard grid. Click one to open its drill-down. */
export const Row: Story = {
  render: (args) => ({
    props: { ...args, ...drillHelpers, half },
    template: `
      <dash-grid>
        <dash-kpi-tile [dashSpan]="3" label="Shipments last week" [trend]="half.totalShipments" [drilldownTemplate]="d" (pointClick)="pointClick($event)" />
        <dash-kpi-tile [dashSpan]="3" label="On-time delivery" [trend]="half.onTimeRate[0].data" [valueFormat]="{ style: 'percent', decimals: 1 }" status="warning" caption="Target 95%" [drilldownTemplate]="d" />
        <dash-kpi-tile [dashSpan]="3" label="Average transit time" [trend]="half.transitDays" [valueFormat]="{ style: 'unit', unit: 'day', decimals: 1 }" [upIsGood]="false" [drilldownTemplate]="d" />
        <dash-kpi-tile [dashSpan]="3" label="Damage claims" [trend]="half.damageClaims" [upIsGood]="false" status="good" [drilldownTemplate]="d" />
      </dash-grid>
      <ng-template #d let-ctx><dash-stat-list [items]="pointStats(ctx)" [columns]="1" /></ng-template>
    `,
  }),
};

/** Volumes read well as bars: one per week, the latest in the accent colour. */
export const Bars: Story = {
  args: { label: 'Shipments last week', trend: half.totalShipments, visual: 'bars' },
};

/** Just the numbers — for tight rows or when the trend lives in a chart next to it. */
export const NoVisual: Story = {
  args: { label: 'Damage claims', trend: half.damageClaims, upIsGood: false, visual: 'none', status: 'good' },
};

/**
 * `dash-kpi` keeps the summary and lets you project the rest: a built-in visual, your own
 * (any element marked `dashKpiVisual`, reading the data with `injectKpi()`), and a caption with markup.
 */
export const Composed: Story = {
  render: () => ({
    props: { half },
    template: `
      <dash-grid>
        <dash-kpi [dashSpan]="4" label="Shipments last week" [trend]="half.totalShipments">
          <dash-kpi-spark-bars />
          <dash-kpi-caption>Peak season from <strong>Nov 20</strong></dash-kpi-caption>
        </dash-kpi>
        <dash-kpi [dashSpan]="4" label="On-time delivery" [trend]="half.onTimeRate[0].data" [valueFormat]="{ style: 'percent', decimals: 1 }" status="warning">
          <div dashKpiVisual style="display:flex;align-items:center;height:auto">
            <progress max="0.95" [value]="half.onTimeRate[0].data.at(-1).y" style="width:100%" aria-label="Progress to the 95% target"></progress>
          </div>
          <dash-kpi-caption>Target <strong>95%</strong></dash-kpi-caption>
        </dash-kpi>
        <dash-kpi [dashSpan]="4" label="Average transit time" [trend]="half.transitDays" [valueFormat]="{ style: 'unit', unit: 'day', decimals: 1 }" [upIsGood]="false" />
      </dash-grid>
    `,
  }),
};

/** The tile answers its own size: narrow tiles drop the comparison wording, short ones the visual and caption. */
export const Density: Story = {
  render: () => ({
    props: { half },
    template: `
      <div style="display:flex;gap:16px;align-items:flex-start;flex-wrap:wrap">
        @for (size of [{ w: 180, h: 110 }, { w: 240, h: 150 }, { w: 320, h: 220 }]; track size.w) {
          <div [style.width.px]="size.w" [style.height.px]="size.h">
            <dash-kpi-tile label="On-time delivery" height="fill" [trend]="half.onTimeRate[0].data" [valueFormat]="{ style: 'percent', decimals: 1 }" status="warning" caption="Target 95%" />
          </div>
        }
      </div>
    `,
  }),
};
