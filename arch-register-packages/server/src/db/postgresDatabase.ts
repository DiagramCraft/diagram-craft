import postgres from 'postgres';
import type { DatabaseAdapter } from './database';
import { runPostgresMigrations } from './migrate';
import { type PostgresSqlClient } from './postgresBase';
import { PostgresAuditDatabase } from '../domain/audit/db/postgresAudit';
import { PostgresCatalogDatabase } from '../domain/catalog/db/postgresCatalog';
import { PostgresAuthDatabase } from '../domain/auth/db/postgresAuth';
import { PostgresProjectDatabase } from '../domain/project/db/postgresProject';
import { PostgresWorkspaceDatabase } from '../domain/workspace/db/postgresWorkspace';
import { PostgresAiDatabase } from '../domain/ai/db/postgresAi';
import { SERVER_DEFAULTS } from '../constants';
import { PostgresViewDatabase } from '../domain/catalog/db/postgresView';
import { PostgresDashboardDatabase } from '../domain/dashboard/db/postgresDashboard';
import { PostgresPersonalDashboardDatabase } from '../domain/personalDashboard/db/postgresPersonalDashboard';
import { PostgresProjectDashboardDatabase } from '../domain/dashboard/db/postgresProjectDashboard';
import { PostgresWatchDatabase } from '../domain/watch/db/postgresWatch';
import { PostgresDiscussionDatabase } from '../domain/discussion/db/postgresDiscussion';
import { PostgresWikiCommentDatabase } from '../domain/wikiComments/db/postgresWikiComment';
import { PostgresJobDatabase } from '../domain/jobs/db/postgresJobs';
import { PostgresExternalContentDatabase } from '../domain/external-content/db/postgresExternalContent';
import { PostgresWebhookDatabase } from '../domain/webhook/db/postgresWebhook';
import { PostgresAutomationRuleDatabase } from '../domain/automation/db/postgresAutomationRule';
import { PostgresDocumentDatabase } from '../domain/document/db/postgresDocument';
import { PostgresGovernanceDatabase } from '../domain/governance/db/postgresGovernance';
import { PostgresGovernanceCaseConfigDatabase } from '../domain/governance/db/postgresGovernanceCaseConfig';
import { PostgresNotificationDatabase } from '../domain/notification/db/postgresNotification';
import { PostgresNotificationPreferenceDatabase } from '../domain/notification/db/postgresNotificationPreference';
import { PostgresNotificationDeliveryDatabase } from '../domain/notification/db/postgresNotificationDelivery';
import { PostgresEntityChangeDatabase } from '../domain/catalog/db/postgresEntityChange';
import { PostgresEntityDeprecationDatabase } from '../domain/catalog/db/postgresEntityDeprecation';
import { PostgresChangeCaseDatabase } from '../domain/catalog/db/postgresChangeCase';
import { PostgresExternalIdentityDatabase } from '../domain/externalIdentity/db/postgresExternalIdentity';
import { PostgresRelationDatabase } from '../domain/catalog/db/postgresRelation';
import { PostgresCurrencyRatesDatabase } from '../domain/currencyRates/db/postgresCurrencyRates';
import { PostgresContentReconciliationDatabase } from '../domain/project/db/postgresContentReconciliation';
import { PostgresArtifactDatabase } from '../domain/artifact/db/postgresArtifact';
import { createLogger } from '../utils/logger';

const PGCRYPTO_EXISTS_NOTICE = 'extension "pgcrypto" already exists, skipping';
const logger = createLogger('postgres');

/**
 * PostgreSQL-backed database adapter.
 *
 * Call {@link initialize} when connecting to an existing database so pending
 * migrations are applied.
 * Transaction callbacks must use the adapter passed to them. That adapter is
 * bound to the transaction and cannot be closed or reset independently.
 */
export class PostgresDatabase implements DatabaseAdapter {
  private readonly sql: PostgresSqlClient;

  readonly workspace: PostgresWorkspaceDatabase;
  readonly catalog: PostgresCatalogDatabase;
  readonly view: PostgresViewDatabase;
  readonly dashboard: PostgresDashboardDatabase;
  readonly personalDashboard: PostgresPersonalDashboardDatabase;
  readonly projectDashboard: PostgresProjectDashboardDatabase;
  readonly project: PostgresProjectDatabase;
  readonly audit: PostgresAuditDatabase;
  readonly watch: PostgresWatchDatabase;
  readonly auth: PostgresAuthDatabase;
  readonly ai: PostgresAiDatabase;
  readonly discussion: PostgresDiscussionDatabase;
  readonly wikiComment: PostgresWikiCommentDatabase;
  readonly jobs: PostgresJobDatabase;
  readonly externalContent: PostgresExternalContentDatabase;
  readonly webhook: PostgresWebhookDatabase;
  readonly automationRule: PostgresAutomationRuleDatabase;
  readonly document: PostgresDocumentDatabase;
  readonly governance: PostgresGovernanceDatabase;
  readonly governanceCaseConfig: PostgresGovernanceCaseConfigDatabase;
  readonly notification: PostgresNotificationDatabase;
  readonly notificationPreference: PostgresNotificationPreferenceDatabase;
  readonly notificationDelivery: PostgresNotificationDeliveryDatabase;
  readonly entityChange: PostgresEntityChangeDatabase;
  readonly entityDeprecation: PostgresEntityDeprecationDatabase;
  readonly changeCase: PostgresChangeCaseDatabase;
  readonly externalIdentity: PostgresExternalIdentityDatabase;
  readonly relation: PostgresRelationDatabase;
  readonly currencyRates: PostgresCurrencyRatesDatabase;
  readonly contentReconciliation: PostgresContentReconciliationDatabase;
  readonly artifact: PostgresArtifactDatabase;
  readonly core;

