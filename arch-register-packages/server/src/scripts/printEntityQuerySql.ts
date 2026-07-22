// Dev CLI: prints the SQL a structured EntityQuery (specs/QUERY_LANGUAGE.md §5, #2326) compiles
// to, for one or both dialects. Not wired into any endpoint — a debugging aid for reviewing what
// entityQueryIRCompiler.ts actually produces, and for spotting Postgres/SQLite divergence.
//
// Usage:
//   node --import tsx src/scripts/printEntityQuerySql.ts < query.json
//   node --import tsx src/scripts/printEntityQuerySql.ts --file query.json --dialect sqlite
//   node --import tsx src/scripts/printEntityQuerySql.ts --file query.json --schemas schemas.json
//   node --import tsx src/scripts/printEntityQuerySql.ts --file query.json --no-validate
import { readFile } from 'node:fs/promises';
import type { EntityQuery } from '@arch-register/api-types/entityQueryIR';
import type { SchemaDbResult } from '../domain/catalog/db/catalogDatabase';
import {
  validateEntityQueryIR,
  type SchemaCatalog
} from '../domain/catalog/entityQueryIRValidator';
import {
  compileEntityQueryIR,
  type EntityQueryDialect
} from '../domain/catalog/entityQueryIRCompiler';

const readStdin = async (): Promise<string> => {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString('utf8');
};

const parseArgs = (argv: string[]) => {
  const args: {
    file?: string;
    schemas?: string;
    dialect?: EntityQueryDialect;
    workspace: string;
    validate: boolean;
  } = {
    workspace: 'workspace-1',
    validate: true
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--file') args.file = argv[++i];
    else if (arg === '--schemas') args.schemas = argv[++i];
    else if (arg === '--dialect') args.dialect = argv[++i] as EntityQueryDialect;
    else if (arg === '--workspace') args.workspace = argv[++i]!;
    else if (arg === '--no-validate') args.validate = false;
  }
  return args;
};

const loadSchemaCatalog = async (path: string | undefined): Promise<SchemaCatalog> => {
  if (!path) return new Map();
  const raw = JSON.parse(await readFile(path, 'utf8')) as SchemaDbResult[];
  return new Map(raw.map(schema => [schema.id, schema]));
};

const printCompiled = (
  label: string,
  query: EntityQuery,
  schemas: SchemaCatalog,
  workspace: string,
  dialect: EntityQueryDialect
) => {
  const { sql, params } = compileEntityQueryIR(query, schemas, dialect, workspace);
  console.log(`-- ${label} --`);
  console.log(sql.trim());
  console.log(`params: ${JSON.stringify(params)}`);
  console.log();
};

const main = async () => {
  const args = parseArgs(process.argv.slice(2));
  const raw = args.file ? await readFile(args.file, 'utf8') : await readStdin();
  const query = JSON.parse(raw) as EntityQuery;
  const schemas = await loadSchemaCatalog(args.schemas);

  if (args.validate) {
    const validation = validateEntityQueryIR(query, schemas);
    if (!validation.ok) {
      console.error('Query is invalid:');
      for (const error of validation.errors) {
        console.error(`  [${error.path.join('.')}] ${error.message}`);
      }
      console.error('(pass --no-validate to compile anyway)');
      process.exit(1);
    }
  }

  const dialects: EntityQueryDialect[] = args.dialect ? [args.dialect] : ['postgres', 'sqlite'];
  for (const dialect of dialects) {
    printCompiled(dialect, query, schemas, args.workspace, dialect);
  }
};

main().catch(error => {
  console.error(error);
  process.exit(1);
});
