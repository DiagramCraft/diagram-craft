/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';
import yaml from '@rollup/plugin-yaml';
import codspeedPlugin from '@codspeed/vitest-plugin';

export default defineConfig({
  // @ts-ignore
  plugins: [tsconfigPaths(), yaml(), ...(!!process.env.CI ? [codspeedPlugin()] : [])],
  test: {
    environment: 'node',
    exclude: ['**/*.spec.ts', '**/node_modules/**', '**/dist/**'],
    fakeTimers: {
      toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'queueMicrotask']
    },
    css: false,
    pool: 'threads',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'json-summary'],
      reportsDirectory: './coverage'
    }
  },
  esbuild: {
    dropLabels: ['DEBUG']
  }
});
