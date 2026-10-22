import type { Meta, StoryObj } from '@storybook/angular-vite';
import { argsToTemplate, moduleMetadata } from '@storybook/angular-vite';
import { fn } from 'storybook/test';
import { DashBarChart } from './bar-chart';
import { DashStatList } from '../stat-list/stat-list';
import { drillHelpers, half, quarter } from '../../stories/helpers';
import type { DashPointEvent } from '../core/types';
import type { SiteMeta } from '../../../testing/src/public-api';

const lastEight = half.shipmentsByMode.map((s) => ({ ...s, data: s.data.slice(-8) }));

const meta: Meta<DashBarChart> = {
  title: 'Charts/Bar chart',
  component: DashBarChart,
  decorators: [moduleMetadata({ imports: [DashStatList] })],
  parameters: {
    docs: {
      description: {
        component:
          'Grouped or stacked bars, vertical or horizontal. Each bar is its own hit target: hovering lifts it and dims its neighbours; the tooltip shows its value, share of the stack and change. Bars are capped at 24px thick with rounded data-ends.',
      },
    },
  },
  args: {
    label: 'Shipments by mode',
    series: lastEight,
    height: 320,
    orientation: 'vertical',
    stacked: false,
    showValues: 'auto',
    tooltipMode: 'item',
    loading: false,
    pointClick: fn(),
    pointHover: fn(),
  },
  argTypes: {
    orientation: { control: 'inline-radio', options: ['vertical', 'horizontal'] },
    showValues: { control: 'inline-radio', options: ['auto', 'show', 'hide'] },
    tooltipMode: { control: 'inline-radio', options: ['item', 'axis'] },
    legend: { control: 'inline-radio', options: ['auto', 'show', 'hide'] },
    tooltipTemplate: { control: false },
    drilldownTemplate: { control: false },
  },
};
export default meta;
type Story = StoryObj<DashBarChart>;

export const Grouped: Story = {};

export const Stacked: Story = { args: { stacked: true, series: quarter.shipmentsByMode } };

/** One tooltip per week listing every mode, instead of one per bar. */
export const StackedAxisTooltip: Story = {
  args: { stacked: true, series: quarter.shipmentsByMode, tooltipMode: 'axis' },
};

/** Horizontal ranking with values at the bar ends and a reference line. Click a site to drill in. */
export const HorizontalRanking: Story = {
  args: {
    label: 'Pallets handled per site, last week',
    series: half.throughputBySite,
    orientation: 'horizontal',
    granularity: 'category',
    thresholds: [{ value: 4000, label: 'Site target', status: 'good' }],
    height: 300,
  },
  render: (args) => ({
    props: {
      ...args,
      ...drillHelpers,
      siteStats: (ctx: DashPointEvent) => {
        const m = ctx.series?.meta as SiteMeta | undefined;
        return [
          { label: 'Pallets handled', value: ctx.series?.formatted ?? '–' },
          { label: 'Loading docks', value: String(m?.docks ?? '–') },
          { label: 'Site manager', value: m?.manager ?? '–' },
        ];
      },
    },
    template: `
      <dash-bar-chart ${argsToTemplate(args)} [drilldownTemplate]="site" />
      <ng-template #site let-ctx>
        <dash-stat-list [items]="siteStats(ctx)" [columns]="1" />
      </ng-template>
    `,
  }),
};
