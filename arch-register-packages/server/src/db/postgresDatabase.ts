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
import { PostgresDiscussionDatabase } from '../domain/discussion/db/postgresDiscussion';
import { PostgresJobDatabase } from '../domain/jobs/db/postgresJobs';
import { PostgresExternalContentDatabase } from '../domain/external-content/db/postgresExternalContent';
import { PostgresWebhookDatabase } from '../domain/webhook/db/postgresWebhook';
import { createLogger } from '../utils/logger';

const __dirname = dirname(fileURLToPath(import.meta.url));
const schemaPath = join(__dirname, 'schema.postgres.sql');
const PGCRYPTO_EXISTS_NOTICE = 'extension "pgcrypto" already exists, skipping';
const logger = createLogger('postgres');

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
  readonly discussion: PostgresDiscussionDatabase;
  readonly jobs: PostgresJobDatabase;
  readonly externalContent: PostgresExternalContentDatabase;
  readonly webhook: PostgresWebhookDatabase;
  readonly core;

  private adapterFor(sql: PostgresSqlClient): DatabaseAdapter {
    const adapter = {
      workspace: new PostgresWorkspaceDatabase(sql),
      catalog: new PostgresCatalogDatabase(sql),
      view: new PostgresViewDatabase(sql),
      project: new PostgresProjectDatabase(sql),
      audit: new PostgresAuditDatabase(sql),
      watch: new PostgresWatchDatabase(sql),
      auth: new PostgresAuthDatabase(sql),
      ai: new PostgresAiDatabase(sql),
      discussion: new PostgresDiscussionDatabase(sql),
      jobs: new PostgresJobDatabase(sql),
      externalContent: new PostgresExternalContentDatabase(sql),
      webhook: new PostgresWebhookDatabase(sql)
    };
    let bound!: DatabaseAdapter;
    bound = {
      ...adapter,
      core: {
        driver: 'postgres',
        isTransaction: true,
        close: async () => {},
        reset: async () => {
          throw new Error('Cannot reset a transaction-bound database adapter');
        },
        transaction: async callback => callback(bound)
      }
    };
    return bound;
  }

  constructor(connectionString: string, schema?: string) {
    this.sql = postgres(connectionString, {
      max: SERVER_DEFAULTS.MAX_DB_CONNECTIONS,
      idle_timeout: SERVER_DEFAULTS.DB_IDLE_TIMEOUT,
      connect_timeout: SERVER_DEFAULTS.DB_CONNECT_TIMEOUT,
      ...(schema ? { connection: { search_path: schema } } : {}),
      onnotice: notice => {
        const message = notice.message ?? '';
        if (
          (notice.code === '42710' && message === PGCRYPTO_EXISTS_NOTICE) ||
          message.endsWith(' does not exist, skipping') ||
          message.startsWith('drop cascades to ')
        ) {
          return;
        }
        logger.info(message || 'PostgreSQL notice', notice);
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
    this.discussion = new PostgresDiscussionDatabase(this.sql);
    this.jobs = new PostgresJobDatabase(this.sql);
    this.externalContent = new PostgresExternalContentDatabase(this.sql);
    this.webhook = new PostgresWebhookDatabase(this.sql);

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
      },
      transaction: async <T>(callback: (db: DatabaseAdapter) => Promise<T>): Promise<T> =>
        (await this.sql.begin(async sql =>
          callback(this.adapterFor(sql as unknown as PostgresSqlClient))
        )) as unknown as T
    };
  }

  async initialize(): Promise<void> {
    await runPostgresMigrations(this.sql);
  }
}
