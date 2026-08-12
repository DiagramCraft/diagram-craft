import { readFileSync } from 'node:fs';
import Database from 'better-sqlite3';
import type { ArtifactProjectionDatabases, DatabaseAdapter } from './database';
import { runSqliteMigrations } from './migrate';
import { SqliteAuditDatabase } from '../domain/audit/db/sqliteAudit';
import { SqliteCatalogDatabase } from '../domain/catalog/db/sqliteCatalog';
import { SqliteAuthDatabase } from '../domain/auth/db/sqliteAuth';
import { SqliteProjectDatabase } from '../domain/project/db/sqliteProject';
import { SqliteWorkspaceDatabase } from '../domain/workspace/db/sqliteWorkspace';
import { SqliteAiDatabase } from '../domain/ai/db/sqliteAi';
import { SqliteViewDatabase } from '../domain/catalog/db/sqliteView';
import { SqliteDashboardDatabase } from '../domain/dashboard/db/sqliteDashboard';
import { SqlitePersonalDashboardDatabase } from '../domain/personalDashboard/db/sqlitePersonalDashboard';
import { SqliteProjectDashboardDatabase } from '../domain/dashboard/db/sqliteProjectDashboard';
import { SqliteWatchDatabase } from '../domain/watch/db/sqliteWatch';
import { SqliteDiscussionDatabase } from '../domain/discussion/db/sqliteDiscussion';
import { SqliteWikiCommentDatabase } from '../domain/wikiComments/db/sqliteWikiComment';
import { SqliteJobDatabase } from '../domain/jobs/db/sqliteJobs';
import { SqliteExternalContentDatabase } from '../domain/external-content/db/sqliteExternalContent';
import { SqliteWebhookDatabase } from '../domain/webhook/db/sqliteWebhook';
import { SqliteAutomationRuleDatabase } from '../domain/automation/db/sqliteAutomationRule';
import { SqliteDocumentDatabase } from '../domain/document/db/sqliteDocument';
import { SqliteGovernanceDatabase } from '../domain/governance/db/sqliteGovernance';
import { SqliteGovernanceCaseConfigDatabase } from '../domain/governance/db/sqliteGovernanceCaseConfig';
import { SqliteNotificationDatabase } from '../domain/notification/db/sqliteNotification';
import { SqliteNotificationPreferenceDatabase } from '../domain/notification/db/sqliteNotificationPreference';
import { SqliteNotificationDeliveryDatabase } from '../domain/notification/db/sqliteNotificationDelivery';
import { SqliteEntityChangeDatabase } from '../domain/catalog/db/sqliteEntityChange';
import { SqliteEntityDeprecationDatabase } from '../domain/catalog/db/sqliteEntityDeprecation';
import { SqliteChangeCaseDatabase } from '../domain/catalog/db/sqliteChangeCase';
import { SqliteExternalIdentityDatabase } from '../domain/externalIdentity/db/sqliteExternalIdentity';
import { SqliteRelationDatabase } from '../domain/catalog/db/sqliteRelation';
import { SqliteCurrencyRatesDatabase } from '../domain/currencyRates/db/sqliteCurrencyRates';
import { SqliteContentReconciliationDatabase } from '../domain/project/db/sqliteContentReconciliation';
import { SqliteArtifactDatabase } from '../domain/artifact/db/sqliteArtifact';
import { SqliteApiSpecificationDatabase } from '../domain/artifact/db/sqliteApiSpecification';
import { apiSpecificationArtifactProcessor } from '../domain/artifact/apiSpecificationProcessor';
import { SqliteBaselineDatabase } from '../domain/baseline/db/sqliteBaseline';
import {
  createArtifactProcessorRegistry,
  type ArtifactProcessorRegistry
} from '../domain/artifact/artifactProcessor';
import { SqlitePublicCatalogDatabase } from '../domain/publicCatalog/db/sqlitePublicCatalog';

export class SqliteDatabase implements DatabaseAdapter {
  private db;

  readonly core;
  readonly workspace;
  readonly catalog;
  readonly view;
  readonly dashboard;
  readonly personalDashboard;
  readonly projectDashboard;
  readonly project;
  readonly audit;
  readonly watch;
  readonly auth;
  readonly ai;
  readonly discussion;
  readonly wikiComment;
  readonly jobs;
  readonly externalContent;
  readonly webhook;
  readonly automationRule;
  readonly document;
  readonly governance;
  readonly governanceCaseConfig;
  readonly notification;
  readonly notificationPreference;
  readonly notificationDelivery;
  readonly entityChange;
  readonly entityDeprecation;
  readonly changeCase;
  readonly externalIdentity;
  readonly relation;
  readonly currencyRates;
  readonly contentReconciliation;
  readonly artifact;
  readonly artifactProjections: ArtifactProjectionDatabases;
  readonly artifactProcessors: ArtifactProcessorRegistry;
  readonly baseline;
  readonly publicCatalog: SqlitePublicCatalogDatabase;
  private transactionTail: Promise<void> = Promise.resolve();
  private savepointCounter = 0;

