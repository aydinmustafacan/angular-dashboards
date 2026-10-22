import type { Meta, StoryObj } from '@storybook/angular-vite';
import { moduleMetadata } from '@storybook/angular-vite';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { DashChartCard } from './chart-card';
import { DashTrendChart } from '../trend-chart/trend-chart';
import { DashPieChart } from '../pie-chart/pie-chart';
import { half, quarter, year } from '../../stories/helpers';

const meta: Meta<DashChartCard> = {
  title: 'Building blocks/Chart card',
  component: DashChartCard,
  decorators: [moduleMetadata({ imports: [DashTrendChart, DashPieChart, MatButtonToggleModule] })],
  parameters: {
    docs: {
      description: {
        component:
          'Frames any dash chart with a heading, optional controls (`dashCardActions`), a loading bar and a menu to switch to an accessible table view or download PNG / CSV. The menu finds the chart inside it automatically.',
      },
    },
  },
  args: { heading: 'Weekly shipments', subheading: 'All modes, last 26 weeks', loading: false, menu: true },
};
export default meta;
type Story = StoryObj<DashChartCard>;

export const WithTrendChart: Story = {
  render: (args) => ({
    props: { ...args, half },
    template: `
      <dash-chart-card [heading]="heading" [subheading]="subheading" [loading]="loading" [menu]="menu">
        <dash-trend-chart [series]="half.shipmentsVsForecast" [thresholds]="[half.capacity]" [loading]="loading" label="Weekly shipments" />
      </dash-chart-card>
    `,
  }),
};

/** Controls in the header switch what the chart shows. Try the menu → "Show as table". */
export const WithControls: Story = {
  render: (args) => ({
    props: {
      ...args,
      ranges: { 13: quarter, 26: half, 52: year },
      range: 26,
    },
    template: `
      <dash-chart-card [heading]="heading" [subheading]="'All modes, last ' + range + ' weeks'">
        <mat-button-toggle-group dashCardActions hideSingleSelectionIndicator [value]="range" (change)="range = $event.value" aria-label="Period">
          <mat-button-toggle [value]="13">13 wk</mat-button-toggle>
          <mat-button-toggle [value]="26">26 wk</mat-button-toggle>
          <mat-button-toggle [value]="52">52 wk</mat-button-toggle>
        </mat-button-toggle-group>
        <dash-trend-chart [series]="ranges[range].shipmentsByMode" [stacked]="true" [area]="true" label="Shipments by mode" />
      </dash-chart-card>
    `,
  }),
};

export const Loading: Story = {
  args: { loading: true },
  render: WithTrendChart.render,
};

export const WithDonut: Story = {
  args: { heading: 'Delay causes', subheading: 'Last 26 weeks' },
  render: (args) => ({
    props: { ...args, half },
    template: `
      <div style="max-width:560px">
        <dash-chart-card [heading]="heading" [subheading]="subheading">
          <dash-pie-chart [data]="half.delayCauses" label="Delay causes" totalLabel="Delayed shipments" />
        </dash-chart-card>
      </div>
    `,
  }),
};
