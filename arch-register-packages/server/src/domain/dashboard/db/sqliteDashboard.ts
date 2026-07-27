import { randomUUID } from 'node:crypto';
import type { Database as DatabaseType } from 'better-sqlite3';
import type { DashboardWidget } from '@arch-register/api-types/dashboardContract';
import type { DashboardDatabase } from './dashboardDatabase';
import { mapWorkspaceDashboardRow } from './dashboardDatabase';
import { normalizeSqliteError } from '../../../db/sqliteBase';

export class SqliteDashboardDatabase implements DashboardDatabase {
  constructor(private readonly getDb: () => DatabaseType) {}

  private get db() {
    return this.getDb();
  }

  async get(workspace: string) {
    try {
      const row = this.db
        .prepare('SELECT * FROM workspace_dashboard WHERE workspace = ?')
        .get(workspace) as Record<string, unknown> | undefined;
      return row ? mapWorkspaceDashboardRow(row) : null;
    } catch (error) {
      return normalizeSqliteError(error);
    }
  }

  async put(workspace: string, widgets: DashboardWidget[], actorUserId: string | null) {
    const now = new Date().toISOString();
    try {
      this.db
        .prepare(
          `INSERT INTO workspace_dashboard (id, workspace, layout, updated_at, updated_by)
           VALUES (?, ?, ?, ?, ?)
           ON CONFLICT(workspace) DO UPDATE SET
             layout = excluded.layout,
             updated_at = excluded.updated_at,
             updated_by = excluded.updated_by`
        )
        .run(randomUUID(), workspace, JSON.stringify(widgets), now, actorUserId);
    } catch (error) {
      return normalizeSqliteError(error);
    }
    return (await this.get(workspace))!;
  }
}
