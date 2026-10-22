import type { Meta, StoryObj } from '@storybook/angular-vite';
import { DashStatList } from './stat-list';

const meta: Meta<DashStatList> = {
  title: 'Building blocks/Stat list',
  component: DashStatList,
  parameters: {
    docs: { description: { component: 'Compact facts grid — made for drill-down panels and card footers.' } },
  },
  args: {
    columns: 2,
    items: [
      { label: 'Shipments', value: '11,842', detail: '▲ 4.2% vs. previous week', tone: 'good' },
      { label: 'On-time delivery', value: '93.1%', detail: '▼ 1.4% vs. previous week', tone: 'bad' },
      { label: 'Active lanes', value: '204' },
      { label: 'Busiest lane', value: 'Rotterdam → Leipzig' },
    ],
  },
  render: (args) => ({ props: args, template: `<div style="max-width:420px"><dash-stat-list [items]="items" [columns]="columns" /></div>` }),
};
export default meta;

export const TwoColumns: StoryObj<DashStatList> = {};
export const OneColumn: StoryObj<DashStatList> = { args: { columns: 1 } };
