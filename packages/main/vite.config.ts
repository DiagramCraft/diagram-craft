/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import * as path from 'node:path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    fakeTimers: {
      toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'queueMicrotask']
    }
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: id => {
          if (id.includes('node_modules')) {
            return 'vendor';
          } else if (id.includes('sample/')) {
            return 'sample-data';
          } else if (id.includes('query')) {
            return 'query';
          }
        }
      }
    }
  },
  resolve: {
    alias: {
      '@diagram-craft/query': path.join(__dirname, '../../packages/query/src')
    }
  }
});
