import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['../../nodeSetup.ts'],
    include: ['**/*.contract.test.ts'],
    testTimeout: 20000,
    hookTimeout: 20000,
    fileParallelism: true
  },
  resolve: {
    tsconfigPaths: true
  }
});
