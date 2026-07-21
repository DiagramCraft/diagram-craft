/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import yaml from '@rollup/plugin-yaml';
import codspeedPlugin from '@codspeed/vitest-plugin';

export default defineConfig({
  // @ts-ignore
  plugins: [yaml(), ...(!!process.env.CI ? [codspeedPlugin()] : [])],
  test: {
    environment: 'node',
    exclude: [
      '**/*.spec.ts',
      '**/node_modules/**',
      '**/dist/**',
      '**/e2e/**',
      '**/db/contract-tests/**',
      'examples/**',
      '.pnpm-store/**'
    ],
    fakeTimers: {
      toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'queueMicrotask']
    },
    css: false,
    pool: 'threads',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'json-summary'],
      reportsDirectory: './coverage'
    },
    reporters: ['dot'],
    // Keep application logging enabled while preventing expected test-time console output from
    // obscuring the test result. Logs remain visible when the application or server is run normally.
    onConsoleLog: () => false
  },
  resolve: {
    tsconfigPaths: true
  },
  build: {
    rolldownOptions: {
      transform: {
        dropLabels: ['DEBUG']
      }
    }
  }
});
