import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@diagram-craft/app-components': path.resolve(__dirname, '../../packages/app-components/src'),
      '@diagram-craft/utils': path.resolve(__dirname, '../../packages/utils/src')
    }
  },
  css: {
    modules: {
      localsConvention: 'camelCase'
    }
  },
  server: {
    proxy: {
      '/api': 'http://localhost:3010'
    }
  }
});
