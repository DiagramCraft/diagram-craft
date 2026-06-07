import { mkdir, readFile, rm } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import Database from 'better-sqlite3';
import type { DatabaseAdapter } from './database';
import { runSqliteMigrations } from './migrate';
import { SqliteAuditDatabase } from './sqliteAudit';
import { SqliteCatalogDatabase } from './sqliteCatalog';
import { SqliteIdentityAuthDatabase } from './sqliteIdentityAuth';
import { SqliteProjectsFilesDatabase } from './sqliteProjectsFiles';
import { SqliteWorkspaceAdminDatabase } from './sqliteWorkspaceAdmin';
import { SqliteAiDatabase } from './sqliteAi';

export class SqliteDatabase implements DatabaseAdapter {
  private db;
  private readonly filePath: string;

  readonly core;
  readonly workspaceAdmin;
  readonly catalog;
  readonly projectsFiles;
  readonly audit;
  readonly identityAuth;
  readonly ai;

  constructor(filePath: string) {
    this.filePath = filePath;
    this.db = new Database(filePath);
    this.configure();
    this.initializeSchema();

    this.workspaceAdmin = new SqliteWorkspaceAdminDatabase(() => this.db);
    this.catalog = new SqliteCatalogDatabase(() => this.db);
    this.projectsFiles = new SqliteProjectsFilesDatabase(() => this.db);
    this.audit = new SqliteAuditDatabase(() => this.db);
    this.identityAuth = new SqliteIdentityAuthDatabase(() => this.db);
    this.ai = new SqliteAiDatabase(() => this.db);

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
