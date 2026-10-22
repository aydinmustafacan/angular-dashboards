import { EnvironmentProviders, makeEnvironmentProviders } from '@angular/core';
import { provideEchartsCore } from 'ngx-echarts';
import * as echarts from 'echarts/core';
import { BarChart, LineChart, PieChart } from 'echarts/charts';
import {
  AriaComponent,
  DataZoomComponent,
  GridComponent,
  LegendComponent,
  MarkAreaComponent,
  MarkLineComponent,
  TooltipComponent,
} from 'echarts/components';
import { LabelLayout, UniversalTransition } from 'echarts/features';
import { CanvasRenderer, SVGRenderer } from 'echarts/renderers';

echarts.use([
  BarChart,
  LineChart,
  PieChart,
  AriaComponent,
  DataZoomComponent,
  GridComponent,
  LegendComponent,
  MarkAreaComponent,
  MarkLineComponent,
  TooltipComponent,
  LabelLayout,
  UniversalTransition,
  CanvasRenderer,
  SVGRenderer,
]);

/**
 * Registers the tree-shaken ECharts build used by every `dash-*` chart.
 *
 * ```ts
 * bootstrapApplication(App, { providers: [provideDashCharts()] });
 * ```
 */
export function provideDashCharts(): EnvironmentProviders {
  return makeEnvironmentProviders([provideEchartsCore({ echarts })]);
}
