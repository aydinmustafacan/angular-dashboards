import type { StorybookConfig } from '@storybook/angular-vite';

const config: StorybookConfig = {
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(ts|mdx)'],
  addons: ['@storybook/addon-a11y', '@storybook/addon-docs'],
  // Only real inputs in the controls table — not the components' internal signals.
  framework: { name: '@storybook/angular-vite', options: { propsTable: 'inputs' } },
  docs: { defaultName: 'Docs' },
};
export default config;
