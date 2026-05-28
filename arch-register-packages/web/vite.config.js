import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import yaml from '@rollup/plugin-yaml';

export default defineConfig({
  plugins: [react(), yaml()],
  resolve: {
    tsconfigPaths: true
  },
  css: {
    modules: {
      exportGlobals: true,
      localsConvention: 'camelCase'
    }
  },
  server: {
    port: 5174,
    proxy: {
      '/api': 'http://localhost:3010',
      '/ws': {
        target: 'ws://localhost:3010',
        ws: true
      }
    }
  }
});
