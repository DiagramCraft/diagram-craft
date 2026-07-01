import 'dotenv/config';
import { createDatabase } from '../db/factory';
import { seedBootstrapData, validateBootstrapSeed } from '../db/bootstrapSeed';
import { createStorage } from '../storage/storage';

async function main() {
  console.log('Bootstrapping database...');
  const db = await createDatabase({ initialize: false });
  const storage = createStorage();

  console.log('Resetting schema...');
  await db.core.reset();
  console.log('Schema created.');

  console.log('Seeding data...');
  await seedBootstrapData(db, storage);
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
