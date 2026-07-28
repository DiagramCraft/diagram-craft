import { randomUUID } from 'node:crypto';
import type { Database as DatabaseType } from 'better-sqlite3';
import type {
  ProjectDashboardDbCreate,
  ProjectDashboardDbUpdate,
  ProjectDashboardDatabase
} from './projectDashboardDatabase';
import { mapProjectDashboardRow } from './projectDashboardDatabase';
import { normalizeSqliteError } from '../../../db/sqliteBase';

export class SqliteProjectDashboardDatabase implements ProjectDashboardDatabase {
  constructor(private readonly getDb: () => DatabaseType) {}

  private get db() {
    return this.getDb();
  }

  async get(workspace: string, projectId: string) {
    try {
      const row = this.db
        .prepare('SELECT * FROM project_dashboard WHERE workspace = ? AND project_id = ?')
        .get(workspace, projectId) as Record<string, unknown> | undefined;
      return row ? mapProjectDashboardRow(row) : null;
    } catch (error) {
      return normalizeSqliteError(error);
    }
  }

  async create(input: ProjectDashboardDbCreate) {
    const now = new Date().toISOString();
    const id = input.id || randomUUID();
    try {
      this.db
        .prepare(
          `INSERT INTO project_dashboard (id, workspace, project_id, layout, updated_at, updated_by)
           VALUES (?, ?, ?, '[]', ?, ?)`
        )
        .run(id, input.workspace, input.project_id, now, input.updated_by);
    } catch (error) {
      return normalizeSqliteError(error);
    }
    return (await this.get(input.workspace, input.project_id))!;
  }

  async update(workspace: string, projectId: string, input: ProjectDashboardDbUpdate) {
    const existing = await this.get(workspace, projectId);
    if (!existing) return null;

    const now = new Date().toISOString();
    try {
      this.db
        .prepare(
          `UPDATE project_dashboard
           SET layout = ?, updated_at = ?, updated_by = ?
           WHERE workspace = ? AND project_id = ?`
        )
        .run(JSON.stringify(input.layout), now, input.updated_by, workspace, projectId);
    } catch (error) {
      return normalizeSqliteError(error);
    }
    return this.get(workspace, projectId);
  }
}
