import type { Meta, StoryObj } from '@storybook/angular-vite';
import { argsToTemplate, moduleMetadata } from '@storybook/angular-vite';
import { fn } from 'storybook/test';
import { MatButtonModule } from '@angular/material/button';
import { DashTrendChart } from './trend-chart';
import { DashPieChart } from '../pie-chart/pie-chart';
import { DashStatList } from '../stat-list/stat-list';
import { drillHelpers, half, quarter, year } from '../../stories/helpers';

const meta: Meta<DashTrendChart> = {
  title: 'Charts/Trend chart',
  component: DashTrendChart,
  decorators: [moduleMetadata({ imports: [DashPieChart, DashStatList, MatButtonModule] })],
  parameters: {
    docs: {
      description: {
        component:
          'Lines and areas over weekly (or daily / monthly / categorical) x values. Hover anywhere for a crosshair tooltip with every series and its change vs. the previous period. Click a column — or focus the chart and use ←/→ then Enter — to emit `pointClick` and open the optional drill-down sheet. Legend entries toggle series.',
      },
    },
  },
  args: {
    label: 'Weekly shipments',
    series: half.shipmentsVsForecast,
    height: 340,
    granularity: 'auto',
    area: false,
    smooth: false,
    stacked: false,
    showEndLabels: false,
    zoom: 'none',
    legend: 'auto',
    showDelta: true,
    loading: false,
    patterns: false,
    renderer: 'canvas',
    pointClick: fn(),
    pointHover: fn(),
  },
  argTypes: {
    granularity: { control: 'inline-radio', options: ['auto', 'day', 'week', 'month', 'category'] },
    zoom: { control: 'inline-radio', options: ['none', 'inside', 'slider'] },
    legend: { control: 'inline-radio', options: ['auto', 'show', 'hide'] },
    renderer: { control: 'inline-radio', options: ['canvas', 'svg'] },
    drilldownMode: { control: 'inline-radio', options: ['sheet', 'dialog'] },
    tooltipTemplate: { control: false },
    drilldownTemplate: { control: false },
  },
};
export default meta;
type Story = StoryObj<DashTrendChart>;

/** Actuals against a dashed forecast that runs six weeks ahead, with the network's capacity line. */
export const ActualVsForecast: Story = {
  args: { thresholds: [half.capacity], yLabel: 'Shipments' },
};

/** Stacked areas show how each transport mode builds up the weekly total; the tooltip adds the total and each mode's share. */
export const StackedAreas: Story = {
  args: { series: half.shipmentsByMode, area: true, stacked: true, label: 'Shipments by mode' },
};

/** A full year with the peak season shaded. Drag to pan, Ctrl/⌘ + wheel or the slider to zoom. */
export const YearWithAnnotationsAndZoom: Story = {
  args: {
    series: year.shipmentsVsForecast.slice(0, 1),
    annotations: [year.peakSeason],
    thresholds: [year.capacity],
    zoom: 'slider',
    height: 380,
  },
};

/** Single series: no legend box — the title names it. The end label carries the latest value. */
export const SingleSeriesWithTarget: Story = {
  args: {
    label: 'On-time delivery',
    series: half.onTimeRate,
    thresholds: [half.onTimeTarget],
    yMin: 0.85,
    yMax: 1,
    showEndLabels: true,
    smooth: true,
  },
};

/** Click any week to open a side sheet built from your own template. The context is the same object `pointClick` emits. */
export const WithDrilldown: Story = {
  args: { series: half.shipmentsByMode, label: 'Shipments by mode', stacked: true, area: true },
  render: (args) => ({
    props: { ...args, ...drillHelpers },
    template: `
      <dash-trend-chart ${argsToTemplate(args)} [drilldownTemplate]="week" />
      <ng-template #week let-ctx let-close="close">
        <dash-stat-list [items]="pointStats(ctx)" />
        <h3 class="drill-heading">Mode split</h3>
        <dash-pie-chart [data]="pointSlices(ctx)" [height]="200" legendPosition="bottom" selectionMode="none" label="Mode split" />
        @if (weekStats(ctx).length) {
          <h3 class="drill-heading">Operations</h3>
          <dash-stat-list [items]="weekStats(ctx)" />
        }
        <div class="drill-actions">
          <button matButton="tonal" type="button" (click)="close()">Done</button>
        </div>
      </ng-template>
    `,
  }),
};

/** Replace the tooltip entirely with an `ng-template`. It receives the same context as clicks. */
export const CustomTooltip: Story = {
  args: { series: quarter.shipmentsByMode.slice(0, 2), label: 'Road and rail' },
  render: (args) => ({
    props: args,
    template: `
      <dash-trend-chart ${argsToTemplate(args)} [tooltipTemplate]="tip" />
      <ng-template #tip let-ctx>
        <strong>{{ ctx.xLabel }}</strong>
        @for (v of ctx.values; track v.seriesId) {
          <div style="display:flex;gap:12px;justify-content:space-between">
            <span>{{ v.seriesName }}</span><strong>{{ v.formatted }}</strong>
          </div>
        }
        <em style="color:var(--dash-muted)">Rendered from your template</em>
      </ng-template>
    `,
  }),
};

/** While reloading, the previous render is held at reduced opacity — no skeleton, no layout jump. */
export const Loading: Story = { args: { loading: true } };

export const Empty: Story = { args: { series: [], emptyText: 'No shipments in this period' } };

/** Hatched textures as a second identity channel — for colour-vision deficiency, print and forced-colours. */
export const Patterns: Story = {
  args: { series: half.shipmentsByMode, stacked: true, area: true, patterns: true, label: 'Shipments by mode' },
};
