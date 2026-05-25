import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';
import type { ContainmentField, Entity, EntitySchema, ReferenceField, Workspace } from '../types.js';
import { decodeRefs } from '../types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_DIR = join(__dirname, '..', 'db');

const connectionString = process.env['DATABASE_URL'];
if (!connectionString) {
  console.error('ERROR: DATABASE_URL is not set');
  process.exit(1);
}

const sql = postgres(connectionString, { max: 1 });

type PostgresError = {
  code?: string;
  message?: string;
};

async function validate() {
  const workspaces = await sql<Workspace[]>`SELECT id, name FROM workspace`;
  const workspaceIds = new Set(workspaces.map(w => w.id));

  const schemas = await sql<EntitySchema[]>`SELECT id, workspace, name, fields FROM entity_schema`;
  const schemaMap = new Map(schemas.map(s => [`${s.workspace}:${s.id}`, s]));

  const entities = await sql<Entity[]>`SELECT id, workspace, slug, namespace, schema_id, data FROM entity`;
  const entityMap = new Map(entities.map(e => [`${e.workspace}:${e.id}`, e]));

  let errors = 0;

  for (const schema of schemas) {
    if (!workspaceIds.has(schema.workspace)) {
      console.error(`  [schema:${schema.id}] references unknown workspace '${schema.workspace}'`);
      errors++;
    }
  }

  for (const entity of entities) {
    if (!workspaceIds.has(entity.workspace)) {
      console.error(`  [${entity.workspace}:${entity.namespace}/${entity.slug}] references unknown workspace '${entity.workspace}'`);
      errors++;
      continue;
    }

    const schema = schemaMap.get(`${entity.workspace}:${entity.schema_id}`);
    if (!schema) {
      console.error(
        `  [${entity.workspace}:${entity.namespace}/${entity.slug}] references unknown schema '${entity.schema_id}'`
      );
      errors++;
      continue;
    }

    for (const field of schema.fields) {
      if (field.type !== 'reference' && field.type !== 'containment') continue;
      const f = field as ReferenceField | ContainmentField;

      const refs = decodeRefs(entity.data[f.id]);

      if (f.minCount > 0 && refs.length < f.minCount) {
        console.error(
          `  [${entity.namespace}/${entity.slug}] (${schema.name}): '${f.id}' requires ≥${f.minCount} ref(s), got ${refs.length}`
        );
        errors++;
      }

      if (f.maxCount !== -1 && refs.length > f.maxCount) {
        console.error(
          `  [${entity.namespace}/${entity.slug}] (${schema.name}): '${f.id}' allows ≤${f.maxCount} ref(s), got ${refs.length}`
        );
        errors++;
      }

      for (const ref of refs) {
        const target = entityMap.get(`${entity.workspace}:${ref}`);
        if (!target) {
          console.error(
            `  [${entity.workspace}:${entity.namespace}/${entity.slug}] (${schema.name}): '${f.id}' references unknown entity '${ref}'`
          );
          errors++;
        } else if (target.schema_id !== f.schemaId) {
          const targetSchema = schemaMap.get(`${target.workspace}:${target.schema_id}`);
          console.error(
            `  [${entity.workspace}:${entity.namespace}/${entity.slug}] (${schema.name}): '${f.id}' should reference ${
              schemaMap.get(`${entity.workspace}:${f.schemaId}`)?.name ?? f.schemaId
            } but got ${targetSchema?.name ?? target.schema_id}`
          );
          errors++;
        }
      }
    }
  }

  if (errors > 0) throw new Error(`Validation failed with ${errors} error(s)`);
  console.log(`  ${workspaces.length} workspaces, ${entities.length} entities validated against ${schemas.length} schemas — OK`);
}

async function main() {
  console.log('Bootstrapping database...');

  console.log('Dropping existing tables...');
  await sql`DROP TABLE IF EXISTS entity CASCADE`;
  await sql`DROP TABLE IF EXISTS entity_schema CASCADE`;
  await sql`DROP TABLE IF EXISTS workspace CASCADE`;
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

  console.log('Validating seed...');
  await validate();

  console.log('Bootstrap complete.');
  await sql.end();
}

main().catch(err => {
  const error = err as PostgresError;
  if (error.code === '42501') {
    console.error('Bootstrap failed: database user lacks permission to create objects in the target schema.');
    console.error('Grant CREATE and USAGE on schema public to the application user, for example:');
    console.error('  GRANT USAGE, CREATE ON SCHEMA public TO arch_register;');
    console.error('  ALTER SCHEMA public OWNER TO arch_register;');
    console.error('Original error:', err);
    process.exit(1);
  }

  console.error('Bootstrap failed:', err);
  process.exit(1);
});
