import { configureDemoMode } from '@arch-register/server/config/demoMode';
import { configureAuthServices } from '@arch-register/server/auth/authServices';
import {
  createDemoTokenService,
  demoPasswordHasher
} from '@arch-register/server/auth/demoAuthServices';
import { SqliteDatabase } from '@arch-register/server/db/sqliteDatabase';
import { seedBootstrapData } from '@arch-register/server/db/bootstrapSeed';
import { MemoryStorage } from '@arch-register/server/storage/memory';
import { createApp } from '@arch-register/server/app';

/**
 * Builds the in-browser server: demo auth services, WASM SQLite (in-memory, via the
 * `better-sqlite3` alias) and in-memory storage, seeded with the demo dataset.
 * Order matters: demo mode and auth services must be configured before seeding.
 */
export const createLocalServer = async () => {
  configureDemoMode(true);
  configureAuthServices({
    passwordHasher: demoPasswordHasher,
    tokenService: createDemoTokenService()
  });

  const db = new SqliteDatabase(':memory:');
  const storage = new MemoryStorage();
  await seedBootstrapData(db, storage, { dataset: 'demo' });

  const { app, dispose } = createApp(db, storage, {
    // AI is disabled in the demo
    routeOverrides: { aiChat: { resolveAiConfigImpl: async () => null } }
  });

  return { fetch: (req: Request) => app.fetch(req), db, storage, dispose };
};
