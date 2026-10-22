import type { Meta, StoryObj } from '@storybook/angular-vite';
import { OperationsOverview } from '../../testing/src/operations-overview';

const meta: Meta<OperationsOverview> = {
  title: 'Dashboards/Operations overview',
  component: OperationsOverview,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Everything together: filters in one row above the charts scope every chart; KPI tiles, an actual-vs-forecast trend with capacity and peak season, a delay-cause donut with multi-select, stacked columns with a moving average, and a site ranking. The mode and on-time charts share a `syncGroup`, so their crosshairs move together. Every chart drills into its own side sheet.',
      },
    },
  },
  args: { latency: 450 },
};
export default meta;

export const Default: StoryObj<OperationsOverview> = {};
