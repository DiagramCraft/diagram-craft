import { randomUUID } from 'node:crypto';
import type { Database as DatabaseType } from 'better-sqlite3';
import type {
  SchemaChangeMode,
  SchemaDraftDatabase,
  SchemaDraftKind,
  SchemaDraftStageInput
} from './schemaDraftDatabase';
import { mapSchemaDraftItemRow, mapSchemaDraftRow } from './schemaDraftDatabase';
import { normalizeSqliteError } from '../../../db/sqliteBase';

export class SqliteSchemaDraftDatabase implements SchemaDraftDatabase {
  constructor(private readonly getDb: () => DatabaseType) {}

  private get db() {
    return this.getDb();
  }

  private readDraft(workspace: string) {
    const row = this.db.prepare('SELECT * FROM schema_draft WHERE workspace = ?').get(workspace) as
      | Record<string, unknown>
      | undefined;
    return row ? mapSchemaDraftRow(row) : null;
  }

  /** Creates the draft (expected 0) or bumps its revision. Returns false on mismatch. */
  private bumpRevision(workspace: string, expectedRevision: number, userId: string | null) {
    const now = new Date().toISOString();
    if (expectedRevision === 0) {
      const result = this.db
        .prepare(
          `INSERT OR IGNORE INTO schema_draft (workspace, revision, created_by, updated_by, created_at, updated_at)
           VALUES (?, 1, ?, ?, ?, ?)`
        )
        .run(workspace, userId, userId, now, now);
      return result.changes > 0;
    }
    const result = this.db
      .prepare(
        `UPDATE schema_draft SET revision = revision + 1, updated_by = ?, updated_at = ?
         WHERE workspace = ? AND revision = ?`
      )
      .run(userId, now, workspace, expectedRevision);
    return result.changes > 0;
  }

  async getDraft(workspace: string) {
    try {
      return this.readDraft(workspace);
    } catch (error) {
      return normalizeSqliteError(error);
    }
  }

  async listItems(workspace: string) {
    try {
      const rows = this.db
        .prepare('SELECT * FROM schema_draft_item WHERE workspace = ? ORDER BY kind, item_id')
        .all(workspace) as Record<string, unknown>[];
      return rows.map(mapSchemaDraftItemRow);
    } catch (error) {
      return normalizeSqliteError(error);
    }
  }

  async stageItem(input: SchemaDraftStageInput, expectedRevision: number) {
    try {
      const run = this.db.transaction(() => {
        if (!this.bumpRevision(input.workspace, expectedRevision, input.updated_by)) return null;
        this.db
          .prepare(
            `INSERT INTO schema_draft_item (id, workspace, kind, item_id, op, payload, base_version, updated_by, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT (workspace, kind, item_id) DO UPDATE SET
               op = excluded.op, payload = excluded.payload, base_version = excluded.base_version,
               updated_by = excluded.updated_by, updated_at = excluded.updated_at`
          )
          .run(
            randomUUID(),
            input.workspace,
            input.kind,
            input.item_id,
            input.op,
            input.payload == null ? null : JSON.stringify(input.payload),
            input.base_version,
            input.updated_by,
            new Date().toISOString()
          );
        return this.readDraft(input.workspace);
      });
      return run();
    } catch (error) {
      return normalizeSqliteError(error);
    }
  }

  async unstageItem(
    workspace: string,
    kind: SchemaDraftKind,
    itemId: string,
    expectedRevision: number,
    updatedBy: string | null
  ) {
    try {
      const run = this.db.transaction(() => {
        if (expectedRevision === 0) return null;
        if (!this.bumpRevision(workspace, expectedRevision, updatedBy)) return null;
        this.db
          .prepare('DELETE FROM schema_draft_item WHERE workspace = ? AND kind = ? AND item_id = ?')
          .run(workspace, kind, itemId);
        return this.readDraft(workspace);
      });
      return run();
    } catch (error) {
      return normalizeSqliteError(error);
    }
  }

  async discard(workspace: string, expectedRevision: number) {
    try {
      const result = this.db
        .prepare('DELETE FROM schema_draft WHERE workspace = ? AND revision = ?')
        .run(workspace, expectedRevision);
      return result.changes > 0;
    } catch (error) {
      return normalizeSqliteError(error);
    }
  }

  async getSchemaChangeMode(workspace: string): Promise<SchemaChangeMode> {
    try {
      const row = this.db
        .prepare('SELECT schema_change_mode FROM workspace_schema_settings WHERE workspace = ?')
        .get(workspace) as { schema_change_mode: SchemaChangeMode } | undefined;
      return row?.schema_change_mode ?? 'direct';
    } catch (error) {
      return normalizeSqliteError(error);
    }
  }

  async setSchemaChangeMode(workspace: string, mode: SchemaChangeMode, updatedBy: string | null) {
    try {
      this.db
        .prepare(
          `INSERT INTO workspace_schema_settings (workspace, schema_change_mode, updated_at, updated_by)
           VALUES (?, ?, ?, ?)
           ON CONFLICT (workspace) DO UPDATE SET
             schema_change_mode = excluded.schema_change_mode,
             updated_at = excluded.updated_at, updated_by = excluded.updated_by`
        )
        .run(workspace, mode, new Date().toISOString(), updatedBy);
    } catch (error) {
      return normalizeSqliteError(error);
    }
  }
}
