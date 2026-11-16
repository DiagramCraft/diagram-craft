import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { configureDemoMode } from '../config/demoMode';
import { configureAuthServices } from '../auth/authServices';
import { createDemoTokenService, demoPasswordHasher } from '../auth/demoAuthServices';
import { SqliteDatabase } from '../db/sqliteDatabase';
import { seedBootstrapData, validateBootstrapSeed } from '../db/bootstrapSeed';
import { MemoryStorage } from '../storage/memory';

/**
 * Builds the seed snapshot for the browser demo: a migrated and seeded SQLite image plus the
 * matching in-memory storage content. The demo Worker loads these instead of running migrations
 * and the seed on every start.
 *
 * Deliberately does not import `nodeSetup`: the demo uses the demo auth services, so the stored
 * password hashes verify in the browser.
 */

const outDir = fileURLToPath(new URL('../../../web/src/local/generated/', import.meta.url));

const toBase64 = (bytes: Uint8Array) => Buffer.from(bytes).toString('base64');

const main = async () => {
  configureDemoMode(true);
  configureAuthServices({
    passwordHasher: demoPasswordHasher,
    tokenService: createDemoTokenService()
  });

  const workDir = mkdtempSync(join(tmpdir(), 'ar-demo-snapshot-'));
  const dbPath = join(workDir, 'demo.sqlite');

  try {
    const db = new SqliteDatabase(dbPath);
    const storage = new MemoryStorage();

    console.log('Seeding demo dataset...');
    await seedBootstrapData(db, storage, { dataset: 'demo' });
    await validateBootstrapSeed(db);
    await db.core.close();

    // The Node build runs in WAL mode. Convert to a plain rollback-journal file so the image
    // is self-contained and loads cleanly into the in-memory WASM build.
    const raw = new Database(dbPath);
    raw.pragma('wal_checkpoint(TRUNCATE)');
    raw.pragma('journal_mode = DELETE');
    raw.close();

    mkdirSync(outDir, { recursive: true });
    const dbBytes = readFileSync(dbPath);
    writeFileSync(join(outDir, 'demo-seed.sqlite'), dbBytes);

    const files = Object.fromEntries(
      Object.entries(storage.exportSnapshot()).map(([key, value]) => [key, toBase64(value)])
    );
    writeFileSync(join(outDir, 'demo-storage.json'), JSON.stringify(files));

    console.log(
      `Wrote ${dbBytes.byteLength} bytes of SQLite and ${Object.keys(files).length} storage files to ${outDir}`
    );
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
};

main().catch(err => {
  console.error('Demo snapshot failed:', err);
  process.exit(1);
});
