import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';
import { seededUserAuthStatePath } from './src/ui/support/authState';

const packageDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(packageDir, '../..');
const webPackageDir = resolve(packageDir, '../web');
const serverSetupPath = resolve(packageDir, '../server/src/serverSetup.mjs');

const e2eDriver = process.env['E2E_DB_DRIVER'] ?? 'sqlite';
const dbEnv: Record<string, string> =
  e2eDriver === 'postgres'
    ? { DB_DRIVER: 'postgres', DATABASE_URL: process.env['DATABASE_URL'] ?? '' }
    : { DB_DRIVER: 'sqlite', SQLITE_PATH: '/tmp/ar-e2e-ui/test.sqlite' };

export default defineConfig({
  testDir: './src/ui',
  globalSetup: './global.setup.ts',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:5175',
    trace: 'on-first-retry',
    storageState: seededUserAuthStatePath
  },
  projects: [
    { name: 'chromium', testMatch: /specs\/.*\.spec\.ts/, use: { ...devices['Desktop Chrome'] } }
  ],
  webServer: [
    {
      // API server: fresh SQLite DB seeded with test data on every run
      command: `node --import tsx --import ${serverSetupPath} src/helpers/startServer.ts`,
      cwd: packageDir,
      url: 'http://localhost:3011/api/auth/config',
      reuseExistingServer: false,
      env: {
        ...dbEnv,
        JWT_SECRET: 'e2e-test-secret-must-be-at-least-32-chars!!',
        AUTH_MODE: 'local',
        PORT: '3011',
        STORAGE_BACKEND: 'fs',
        STORAGE_FS_BASE: '/tmp/ar-e2e-ui-storage'
      }
    },
    {
      // Web dev server: separate port (5175) and dedicated config that proxies to 3011.
      // This avoids any conflict with a locally running dev server on 5174/3010.
      command: 'pnpm exec vite --config vite.config.e2e.js',
      cwd: webPackageDir,
      url: 'http://localhost:5175',
      reuseExistingServer: false,
      timeout: 60_000,
      env: {
        ...process.env,
        PNPM_WORKSPACE_DIR: repoRoot
      }
    }
  ]
});
