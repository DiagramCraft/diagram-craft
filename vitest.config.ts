/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';
import yaml from '@rollup/plugin-yaml';

export default defineConfig({
  // @ts-ignore
  plugins: [tsconfigPaths(), yaml(), codspeedPlugin()],
  test: {
    exclude: ['**/*.spec.ts', '**/node_modules/**', '**/dist/**'],
    fakeTimers: {
      toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'queueMicrotask']
    }
  }
});