  constructor(filePath: string) {
    this.db = new Database(filePath);
    this.configure();
    this.initializeSchema();

    this.workspace = new SqliteWorkspaceDatabase(() => this.db);
    this.catalog = new SqliteCatalogDatabase(() => this.db);
    this.view = new SqliteViewDatabase(() => this.db);
    this.dashboard = new SqliteDashboardDatabase(() => this.db);
    this.personalDashboard = new SqlitePersonalDashboardDatabase(() => this.db);
    this.projectDashboard = new SqliteProjectDashboardDatabase(() => this.db);
    this.project = new SqliteProjectDatabase(() => this.db);
    this.audit = new SqliteAuditDatabase(() => this.db);
    this.watch = new SqliteWatchDatabase(() => this.db);
    this.auth = new SqliteAuthDatabase(() => this.db);
    this.ai = new SqliteAiDatabase(() => this.db);
    this.discussion = new SqliteDiscussionDatabase(() => this.db);
    this.wikiComment = new SqliteWikiCommentDatabase(() => this.db);
    this.jobs = new SqliteJobDatabase(() => this.db);
    this.externalContent = new SqliteExternalContentDatabase(() => this.db);
    this.webhook = new SqliteWebhookDatabase(() => this.db);
    this.automationRule = new SqliteAutomationRuleDatabase(() => this.db);
    this.document = new SqliteDocumentDatabase(() => this.db);
    this.governance = new SqliteGovernanceDatabase(() => this.db);
    this.governanceCaseConfig = new SqliteGovernanceCaseConfigDatabase(() => this.db);
    this.notification = new SqliteNotificationDatabase(() => this.db);
    this.notificationPreference = new SqliteNotificationPreferenceDatabase(() => this.db);
    this.notificationDelivery = new SqliteNotificationDeliveryDatabase(() => this.db);
    this.entityChange = new SqliteEntityChangeDatabase(() => this.db);
    this.entityDeprecation = new SqliteEntityDeprecationDatabase(() => this.db);
    this.changeCase = new SqliteChangeCaseDatabase(() => this.db);
    this.externalIdentity = new SqliteExternalIdentityDatabase(() => this.db);
    this.relation = new SqliteRelationDatabase(() => this.db);
    this.currencyRates = new SqliteCurrencyRatesDatabase(() => this.db);
    this.contentReconciliation = new SqliteContentReconciliationDatabase(() => this.db);
    this.artifact = new SqliteArtifactDatabase(() => this.db);
    this.baseline = new SqliteBaselineDatabase(() => this.db);
    this.artifactProjections = {
      apiSpecification: new SqliteApiSpecificationDatabase(() => this.db)
    };
    this.artifactProcessors = createArtifactProcessorRegistry([apiSpecificationArtifactProcessor]);
    this.publicCatalog = new SqlitePublicCatalogDatabase(() => this.db);

    runSqliteMigrations(this.db);

    this.core = {
      driver: 'sqlite' as const,
      isTransaction: false,
      close: async () => {
        this.db.close();
      },
      savepoint: async () => {
        throw new Error('SQLite savepoints require a transaction-bound database adapter');
      },
      transaction: async <T>(callback: (db: DatabaseAdapter) => Promise<T>): Promise<T> => {
        const previous = this.transactionTail;
        let release!: () => void;
        this.transactionTail = new Promise<void>(resolve => {
          release = resolve;
        });
        await previous;
        try {
          this.db.exec('BEGIN IMMEDIATE');
          try {
            const result = await callback(this.transactionAdapter());
            this.db.exec('COMMIT');
            return result;
          } catch (error) {
            this.db.exec('ROLLBACK');
            throw error;
          }
        } finally {
          release();
        }
      }
    };
  }

  private transactionAdapter(): DatabaseAdapter {
    return {
      core: {
        driver: 'sqlite',
        isTransaction: true,
        close: async () => {
          throw new Error('Cannot close a transaction-bound database adapter');
        },
        transaction: async callback => callback(this.transactionAdapter()),
        savepoint: async callback => {
          const name = `ar_savepoint_${this.savepointCounter++}`;
          this.db.exec(`SAVEPOINT ${name}`);
          try {
            const result = await callback(this.transactionAdapter());
            this.db.exec(`RELEASE SAVEPOINT ${name}`);
            return result;
          } catch (error) {
            try {
              this.db.exec(`ROLLBACK TO SAVEPOINT ${name}`);
            } finally {
              this.db.exec(`RELEASE SAVEPOINT ${name}`);
            }
            throw error;
          }
        }
      },
      workspace: this.workspace,
      catalog: this.catalog,
      view: this.view,
      dashboard: this.dashboard,
      personalDashboard: this.personalDashboard,
      projectDashboard: this.projectDashboard,
      project: this.project,
      audit: this.audit,
      watch: this.watch,
      auth: this.auth,
      ai: this.ai,
      discussion: this.discussion,
      wikiComment: this.wikiComment,
      jobs: this.jobs,
      externalContent: this.externalContent,
      webhook: this.webhook,
      automationRule: this.automationRule,
      document: this.document,
      governance: this.governance,
      governanceCaseConfig: this.governanceCaseConfig,
      notification: this.notification,
      notificationPreference: this.notificationPreference,
      notificationDelivery: this.notificationDelivery,
      entityChange: this.entityChange,
      entityDeprecation: this.entityDeprecation,
      changeCase: this.changeCase,
      externalIdentity: this.externalIdentity,
      relation: this.relation,
      currencyRates: this.currencyRates,
      contentReconciliation: this.contentReconciliation,
      artifact: this.artifact,
      artifactProjections: this.artifactProjections,
      artifactProcessors: this.artifactProcessors,
      baseline: this.baseline,
      publicCatalog: this.publicCatalog
    };
  }

  private configure() {
    this.db.pragma('foreign_keys = ON');
    this.db.pragma('journal_mode = WAL');
  }

  private initializeSchema() {
    // Check if workspace table exists - if not, initialize the base schema
    const tableExists = this.db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='workspace'")
      .get();

    if (!tableExists) {
      const schemaSql = readFileSync(new URL('./schema.sqlite.sql', import.meta.url), 'utf8');
      this.db.exec(schemaSql);
    }
  }
}
