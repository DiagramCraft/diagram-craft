import { randomUUID } from 'node:crypto';
import type { Database as DatabaseType } from 'better-sqlite3';
import type {
  ApplicationDatabase,
  ApplicationDbCreate,
  ApplicationDbUpdate
} from './applicationDatabase';
import { mapWorkspaceApplicationRow } from './applicationDatabase';
import { normalizeSqliteError } from '../../../db/sqliteBase';

export class SqliteApplicationDatabase implements ApplicationDatabase {
  constructor(private readonly getDb: () => DatabaseType) {}

  private get db() {
    return this.getDb();
  }

  async list(workspace: string) {
    try {
      const rows = this.db
        .prepare('SELECT * FROM workspace_application WHERE workspace = ? ORDER BY sort_order')
        .all(workspace) as Record<string, unknown>[];
      return rows.map(mapWorkspaceApplicationRow);
    } catch (error) {
      return normalizeSqliteError(error);
    }
  }

  async get(workspace: string, id: string) {
    try {
      const row = this.db
        .prepare('SELECT * FROM workspace_application WHERE workspace = ? AND id = ?')
        .get(workspace, id) as Record<string, unknown> | undefined;
      return row ? mapWorkspaceApplicationRow(row) : null;
    } catch (error) {
      return normalizeSqliteError(error);
    }
  }

  async getByKey(workspace: string, key: string) {
    try {
      const row = this.db
        .prepare('SELECT * FROM workspace_application WHERE workspace = ? AND key = ?')
        .get(workspace, key) as Record<string, unknown> | undefined;
      return row ? mapWorkspaceApplicationRow(row) : null;
    } catch (error) {
      return normalizeSqliteError(error);
    }
  }

  async create(input: ApplicationDbCreate) {
    const now = new Date().toISOString();
    const id = input.id || randomUUID();
    try {
      this.db
        .prepare(
          `INSERT INTO workspace_application (id, workspace, key, name, description, accent_color, sort_order, created_at, updated_at, updated_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          id,
          input.workspace,
          input.key,
          input.name,
          input.description ?? '',
          input.accent_color ?? null,
          input.sort_order,
          now,
          now,
          input.updated_by
        );
    } catch (error) {
      return normalizeSqliteError(error);
    }
    return (await this.get(input.workspace, id))!;
  }

  async update(workspace: string, id: string, input: ApplicationDbUpdate) {
    const existing = await this.get(workspace, id);
    if (!existing) return null;

    const accentColor =
      'accent_color' in input ? (input.accent_color ?? null) : existing.accent_color;
    try {
      this.db
        .prepare(
          `UPDATE workspace_application
           SET name = ?, description = ?, accent_color = ?, sort_order = ?, updated_at = ?, updated_by = ?
           WHERE workspace = ? AND id = ?`
        )
        .run(
          input.name ?? existing.name,
          input.description ?? existing.description,
          accentColor,
          input.sort_order ?? existing.sort_order,
          new Date().toISOString(),
          input.updated_by,
          workspace,
          id
        );
    } catch (error) {
      return normalizeSqliteError(error);
    }
    return this.get(workspace, id);
  }

  async remove(workspace: string, id: string) {
    const existing = await this.get(workspace, id);
    if (!existing) return null;
    try {
      this.db
        .prepare('DELETE FROM workspace_application WHERE workspace = ? AND id = ?')
        .run(workspace, id);
      return existing;
    } catch (error) {
      return normalizeSqliteError(error);
    }
  }
}
