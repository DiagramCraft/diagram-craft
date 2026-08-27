import 'dotenv/config';
import { resolve } from 'node:path';
import type { DatabaseAdapter } from '../db/database';
import { createDatabase } from '../db/factory';
import { seedBootstrapData, validateBootstrapSeed } from '../db/bootstrapSeed';
import { recreatePostgresSchema, recreateSqliteDatabase } from '../db/maintenance/recreateDatabase';
import { DB_DEFAULTS } from '../constants';
import { createStorage } from '../storage/storage';
import { hasBootstrapAiFlag, resolveBootstrapAiConfig } from './bootstrapAi';

const resolveDataset = (args: readonly string[]): 'test' | 'demo' => {
  const flagIndex = args.indexOf('--dataset');
  if (flagIndex === -1) return 'demo';
  const value = args[flagIndex + 1];
  if (value !== 'test' && value !== 'demo') {
    throw new Error(`--dataset must be "test" or "demo", got "${value ?? ''}"`);
  }
  return value;
};

async function main() {
  const args = process.argv.slice(2);
  if (!args.includes('--reset')) {
    throw new Error('Bootstrap is destructive; rerun with --reset to confirm database recreation');
  }
  if (process.env['NODE_ENV'] !== 'development' && process.env['NODE_ENV'] !== 'test') {
    throw new Error('Destructive bootstrap requires NODE_ENV=development or NODE_ENV=test');
  }

  const dataset = resolveDataset(args);
  const bootstrapAiConfig = hasBootstrapAiFlag(args) ? resolveBootstrapAiConfig() : undefined;

  console.log('Bootstrapping database...');
  const driver = process.env['DB_DRIVER'] ?? DB_DEFAULTS.DRIVER;
  let db: DatabaseAdapter;
  if (driver === 'postgres') {
    const connectionString = process.env['DATABASE_URL'];
    if (!connectionString) throw new Error('DATABASE_URL environment variable is not set');
    const schema = process.env['POSTGRES_SCHEMA'] ?? 'public';
    await recreatePostgresSchema(connectionString, schema);
    db = await createDatabase({ initialize: false, postgresSchema: schema });
  } else if (driver === 'sqlite') {
    const filePath = resolve(process.env['SQLITE_PATH'] ?? DB_DEFAULTS.SQLITE_PATH);
    await recreateSqliteDatabase(filePath);
    db = await createDatabase();
  } else {
    throw new Error(`Unsupported DB_DRIVER: ${driver}`);
  }
  const storage = createStorage();

  console.log('Schema created.');

  console.log(`Seeding data (dataset: ${dataset})...`);
  await seedBootstrapData(db, storage, { aiConfig: bootstrapAiConfig, dataset });
  console.log('Seed data loaded.');

  console.log('Validating seed...');
  await validateBootstrapSeed(db);

  console.log('Bootstrap complete.');
  await db.core.close();
}

main().catch(err => {
  console.error('Bootstrap failed:', err);
  process.exit(1);
});
