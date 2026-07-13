import type { StorybookConfig } from '@storybook/react-vite';

const config: StorybookConfig = {
  stories: [
    '../src/**/*.mdx',
    '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)',
    '../../packages/app-components/src/**/*.stories.@(js|jsx|mjs|ts|tsx)',
    '../../packages/app-components/src/**/*.mdx'
  ],
  addons: [
    '@storybook/addon-links',
    '@storybook/addon-onboarding',
    '@storybook/addon-docs'
  ],
  framework: {
    name: '@storybook/react-vite',
    options: {}
  },
  docs: {},
  typescript: {
    reactDocgen: 'react-docgen-typescript',
    reactDocgenTypescriptOptions: {}
  },
  viteFinal: async (config) => {
    // Merge with existing vite config
    return {
      ...config,
      resolve: {
        ...config.resolve,
        dedupe: [...(config.resolve?.dedupe ?? []), '@platejs/core'],
        alias: {
          ...config.resolve?.alias
        }
      },
      css: {
        ...config.css,
        modules: {
          exportGlobals: true,
          localsConvention: 'camelCase'
        }
      }
    };
  }
};
export default config;
