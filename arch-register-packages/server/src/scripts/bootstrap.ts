import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_DIR = join(__dirname, '..', 'db');

const connectionString = process.env['DATABASE_URL'];
if (!connectionString) {
  console.error('ERROR: DATABASE_URL is not set');
  process.exit(1);
}

const sql = postgres(connectionString, { max: 1 });

async function main() {
  console.log('Bootstrapping database...');

  console.log('Dropping existing tables...');
  await sql`DROP TABLE IF EXISTS entity CASCADE`;
  await sql`DROP TABLE IF EXISTS entity_schema CASCADE`;
  await sql`DROP FUNCTION IF EXISTS set_updated_at CASCADE`;
  console.log('Tables dropped.');

  console.log('Creating schema...');
  const schemaSql = await readFile(join(DB_DIR, 'schema.sql'), 'utf8');
  await sql.unsafe(schemaSql);
  console.log('Schema created.');

  console.log('Seeding data...');
  const seedSql = await readFile(join(DB_DIR, 'seed.sql'), 'utf8');
  await sql.unsafe(seedSql);
  console.log('Seed data loaded.');

  console.log('Bootstrap complete.');
  await sql.end();
}

main().catch(err => {
  console.error('Bootstrap failed:', err);
  process.exit(1);
});
