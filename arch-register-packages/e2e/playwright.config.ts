import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './src/ui',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? 'github' : 'line',
  use: {
    baseURL: 'http://localhost:5175',
    trace: 'on-first-retry'
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      // API server: fresh SQLite DB seeded with test data on every run
      command: 'node --import tsx src/helpers/startServer.ts',
      url: 'http://localhost:3011/api/auth/config',
      reuseExistingServer: false,
      env: {
        DB_DRIVER: 'sqlite',
        SQLITE_PATH: '/tmp/ar-e2e-ui/test.sqlite',
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
      command: 'pnpm --filter @arch-register/web exec vite --config vite.config.e2e.js',
      url: 'http://localhost:5175',
      reuseExistingServer: false,
      timeout: 60_000
    }
  ]
});
