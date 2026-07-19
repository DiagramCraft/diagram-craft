import 'dotenv/config';
import { createDatabase } from '../db/factory';
import { seedBootstrapData, validateBootstrapSeed } from '../db/bootstrapSeed';
import { createStorage } from '../storage/storage';
import { hasBootstrapAiFlag, resolveBootstrapAiConfig } from './bootstrapAi';

async function main() {
  const bootstrapAiConfig = hasBootstrapAiFlag(process.argv.slice(2))
    ? resolveBootstrapAiConfig()
    : undefined;

  console.log('Bootstrapping database...');
  const db = await createDatabase({ initialize: false });
  const storage = createStorage();

  console.log('Resetting schema...');
  await db.core.reset();
  console.log('Schema created.');

  console.log('Seeding data...');
  await seedBootstrapData(db, storage, { aiConfig: bootstrapAiConfig });
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
