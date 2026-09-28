import { randomUUID } from 'node:crypto';
import type { Database as DatabaseType } from 'better-sqlite3';
import type { DashboardDbCreate, DashboardDbUpdate, DashboardDatabase } from './dashboardDatabase';
import { mapWorkspaceDashboardRow } from './dashboardDatabase';
import { normalizeSqliteError } from '../../../db/sqliteBase';

export class SqliteDashboardDatabase implements DashboardDatabase {
  constructor(private readonly getDb: () => DatabaseType) {}

  private get db() {
    return this.getDb();
  }

  async list(workspace: string) {
    try {
      const rows = this.db
        .prepare(
          'SELECT * FROM workspace_dashboard WHERE workspace = ? AND app_key IS NULL ORDER BY sort_order'
        )
        .all(workspace) as Record<string, unknown>[];
      return rows.map(mapWorkspaceDashboardRow);
    } catch (error) {
      return normalizeSqliteError(error);
    }
  }

  async getByAppKey(workspace: string, appKey: string) {
    try {
      const row = this.db
        .prepare('SELECT * FROM workspace_dashboard WHERE workspace = ? AND app_key = ?')
        .get(workspace, appKey) as Record<string, unknown> | undefined;
      return row ? mapWorkspaceDashboardRow(row) : null;
    } catch (error) {
      return normalizeSqliteError(error);
    }
  }

  async get(workspace: string, id: string) {
    try {
      const row = this.db
        .prepare('SELECT * FROM workspace_dashboard WHERE workspace = ? AND id = ?')
        .get(workspace, id) as Record<string, unknown> | undefined;
      return row ? mapWorkspaceDashboardRow(row) : null;
    } catch (error) {
      return normalizeSqliteError(error);
    }
  }

  async create(input: DashboardDbCreate) {
    const now = new Date().toISOString();
    const id = input.id || randomUUID();
    try {
      this.db
        .prepare(
          `INSERT INTO workspace_dashboard (id, workspace, name, description, sort_order, app_key, layout, updated_at, updated_by)
           VALUES (?, ?, ?, ?, ?, ?, '[]', ?, ?)`
        )
        .run(
          id,
          input.workspace,
          input.name,
          input.description ?? '',
          input.sort_order,
          input.app_key ?? null,
          now,
          input.updated_by
        );
    } catch (error) {
      return normalizeSqliteError(error);
    }
    return (await this.get(input.workspace, id))!;
  }

  async update(workspace: string, id: string, input: DashboardDbUpdate) {
    const existing = await this.get(workspace, id);
    if (!existing) return null;

    const now = new Date().toISOString();
    try {
      this.db
        .prepare(
          `UPDATE workspace_dashboard
           SET name = ?, description = ?, layout = ?, updated_at = ?, updated_by = ?
           WHERE workspace = ? AND id = ?`
        )
        .run(
          input.name ?? existing.name,
          input.description ?? existing.description,
          input.layout ? JSON.stringify(input.layout) : JSON.stringify(existing.layout),
          now,
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
        .prepare('DELETE FROM workspace_dashboard WHERE workspace = ? AND id = ?')
        .run(workspace, id);
      return existing;
    } catch (error) {
      return normalizeSqliteError(error);
    }
  }
}
