import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';
import type { DatabaseAdapter } from './database';
import { getMigrationTables, runPostgresMigrations } from './migrate';
import { normalizePostgresError, type PostgresSqlClient } from './postgresBase';
import { PostgresAuditDatabase } from '../domain/audit/db/postgresAudit';
import { PostgresCatalogDatabase } from '../domain/catalog/db/postgresCatalog';
import { PostgresAuthDatabase } from '../domain/auth/db/postgresAuth';
import { PostgresProjectDatabase } from '../domain/project/db/postgresProject';
import { PostgresWorkspaceDatabase } from '../domain/workspace/db/postgresWorkspace';
import { PostgresAiDatabase } from '../domain/ai/db/postgresAi';
import { SERVER_DEFAULTS } from '../constants';
import { PostgresViewDatabase } from '../domain/catalog/db/postgresView';
import { PostgresWatchDatabase } from '../domain/watch/db/postgresWatch';

const __dirname = dirname(fileURLToPath(import.meta.url));
const schemaPath = join(__dirname, 'schema.postgres.sql');
const PGCRYPTO_EXISTS_NOTICE = 'extension "pgcrypto" already exists, skipping';

export class PostgresDatabase implements DatabaseAdapter {
  private readonly sql: PostgresSqlClient;

  readonly workspace: PostgresWorkspaceDatabase;
  readonly catalog: PostgresCatalogDatabase;
  readonly view: PostgresViewDatabase;
  readonly project: PostgresProjectDatabase;
  readonly audit: PostgresAuditDatabase;
  readonly watch: PostgresWatchDatabase;
  readonly auth: PostgresAuthDatabase;
  readonly ai: PostgresAiDatabase;
  readonly core;

  constructor(connectionString: string) {
    this.sql = postgres(connectionString, {
      max: SERVER_DEFAULTS.MAX_DB_CONNECTIONS,
      idle_timeout: SERVER_DEFAULTS.DB_IDLE_TIMEOUT,
      connect_timeout: SERVER_DEFAULTS.DB_CONNECT_TIMEOUT,
      onnotice: notice => {
        if (notice.code === '42710' && notice.message === PGCRYPTO_EXISTS_NOTICE) {
          return;
        }
        console.log(notice);
      }
    });

    this.workspace = new PostgresWorkspaceDatabase(this.sql);
    this.catalog = new PostgresCatalogDatabase(this.sql);
    this.view = new PostgresViewDatabase(this.sql);
    this.project = new PostgresProjectDatabase(this.sql);
    this.audit = new PostgresAuditDatabase(this.sql);
    this.watch = new PostgresWatchDatabase(this.sql);
    this.auth = new PostgresAuthDatabase(this.sql);
    this.ai = new PostgresAiDatabase(this.sql);

    this.core = {
      driver: 'postgres' as const,
      close: async () => {
        await this.sql.end();
      },
      reset: async () => {
        try {
          // Drop schema_migrations first to allow clean migration re-run
          await this.sql`DROP TABLE IF EXISTS schema_migrations CASCADE`;

          // Drop tables created by migrations (in reverse order)
          const migrationTables = await getMigrationTables('postgres');
          for (const table of migrationTables) {
            await this.sql`DROP TABLE IF EXISTS ${this.sql(table)} CASCADE`;
          }

          // Drop base schema tables
          await this.sql`DROP TABLE IF EXISTS ai_message CASCADE`;
          await this.sql`DROP TABLE IF EXISTS ai_conversation CASCADE`;
          await this.sql`DROP TABLE IF EXISTS workspace_ai_config CASCADE`;
          await this.sql`DROP TABLE IF EXISTS global_role_assignment CASCADE`;
          await this.sql`DROP TABLE IF EXISTS team_membership CASCADE`;
          await this.sql`DROP TABLE IF EXISTS workspace_member CASCADE`;
          await this.sql`DROP TABLE IF EXISTS workspace_role CASCADE`;
          await this.sql`DROP TABLE IF EXISTS users CASCADE`;
          await this.sql`DROP TABLE IF EXISTS audit_log CASCADE`;
          await this.sql`DROP TABLE IF EXISTS content_node CASCADE`;
          await this.sql`DROP TABLE IF EXISTS project CASCADE`;
          await this.sql`DROP TABLE IF EXISTS entity_grant CASCADE`;
          await this.sql`DROP TABLE IF EXISTS entity CASCADE`;
          await this.sql`DROP TABLE IF EXISTS entity_schema CASCADE`;
          await this.sql`DROP TABLE IF EXISTS workspace_lifecycle_state CASCADE`;
          await this.sql`DROP TABLE IF EXISTS workspace_owner CASCADE`;
          await this.sql`DROP TABLE IF EXISTS workspace CASCADE`;

          // Recreate base schema and run migrations
          const schemaSql = await readFile(schemaPath, 'utf8');
          await this.sql.unsafe(schemaSql);
          await runPostgresMigrations(this.sql);
        } catch (error) {
          throw normalizePostgresError(error);
        }
      }
    };
  }

  async initialize(): Promise<void> {
    await runPostgresMigrations(this.sql);
  }
}