  private adapterFor(sql: PostgresSqlClient): DatabaseAdapter {
    const adapter = {
      workspace: new PostgresWorkspaceDatabase(sql),
      catalog: new PostgresCatalogDatabase(sql),
      view: new PostgresViewDatabase(sql),
      dashboard: new PostgresDashboardDatabase(sql),
      personalDashboard: new PostgresPersonalDashboardDatabase(sql),
      projectDashboard: new PostgresProjectDashboardDatabase(sql),
      project: new PostgresProjectDatabase(sql),
      audit: new PostgresAuditDatabase(sql),
      watch: new PostgresWatchDatabase(sql),
      auth: new PostgresAuthDatabase(sql),
      ai: new PostgresAiDatabase(sql),
      discussion: new PostgresDiscussionDatabase(sql),
      wikiComment: new PostgresWikiCommentDatabase(sql),
      jobs: new PostgresJobDatabase(sql),
      externalContent: new PostgresExternalContentDatabase(sql),
      webhook: new PostgresWebhookDatabase(sql),
      automationRule: new PostgresAutomationRuleDatabase(sql),
      document: new PostgresDocumentDatabase(sql),
      governance: new PostgresGovernanceDatabase(sql),
      governanceCaseConfig: new PostgresGovernanceCaseConfigDatabase(sql),
      notification: new PostgresNotificationDatabase(sql),
      notificationPreference: new PostgresNotificationPreferenceDatabase(sql),
      notificationDelivery: new PostgresNotificationDeliveryDatabase(sql),
      entityChange: new PostgresEntityChangeDatabase(sql),
      entityDeprecation: new PostgresEntityDeprecationDatabase(sql),
      changeCase: new PostgresChangeCaseDatabase(sql),
      externalIdentity: new PostgresExternalIdentityDatabase(sql),
      relation: new PostgresRelationDatabase(sql),
      currencyRates: new PostgresCurrencyRatesDatabase(sql),
      contentReconciliation: new PostgresContentReconciliationDatabase(sql),
      artifact: new PostgresArtifactDatabase(sql)
    };
    let bound!: DatabaseAdapter;
    bound = {
      ...adapter,
      core: {
        driver: 'postgres',
        isTransaction: true,
        close: async () => {
          throw new Error('Cannot close a transaction-bound database adapter');
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
        logger.info(message ?? 'PostgreSQL notice', notice);
      }
    });

    this.workspace = new PostgresWorkspaceDatabase(this.sql);
    this.catalog = new PostgresCatalogDatabase(this.sql);
    this.view = new PostgresViewDatabase(this.sql);
    this.dashboard = new PostgresDashboardDatabase(this.sql);
    this.personalDashboard = new PostgresPersonalDashboardDatabase(this.sql);
    this.projectDashboard = new PostgresProjectDashboardDatabase(this.sql);
    this.project = new PostgresProjectDatabase(this.sql);
    this.audit = new PostgresAuditDatabase(this.sql);
    this.watch = new PostgresWatchDatabase(this.sql);
    this.auth = new PostgresAuthDatabase(this.sql);
    this.ai = new PostgresAiDatabase(this.sql);
    this.discussion = new PostgresDiscussionDatabase(this.sql);
    this.wikiComment = new PostgresWikiCommentDatabase(this.sql);
    this.jobs = new PostgresJobDatabase(this.sql);
    this.externalContent = new PostgresExternalContentDatabase(this.sql);
    this.webhook = new PostgresWebhookDatabase(this.sql);
    this.automationRule = new PostgresAutomationRuleDatabase(this.sql);
    this.document = new PostgresDocumentDatabase(this.sql);
    this.governance = new PostgresGovernanceDatabase(this.sql);
    this.governanceCaseConfig = new PostgresGovernanceCaseConfigDatabase(this.sql);
    this.notification = new PostgresNotificationDatabase(this.sql);
    this.notificationPreference = new PostgresNotificationPreferenceDatabase(this.sql);
    this.notificationDelivery = new PostgresNotificationDeliveryDatabase(this.sql);
    this.entityChange = new PostgresEntityChangeDatabase(this.sql);
    this.entityDeprecation = new PostgresEntityDeprecationDatabase(this.sql);
    this.changeCase = new PostgresChangeCaseDatabase(this.sql);
    this.externalIdentity = new PostgresExternalIdentityDatabase(this.sql);
    this.relation = new PostgresRelationDatabase(this.sql);
    this.currencyRates = new PostgresCurrencyRatesDatabase(this.sql);
    this.contentReconciliation = new PostgresContentReconciliationDatabase(this.sql);
    this.artifact = new PostgresArtifactDatabase(this.sql);

    this.core = {
      driver: 'postgres' as const,
      isTransaction: false,
      close: async () => {
        await this.sql.end();
      },
      transaction: async <T>(callback: (db: DatabaseAdapter) => Promise<T>): Promise<T> =>
        (await this.sql.begin(async sql =>
          callback(this.adapterFor(sql as unknown as PostgresSqlClient))
        )) as unknown as T
    };
  }

  /** Apply any pending PostgreSQL migrations without recreating the schema. */
  async initialize(): Promise<void> {
    await runPostgresMigrations(this.sql);
  }
}
