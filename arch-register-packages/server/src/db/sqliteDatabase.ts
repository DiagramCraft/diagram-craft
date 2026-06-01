import { mkdir, readFile, rm } from 'node:fs/promises';
import { dirname } from 'node:path';
import Database from 'better-sqlite3';
import type { DatabaseAdapter } from './database.js';
import { SqliteAuditDatabase } from './sqliteAudit.js';
import { SqliteCatalogDatabase } from './sqliteCatalog.js';
import { SqliteIdentityAuthDatabase } from './sqliteIdentityAuth.js';
import { SqliteProjectsFilesDatabase } from './sqliteProjectsFiles.js';
import { SqliteWorkspaceAdminDatabase } from './sqliteWorkspaceAdmin.js';
import { SqliteAiDatabase } from './sqliteAi.js';

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

    this.workspaceAdmin = new SqliteWorkspaceAdminDatabase(() => this.db);
    this.catalog = new SqliteCatalogDatabase(() => this.db);
    this.projectsFiles = new SqliteProjectsFilesDatabase(() => this.db);
    this.audit = new SqliteAuditDatabase(() => this.db);
    this.identityAuth = new SqliteIdentityAuthDatabase(() => this.db);
    this.ai = new SqliteAiDatabase(() => this.db);

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
      }
    };
  }

  private configure() {
    this.db.pragma('foreign_keys = ON');
    this.db.pragma('journal_mode = WAL');
  }
}