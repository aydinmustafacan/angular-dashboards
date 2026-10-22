import type { Meta, StoryObj } from '@storybook/angular-vite';
import { DashDataTable } from './data-table';

const meta: Meta<DashDataTable> = {
  title: 'Building blocks/Data table',
  component: DashDataTable,
  parameters: {
    docs: {
      description: {
        component: 'The table view every chart can switch to (via `dash-chart-card`). Numeric columns align right with tabular figures; the header sticks while scrolling.',
      },
    },
  },
  args: {
    caption: 'Pallets handled per site',
    maxHeight: '360px',
    data: {
      columns: [
        { key: 'site', label: 'Site' },
        { key: 'pallets', label: 'Pallets', numeric: true },
        { key: 'docks', label: 'Docks', numeric: true },
      ],
      rows: [
        { site: 'Rotterdam DC', pallets: '4,820', docks: 24 },
        { site: 'Memphis Hub', pallets: '4,410', docks: 30 },
        { site: 'Singapore Gateway', pallets: '3,980', docks: 18 },
        { site: 'Leipzig', pallets: '3,120', docks: 16 },
        { site: 'Dallas Crossdock', pallets: '2,760', docks: 14 },
      ],
    },
  },
};
export default meta;

export const Default: StoryObj<DashDataTable> = {};
