import type { Meta, StoryObj } from '@storybook/angular-vite';
import { moduleMetadata } from '@storybook/angular-vite';
import { JsonPipe } from '@angular/common';
import { DashWidget, DashWidgetBoard } from './widget-board';
import type { DashWidgetLayout } from './layout';
import { DashChartCard } from '../chart-card/chart-card';
import { DashKpiTile } from '../kpi-tile/kpi-tile';
import { DashPieChart } from '../pie-chart/pie-chart';
import { DashTrendChart } from '../trend-chart/trend-chart';
import { DashComboChart } from '../combo-chart/combo-chart';
import { half } from '../../stories/helpers';

const layout: DashWidgetLayout[] = [
  { id: 'shipments', kind: 'kpi', x: 0, y: 0, cols: 1, rows: 1 },
  { id: 'ontime', kind: 'kpi', x: 1, y: 0, cols: 1, rows: 1 },
  { id: 'transit', kind: 'kpi', x: 2, y: 0, cols: 1, rows: 1 },
  { id: 'claims', kind: 'kpi', x: 3, y: 0, cols: 1, rows: 1 },
  { id: 'trend', kind: 'chart', x: 0, y: 1, cols: 2, rows: 2 },
  { id: 'delays', kind: 'chart', x: 2, y: 1, cols: 2, rows: 3 },
  { id: 'modes', kind: 'wide', x: 0, y: 4, cols: 4, rows: 2 },
];

const meta: Meta<DashWidgetBoard> = {
  title: 'Building blocks/Widget board',
  component: DashWidgetBoard,
  decorators: [
    moduleMetadata({ imports: [JsonPipe, DashWidget, DashChartCard, DashKpiTile, DashPieChart, DashTrendChart, DashComboChart] }),
  ],
  parameters: {
    docs: {
      description: {
        component: `Drag-and-drop dashboard board built on **angular-gridster2**. The board is 4 units wide, and one unit is one KPI tile:

| Kind | Size | Per row |
| --- | --- | --- |
| \`kpi\` | 1 × 1 | 4 |
| \`chart\` | 2 wide, 2–3 tall | 2 |
| \`wide\` | 4 wide, 2–3 tall | 1 |

Turn on \`editing\` to drag widgets (anywhere on the widget) and to resize charts from the bottom handle. Same-sized widgets swap places. A drop that needs room the target row doesn't have snaps back, and the board compacts upwards so it never has holes. With the keyboard, focus a widget and use the arrow keys, or use its move menu. Outside editing, widgets behave normally: hover, click and drill down.

Bind \`[(layout)]\` to save the arrangement anywhere, or set \`persistKey\` to keep it in localStorage.`,
      },
    },
  },
  args: { editing: true, rowHeight: 160, gap: 16, stackBelow: 640, persistKey: null },
  render: (args) => ({
    props: { ...args, layout: structuredClone(layout), half },
    template: `
      <dash-widget-board [(layout)]="layout" [editing]="editing" [rowHeight]="rowHeight" [gap]="gap" [stackBelow]="stackBelow" [persistKey]="persistKey">
        <ng-template dashWidget="shipments" dashWidgetLabel="Shipments">
          <dash-kpi-tile label="Shipments last week" height="fill" [trend]="half.totalShipments" />
        </ng-template>
        <ng-template dashWidget="ontime" dashWidgetLabel="On-time delivery">
          <dash-kpi-tile label="On-time delivery" height="fill" [trend]="half.onTimeRate[0].data" [valueFormat]="{ style: 'percent', decimals: 1 }" status="warning" />
        </ng-template>
        <ng-template dashWidget="transit" dashWidgetLabel="Transit time">
          <dash-kpi-tile label="Average transit time" height="fill" [trend]="half.transitDays" [valueFormat]="{ style: 'unit', unit: 'day', decimals: 1 }" [upIsGood]="false" />
        </ng-template>
        <ng-template dashWidget="claims" dashWidgetLabel="Damage claims">
          <dash-kpi-tile label="Damage claims" height="fill" [trend]="half.damageClaims" [upIsGood]="false" />
        </ng-template>
        <ng-template dashWidget="trend" dashWidgetLabel="Weekly shipments">
          <dash-chart-card heading="Weekly shipments">
            <dash-trend-chart label="Weekly shipments" height="fill" [series]="half.shipmentsVsForecast" />
          </dash-chart-card>
        </ng-template>
        <ng-template dashWidget="delays" dashWidgetLabel="Delay causes">
          <dash-chart-card heading="Why shipments ran late">
            <dash-pie-chart label="Delay causes" height="fill" legendPosition="bottom" [data]="half.delayCauses" />
          </dash-chart-card>
        </ng-template>
        <ng-template dashWidget="modes" dashWidgetLabel="Shipments by mode">
          <dash-chart-card heading="Shipments by transport mode">
            <dash-combo-chart label="Shipments by transport mode" height="fill" [series]="half.shipmentsWithAverage" />
          </dash-chart-card>
        </ng-template>
      </dash-widget-board>
      <details style="margin-top:24px;color:var(--dash-ink-2)">
        <summary>Current layout</summary>
        <pre style="font-size:12px">{{ layout | json }}</pre>
      </details>
    `,
  }),
};
export default meta;
type Story = StoryObj<DashWidgetBoard>;

/** Drag widgets, resize charts from the bottom handle, or focus one and use the arrow keys. */
export const Editing: Story = {};

/** Outside edit mode the board is a plain dashboard: charts are fully interactive. */
export const Viewing: Story = { args: { editing: false } };

/** Saved to localStorage under `persistKey`. Rearrange, reload the story, and the layout is kept. */
export const Persisted: Story = { args: { persistKey: 'dash-story-board-layout' } };
