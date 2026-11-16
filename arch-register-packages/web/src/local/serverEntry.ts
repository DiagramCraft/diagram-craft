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
import { clearSnapshot, currentSnapshotVersion, loadSnapshot } from './snapshotStore';

/**
 * Builds the in-browser server: demo auth services, WASM SQLite (in-memory, via the
 * `better-sqlite3` alias) and in-memory storage, migrated and seeded with the demo dataset.
 * Order matters: demo mode and auth services must be configured before seeding.
 */
export const createLocalServer = async () => {
  const timings: [string, number][] = [];
  const startedAt = performance.now();
  let phaseStart = startedAt;
  const lap = (name: string) => {
    const now = performance.now();
    timings.push([name, now - phaseStart]);
    phaseStart = now;
  };

  configureDemoMode(true);
  configureAuthServices({
    passwordHasher: demoPasswordHasher,
    tokenService: createDemoTokenService()
  });

  const storage = new MemoryStorage();
  let db: SqliteDatabase | undefined;

  const stored = await loadSnapshot();
  lap('load stored snapshot');
  if (stored) {
    if (stored.version === currentSnapshotVersion()) {
      try {
        db = new SqliteDatabase(':memory:', stored.db);
        storage.importSnapshot(stored.files);
        lap('restore snapshot');
      } catch (e) {
        console.warn('[demo] stored snapshot could not be restored, starting fresh', e);
        db = undefined;
        storage.importSnapshot({});
      }
    }
    if (!db) await clearSnapshot();
  }

  const restored = !!db;
  if (!db) {
    db = new SqliteDatabase(':memory:');
    lap('create schema + migrations');

    await seedBootstrapData(db, storage, { dataset: 'demo' });
    lap('seed');
  }

  const { app, dispose } = createApp(db, storage, {
    // AI is disabled in the demo
    routeOverrides: { aiChat: { resolveAiConfigImpl: async () => null } }
  });
  lap('create app');

  const summary = timings.map(([name, ms]) => `${name}: ${ms.toFixed(0)} ms`).join(', ');
  console.info(
    `[demo] server ready in ${(performance.now() - startedAt).toFixed(0)} ms ` +
      `(${restored ? 'restored from snapshot' : 'fresh seed'}; ${summary})`
  );

  return { fetch: (req: Request) => app.fetch(req), db, storage, dispose };
};
