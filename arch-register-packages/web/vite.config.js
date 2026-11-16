import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import yaml from '@rollup/plugin-yaml';
import { fileURLToPath } from 'node:url';

const local = rel => fileURLToPath(new URL(`./src/local/stubs/${rel}`, import.meta.url));
const server = rel => fileURLToPath(new URL(`../server/src/${rel}`, import.meta.url));

// In demo mode the h3/oRPC server runs in a browser Worker. Node-only modules are swapped for
// browser implementations or inert stubs so the Worker bundle contains no Node dependencies.
const demoAliases = [
  { find: /^better-sqlite3$/, replacement: server('db/wasm/betterSqlite3Shim.ts') },
  { find: /^\.\/sqliteSqlSource$/, replacement: server('db/sqliteSqlSource.browser.ts') },
  { find: /^node:path$/, replacement: local('nodePath.ts') },
  { find: /^node:crypto$/, replacement: local('nodeCrypto.ts') },
  { find: /^node:url$/, replacement: local('nodeUrl.ts') },
  { find: /^node:fs$/, replacement: local('nodeFs.ts') },
  { find: /^node:fs\/promises$/, replacement: local('nodeFsPromises.ts') },
  { find: /^node:http$/, replacement: local('nodeHttp.ts') },
  { find: /^node:https$/, replacement: local('nodeHttps.ts') },
  { find: /^node:net$/, replacement: local('nodeNet.ts') },
  { find: /^node:dns\/promises$/, replacement: local('nodeDnsPromises.ts') },
  { find: /^node:os$/, replacement: local('nodeOs.ts') },
  { find: /^node:util$/, replacement: local('nodeUtil.ts') },
  { find: /^node:events$/, replacement: local('nodeEvents.ts') },
  { find: /^archiver$/, replacement: local('archiver.ts') },
  { find: /^(unzipper|openid-client)$/, replacement: local('default-export.ts') }
];

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const demo = (env['VITE_DEMO_MODE'] ?? process.env['VITE_DEMO_MODE']) === 'true';
  const arServerPort = env['VITE_AR_SERVER_PORT'] ?? process.env['VITE_AR_SERVER_PORT'] ?? '3010';

  return {
    plugins: [react(), yaml()],
    // react-draggable (via react-grid-layout) reads process.env.DRAGGABLE_DEBUG unconditionally,
    // which throws in the browser since process isn't polyfilled without this.
    define: {
      'process.env': {}
    },
    worker: { format: 'es', plugins: () => [yaml()] },
    resolve: {
      alias: demo ? demoAliases : [],
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
