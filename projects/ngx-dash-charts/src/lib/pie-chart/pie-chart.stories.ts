import type { Meta, StoryObj } from '@storybook/angular-vite';
import { argsToTemplate, moduleMetadata } from '@storybook/angular-vite';
import { fn } from 'storybook/test';
import { MatButtonModule } from '@angular/material/button';
import { DashPieChart } from './pie-chart';
import { DashStatList } from '../stat-list/stat-list';
import { drillHelpers, half } from '../../stories/helpers';

const meta: Meta<DashPieChart> = {
  title: 'Charts/Pie chart',
  component: DashPieChart,
  decorators: [moduleMetadata({ imports: [DashStatList, MatButtonModule] })],
  parameters: {
    docs: {
      description: {
        component:
          'Part-to-whole donut or pie. Hover a slice or legend row to read it in the centre. Click a slice to select it (`[(selected)]` is two-way bindable) and open its drill-down. Click a legend row to hide that slice and re-base every share. Slices past `maxSlices` fold into a neutral "Other" whose tooltip lists what it contains. Focus the chart and use ←/→ and Enter from the keyboard.',
      },
    },
  },
  args: {
    label: 'Delay causes',
    data: half.delayCauses,
    donut: true,
    height: 260,
    maxSlices: 6,
    sort: true,
    selectionMode: 'single',
    selected: [],
    legendPosition: 'side',
    sliceLabels: false,
    totalLabel: 'Delayed shipments',
    loading: false,
    pointClick: fn(),
    pointHover: fn(),
    selectedChange: fn(),
  },
  argTypes: {
    selectionMode: { control: 'inline-radio', options: ['single', 'multiple', 'none'] },
    legendPosition: { control: 'inline-radio', options: ['side', 'bottom', 'none'] },
    maxSlices: { control: { type: 'range', min: 2, max: 8 } },
    tooltipTemplate: { control: false },
    drilldownTemplate: { control: false },
  },
};
export default meta;
type Story = StoryObj<DashPieChart>;

/** Eight causes, six slices: the two smallest fold into "Other". */
export const DelayCauses: Story = {};

export const PieWithLabels: Story = {
  args: { donut: false, sliceLabels: true, legendPosition: 'none', data: half.shipmentsByRegion, label: 'Shipments by region', totalLabel: 'Shipments' },
};

/** Select several slices; the selection is a plain `string[]` you can bind to filters elsewhere. */
export const MultipleSelection: Story = {
  args: { selectionMode: 'multiple', selected: ['weather', 'customs'] },
  render: (args) => ({
    props: args,
    template: `
      <dash-pie-chart ${argsToTemplate(args)} [(selected)]="selected" />
      <p style="color:var(--dash-ink-2)">Selected: {{ selected.length ? selected.join(', ') : 'none' }}</p>
    `,
  }),
};

export const LegendBelow: Story = { args: { legendPosition: 'bottom', height: 240 } };

/** Click a cause to open its breakdown. */
export const WithDrilldown: Story = {
  render: (args) => ({
    props: { ...args, ...drillHelpers },
    template: `
      <dash-pie-chart ${argsToTemplate(args)} [drilldownTemplate]="cause" />
      <ng-template #cause let-ctx let-close="close">
        <dash-stat-list [items]="sliceStats(ctx)" />
        @if (ctx.children.length) {
          <h3 class="drill-heading">Included in Other</h3>
          <dash-stat-list [columns]="1" [items]="childStats(ctx)" />
        }
        <div class="drill-actions">
          <button matButton="tonal" type="button" (click)="close()">Done</button>
        </div>
      </ng-template>
    `,
  }),
};
