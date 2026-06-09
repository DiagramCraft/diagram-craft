import { defineConfig } from 'vitest/config';
import type { Plugin } from 'vitest/config';

const stubViteOnlyImports: Plugin = {
  name: 'stub-vite-only-imports',
  load(id: string) {
    const clean = id.split('?')[0]!;
    if (clean.endsWith('.yaml') || clean.endsWith('.yml')) {
      return 'export default { stencils: [] }';
    }
    if (clean.endsWith('.css')) {
      return 'export default ""';
    }
    if (clean.endsWith('.svg')) {
      return 'export default ""';
    }
  }
};

export default defineConfig({
  plugins: [stubViteOnlyImports],
  test: {
    environment: 'node',
    include: ['src/api/**/*.test.ts'],
    testTimeout: 15000,
    hookTimeout: 15000
  },
  resolve: {
    tsconfigPaths: true
  }
});
