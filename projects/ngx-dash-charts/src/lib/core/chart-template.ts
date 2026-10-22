/** Template shared by the x/y chart components. */
export const CARTESIAN_TEMPLATE = `
  <div class="dash-chart" [class.is-loading]="loading()">
    <div
      echarts
      class="dash-chart__canvas"
      [options]="option()"
      [initOpts]="initOpts()"
      (chartInit)="onChartInit($event)"
      (chartMouseOver)="onMouseOver($event)"
      (chartMouseOut)="onMouseOut()"
      (chartGlobalOut)="onGlobalOut()"
      (chartLegendSelectChanged)="onLegendChange($event)"
    ></div>
    @if (isEmpty()) {
      <p class="dash-chart__empty">{{ loading() ? 'Loading…' : emptyText() }}</p>
    }
    <p class="dash-sr-only" aria-live="polite">{{ announcement() }}</p>
  </div>
`;
