import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideDashCharts } from 'ngx-dash-charts';

export const appConfig: ApplicationConfig = {
  providers: [provideBrowserGlobalErrorListeners(), provideDashCharts()],
};
