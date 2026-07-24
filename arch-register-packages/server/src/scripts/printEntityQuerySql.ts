// Dev CLI: prints the SQL a structured EntityQuery (specs/QUERY_LANGUAGE.md §5, #2326) compiles
// to, for one or both dialects — or, with `--input text`, parses a text query (specs/QUERY_LANGUAGE.md
// §4, #2329) into that IR first. Not wired into any endpoint — a debugging aid for reviewing what
// entityQueryIRCompiler.ts/entityQueryTextCompiler.ts actually produce, and for spotting
// Postgres/SQLite divergence.
//
// Usage:
//   node --import tsx src/scripts/printEntityQuerySql.ts < query.json
//   node --import tsx src/scripts/printEntityQuerySql.ts --file query.json --dialect sqlite
//   node --import tsx src/scripts/printEntityQuerySql.ts --file query.json --schemas schemas.json
//   node --import tsx src/scripts/printEntityQuerySql.ts --file query.json --no-validate
//   node --import tsx src/scripts/printEntityQuerySql.ts --file query.json --raw
//   node --import tsx src/scripts/printEntityQuerySql.ts --input text --file query.txt --schemas schemas.json --enums enums.json
//   node --import tsx src/scripts/printEntityQuerySql.ts --input text --file query.txt --schemas schemas.json --output ir
//   node --import tsx src/scripts/printEntityQuerySql.ts --file query.json --schemas schemas.json --output text
import { readFile } from 'node:fs/promises';
import type { EntityQuery } from '@arch-register/api-types/entityQueryIR';
import type { SchemaDbResult, WorkspaceEnumDbResult } from '../domain/catalog/db/catalogDatabase';
import {
  validateEntityQueryIR,
  type SchemaCatalog
} from '../domain/catalog/entityQueryIRValidator';
import {
  compileEntityQueryIR,
  type EntityQueryDialect
} from '../domain/catalog/entityQueryIRCompiler';
import {
  parseEntityQueryText,
  printEntityQueryText,
  type EnumCatalog
} from '../domain/catalog/entityQueryTextCompiler';
import { formatCompiledSqlForDisplay } from './sqlDisplayFormat';

const readStdin = async (): Promise<string> => {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString('utf8');
};

type InputMode = 'ir' | 'text';
type OutputMode = 'sql' | 'ir' | 'text';

const parseArgs = (argv: string[]) => {
  const args: {
    file?: string;
    schemas?: string;
    enums?: string;
    dialect?: EntityQueryDialect;
    workspace: string;
    validate: boolean;
    raw: boolean;
    input: InputMode;
    output: OutputMode;
  } = {
    workspace: 'workspace-1',
    validate: true,
    raw: false,
    input: 'ir',
    output: 'sql'
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--file') args.file = argv[++i];
    else if (arg === '--schemas') args.schemas = argv[++i];
    else if (arg === '--enums') args.enums = argv[++i];
    else if (arg === '--dialect') args.dialect = argv[++i] as EntityQueryDialect;
    else if (arg === '--workspace') args.workspace = argv[++i]!;
    else if (arg === '--no-validate') args.validate = false;
    else if (arg === '--raw') args.raw = true;
    else if (arg === '--input') args.input = argv[++i] as InputMode;
    else if (arg === '--output') args.output = argv[++i] as OutputMode;
  }
  return args;
};

const loadSchemaCatalog = async (path: string | undefined): Promise<SchemaCatalog> => {
  if (!path) return new Map();
  const raw = JSON.parse(await readFile(path, 'utf8')) as SchemaDbResult[];
  return new Map(raw.map(schema => [schema.id, schema]));
};

const loadEnumCatalog = async (path: string | undefined): Promise<EnumCatalog> => {
  if (!path) return new Map();
  const raw = JSON.parse(await readFile(path, 'utf8')) as WorkspaceEnumDbResult[];
  return new Map(raw.map(enumDef => [enumDef.id, enumDef]));
};

const printCompiled = (
  label: string,
  query: EntityQuery,
  schemas: SchemaCatalog,
  workspace: string,
  dialect: EntityQueryDialect,
  raw: boolean
) => {
  const { sql, params } = compileEntityQueryIR(query, schemas, dialect, workspace);
  console.log(`-- ${label} --`);
  console.log(raw ? sql.trim() : formatCompiledSqlForDisplay(sql));
  console.log(`params: ${JSON.stringify(params)}`);
  console.log();
};

const main = async () => {
  const args = parseArgs(process.argv.slice(2));
  const raw = args.file ? await readFile(args.file, 'utf8') : await readStdin();
  const schemas = await loadSchemaCatalog(args.schemas);

  let query: EntityQuery;
  if (args.input === 'text') {
    const enums = await loadEnumCatalog(args.enums);
    const result = parseEntityQueryText(raw, schemas, enums);
    if (!result.ok) {
      console.error('Text query failed to parse:');
      for (const error of result.errors) {
        console.error(`  [offset ${error.offset}] ${error.message}`);
      }
      process.exit(1);
    }
    query = result.query;
  } else {
    query = JSON.parse(raw) as EntityQuery;
  }

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

  if (args.output === 'ir') {
    console.log(JSON.stringify(query, null, 2));
    return;
  }
  if (args.output === 'text') {
    console.log(printEntityQueryText(query, schemas));
    return;
  }

  const dialects: EntityQueryDialect[] = args.dialect ? [args.dialect] : ['postgres', 'sqlite'];
  for (const dialect of dialects) {
    printCompiled(dialect, query, schemas, args.workspace, dialect, args.raw);
  }
};

main().catch(error => {
  console.error(error);
  process.exit(1);
});
