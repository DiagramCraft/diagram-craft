import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import yaml from '@rollup/plugin-yaml';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const arServerPort = env['VITE_AR_SERVER_PORT'] ?? process.env['VITE_AR_SERVER_PORT'] ?? '3010';

  return {
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
    build: {
      manifest: true
    },
    server: {
      port: parseInt(process.env['PORT'] ?? '5174'),
      proxy: {
        '/api': `http://localhost:${arServerPort}`,
        '/ws': {
          target: `ws://localhost:${arServerPort}`,
          ws: true
        }
      }
    }
  };
});
