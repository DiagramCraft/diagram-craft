import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import yaml from '@rollup/plugin-yaml';

// Dedicated Vite config for e2e tests.
// Uses port 5175 (avoids conflict with the regular dev server on 5174)
// and proxies API traffic to the e2e test server on port 3011.
export default defineConfig({
  plugins: [react(), yaml()],
  resolve: {
    dedupe: ['@platejs/core'],
    tsconfigPaths: true
  },
  css: {
    modules: {
      exportGlobals: true,
      localsConvention: 'camelCase'
    }
  },
  server: {
    port: 5175,
    proxy: {
      '/api': 'http://localhost:3011',
      '/ws': {
        target: 'ws://localhost:3011',
        ws: true
      }
    }
  }
});
