import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';
import type { DatabaseAdapter } from './database.js';
import { runPostgresMigrations } from './migrate.js';
import { normalizePostgresError, type PostgresSqlClient } from './postgresBase.js';
import { PostgresAuditDatabase } from './postgresAudit.js';
import { PostgresCatalogDatabase } from './postgresCatalog.js';
import { PostgresIdentityAuthDatabase } from './postgresIdentityAuth.js';
import { PostgresProjectsFilesDatabase } from './postgresProjectsFiles.js';
import { PostgresWorkspaceAdminDatabase } from './postgresWorkspaceAdmin.js';
import { PostgresAiDatabase } from './postgresAi.js';
import { SERVER_DEFAULTS } from '../constants.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const schemaPath = join(__dirname, 'schema.postgres.sql');

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
      connect_timeout: SERVER_DEFAULTS.DB_CONNECT_TIMEOUT
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
          await this.sql`DROP TABLE IF EXISTS schema_migrations CASCADE`;
          await this.sql`DROP TABLE IF EXISTS ai_message CASCADE`;
          await this.sql`DROP TABLE IF EXISTS ai_conversation CASCADE`;
          await this.sql`DROP TABLE IF EXISTS workspace_ai_config CASCADE`;
          await this.sql`DROP TABLE IF EXISTS workspace_enum CASCADE`;
          await this.sql`DROP TABLE IF EXISTS oidc_auth_state CASCADE`;
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
