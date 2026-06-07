import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';
import type { DatabaseAdapter } from './database';
import { getMigrationTables, runPostgresMigrations } from './migrate';
import { normalizePostgresError, type PostgresSqlClient } from './postgresBase';
import { PostgresAuditDatabase } from './postgresAudit';
import { PostgresCatalogDatabase } from './postgresCatalog';
import { PostgresIdentityAuthDatabase } from './postgresIdentityAuth';
import { PostgresProjectsFilesDatabase } from './postgresProjectsFiles';
import { PostgresWorkspaceAdminDatabase } from './postgresWorkspaceAdmin';
import { PostgresAiDatabase } from './postgresAi';
import { SERVER_DEFAULTS } from '../constants';

const __dirname = dirname(fileURLToPath(import.meta.url));
const schemaPath = join(__dirname, 'schema.postgres.sql');
const PGCRYPTO_EXISTS_NOTICE = 'extension "pgcrypto" already exists, skipping';

export class PostgresDatabase implements DatabaseAdapter {
  private readonly sql: PostgresSqlClient;

  readonly workspaceAdmin: PostgresWorkspaceAdminDatabase;
  readonly catalog: PostgresCatalogDatabase;
  readonly projectsFiles: PostgresProjectsFilesDatabase;
  readonly audit: PostgresAuditDatabase;
  readonly identityAuth: PostgresIdentityAuthDatabase;
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

    this.workspaceAdmin = new PostgresWorkspaceAdminDatabase(this.sql);
    this.catalog = new PostgresCatalogDatabase(this.sql);
    this.projectsFiles = new PostgresProjectsFilesDatabase(this.sql);
    this.audit = new PostgresAuditDatabase(this.sql);
    this.identityAuth = new PostgresIdentityAuthDatabase(this.sql);
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
          await this.sql`DROP TABLE IF EXISTS project_file CASCADE`;
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
