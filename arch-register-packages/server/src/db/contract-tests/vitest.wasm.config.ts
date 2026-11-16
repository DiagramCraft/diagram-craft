import { configDefaults, defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

// Runs the SQLite contract tests against the WASM shim instead of native better-sqlite3
export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['../../nodeSetup.ts'],
    include: ['**/*.contract.test.ts'],
    exclude: [
      ...configDefaults.exclude,
      // The graph-diff traversal query nests CTEs deeper than the WASM build allows
      // ("VIEWs and/or subqueries nested too deep"); the limit is compile-time and cannot be raised.
      '**/entityTraversalGraphDiff.contract.test.ts'
    ],
    testTimeout: 20000,
    hookTimeout: 20000,
    fileParallelism: true
  },
  resolve: {
    tsconfigPaths: true,
    alias: {
      'better-sqlite3': fileURLToPath(new URL('../wasm/betterSqlite3Shim.ts', import.meta.url))
    }
  }
});
