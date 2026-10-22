import type { Meta, StoryObj } from '@storybook/angular-vite';
import { argsToTemplate, moduleMetadata } from '@storybook/angular-vite';
import { fn } from 'storybook/test';
import { DashComboChart } from './combo-chart';
import { DashStatList } from '../stat-list/stat-list';
import { drillHelpers, half, quarter } from '../../stories/helpers';
import type { DashSeries } from '../core/types';

const modesWithAverage: DashSeries[] = [
  ...half.shipmentsByMode.map((s) => ({ ...s, type: 'bar' as const, stack: 'modes' })),
  { ...half.shipmentsWithAverage[1], slot: 7 },
];

const meta: Meta<DashComboChart> = {
  title: 'Charts/Combo chart',
  component: DashComboChart,
  decorators: [moduleMetadata({ imports: [DashStatList] })],
  parameters: {
    docs: {
      description: {
        component:
          'Columns and lines sharing **one** value axis. Give each series a `type` (`bar`, `line`, `area`) and optional `stack` id. Two measures on different scales belong in two charts — there is intentionally no second y-axis.',
      },
    },
  },
  args: {
    label: 'Weekly shipments',
    series: half.shipmentsWithAverage,
    height: 340,
    zoom: 'none',
    legend: 'auto',
    loading: false,
    pointClick: fn(),
    pointHover: fn(),
  },
  argTypes: {
    zoom: { control: 'inline-radio', options: ['none', 'inside', 'slider'] },
    legend: { control: 'inline-radio', options: ['auto', 'show', 'hide'] },
    tooltipTemplate: { control: false },
    drilldownTemplate: { control: false },
  },
};
export default meta;
type Story = StoryObj<DashComboChart>;

/** Weekly columns with a 4-week moving average to smooth out the noise. */
export const ColumnsWithAverage: Story = {};

/** Stacked columns by mode with the moving average of the total riding on top. */
export const StackedWithLine: Story = {
  args: { series: modesWithAverage, thresholds: [half.capacity], label: 'Shipments by mode' },
};

/** Thirteen weeks — few enough for markers on the line. Click a week to drill in. */
export const WithDrilldown: Story = {
  args: { series: quarter.shipmentsWithAverage, label: 'Last 13 weeks' },
  render: (args) => ({
    props: { ...args, ...drillHelpers },
    template: `
      <dash-combo-chart ${argsToTemplate(args)} [drilldownTemplate]="week" drilldownMode="dialog" />
      <ng-template #week let-ctx>
        <dash-stat-list [items]="pointStats(ctx)" />
        <h3 class="drill-heading">Operations</h3>
        <dash-stat-list [items]="weekStats(ctx)" />
      </ng-template>
    `,
  }),
};
