import { mkdir, readFile, rm } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import Database from 'better-sqlite3';
import type { DatabaseAdapter } from './database';
import { runSqliteMigrations } from './migrate';
import { SqliteAuditDatabase } from '../domain/audit/db/sqliteAudit';
import { SqliteCatalogDatabase } from '../domain/catalog/db/sqliteCatalog';
import { SqliteAuthDatabase } from '../domain/auth/db/sqliteAuth';
import { SqliteProjectDatabase } from '../domain/project/db/sqliteProject';
import { SqliteWorkspaceDatabase } from '../domain/workspace/db/sqliteWorkspace';
import { SqliteAiDatabase } from '../domain/ai/db/sqliteAi';
import { SqliteViewDatabase } from '../domain/catalog/db/sqliteView';
import { SqliteWatchDatabase } from '../domain/watch/db/sqliteWatch';
import { SqliteDiscussionDatabase } from '../domain/discussion/db/sqliteDiscussion';
import { SqliteJobDatabase } from '../domain/jobs/db/sqliteJobs';

export class SqliteDatabase implements DatabaseAdapter {
  private db;
  private readonly filePath: string;

  readonly core;
  readonly workspace;
  readonly catalog;
  readonly view;
  readonly project;
  readonly audit;
  readonly watch;
  readonly auth;
  readonly ai;
  readonly discussion;
  readonly jobs;
  private transactionTail: Promise<void> = Promise.resolve();

  constructor(filePath: string) {
    this.filePath = filePath;
    this.db = new Database(filePath);
    this.configure();
    this.initializeSchema();

    this.workspace = new SqliteWorkspaceDatabase(() => this.db);
    this.catalog = new SqliteCatalogDatabase(() => this.db);
    this.view = new SqliteViewDatabase(() => this.db);
    this.project = new SqliteProjectDatabase(() => this.db);
    this.audit = new SqliteAuditDatabase(() => this.db);
    this.watch = new SqliteWatchDatabase(() => this.db);
    this.auth = new SqliteAuthDatabase(() => this.db);
    this.ai = new SqliteAiDatabase(() => this.db);
    this.discussion = new SqliteDiscussionDatabase(() => this.db);
    this.jobs = new SqliteJobDatabase(() => this.db);

    runSqliteMigrations(this.db);

    this.core = {
      driver: 'sqlite' as const,
      close: async () => {
        this.db.close();
      },
      reset: async () => {
        this.db.close();
        await rm(this.filePath, { force: true });
        await mkdir(dirname(this.filePath), { recursive: true });
        this.db = new Database(this.filePath);
        this.configure();
        const schemaSql = await readFile(new URL('./schema.sqlite.sql', import.meta.url), 'utf8');
        this.db.exec(schemaSql);
        runSqliteMigrations(this.db);
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
            const result = await callback(this);
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
