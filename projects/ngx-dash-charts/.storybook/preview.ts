import { provideZonelessChangeDetection } from '@angular/core';
import { applicationConfig, type Preview } from '@storybook/angular-vite';
import { provideDashCharts } from '../src/public-api';

const preview: Preview = {
  decorators: [
    applicationConfig({ providers: [provideZonelessChangeDetection(), provideDashCharts()] }),
    (story, context) => {
      const theme = context.globals['theme'] as string;
      if (theme === 'system') delete document.documentElement.dataset['theme'];
      else document.documentElement.dataset['theme'] = theme;
      return story();
    },
  ],
  globalTypes: {
    theme: {
      description: 'Colour scheme',
      toolbar: {
        title: 'Theme',
        icon: 'mirror',
        items: [
          { value: 'light', title: 'Light' },
          { value: 'dark', title: 'Dark' },
          { value: 'system', title: 'Follow OS' },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: { theme: 'light' },
  parameters: {
    layout: 'padded',
    controls: {
      expanded: true,
      matchers: { color: /(background|color)$/i, date: /Date$/i },
    },
    backgrounds: { disable: true },
    a11y: { test: 'todo' },
    options: {
      storySort: {
        order: ['Introduction', 'Dashboards', 'Charts', 'Building blocks'],
      },
    },
  },
};

export default preview;
