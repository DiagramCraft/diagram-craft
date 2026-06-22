import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import yaml from '@rollup/plugin-yaml';

const AR_SERVER_PORT = process.env['VITE_AR_SERVER_PORT'] ?? '3010';

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
      '/api': `http://localhost:${AR_SERVER_PORT}`,
      '/ws': {
        target: `ws://localhost:${AR_SERVER_PORT}`,
        ws: true
      }
    }
  }
});
