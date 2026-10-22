import type { Meta, StoryObj } from '@storybook/angular-vite';
import { argsToTemplate, moduleMetadata } from '@storybook/angular-vite';
import { fn } from 'storybook/test';
import { DashKpiTile } from './kpi-tile';
import { DashStatList } from '../stat-list/stat-list';
import { DashGrid, DashSpan } from '../dashboard-grid/dashboard-grid';
import { drillHelpers, half } from '../../stories/helpers';

const meta: Meta<DashKpiTile> = {
  title: 'Charts/KPI tile',
  component: DashKpiTile,
  decorators: [moduleMetadata({ imports: [DashStatList, DashGrid, DashSpan] })],
  parameters: {
    docs: {
      description: {
        component:
          'A headline number with its change and a 12+ point sparkline. The value and delta default to the last two trend points. `upIsGood` decides whether a rise is coloured as good or bad news. Status always pairs an icon with a word, never colour alone. Hover the sparkline to read any week; click a week (or the tile, for the latest) to drill in.',
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
    clickable: false,
    pointClick: fn(),
  },
  argTypes: {
    status: { control: 'inline-radio', options: [null, 'good', 'warning', 'serious', 'critical'] },
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
