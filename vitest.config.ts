/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    exclude: ['**/*.spec.ts', '**/node_modules/**', '**/dist/**'],
    fakeTimers: {
      toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'queueMicrotask']
    }
  }
});
