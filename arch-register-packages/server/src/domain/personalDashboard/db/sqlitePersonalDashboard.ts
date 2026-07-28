import { randomUUID } from 'node:crypto';
import type { Database as DatabaseType } from 'better-sqlite3';
import type {
  PersonalDashboardDbCreate,
  PersonalDashboardDbUpdate,
  PersonalDashboardDatabase
} from './personalDashboardDatabase';
import { mapUserDashboardRow } from './personalDashboardDatabase';
import { normalizeSqliteError } from '../../../db/sqliteBase';

export class SqlitePersonalDashboardDatabase implements PersonalDashboardDatabase {
  constructor(private readonly getDb: () => DatabaseType) {}

  private get db() {
    return this.getDb();
  }

  async list(userId: string, workspace: string) {
    try {
      const rows = this.db
        .prepare(
          'SELECT * FROM user_dashboard WHERE user_id = ? AND workspace = ? ORDER BY sort_order'
        )
        .all(userId, workspace) as Record<string, unknown>[];
      return rows.map(mapUserDashboardRow);
    } catch (error) {
      return normalizeSqliteError(error);
    }
  }

  async get(userId: string, workspace: string, id: string) {
    try {
      const row = this.db
        .prepare('SELECT * FROM user_dashboard WHERE user_id = ? AND workspace = ? AND id = ?')
        .get(userId, workspace, id) as Record<string, unknown> | undefined;
      return row ? mapUserDashboardRow(row) : null;
    } catch (error) {
      return normalizeSqliteError(error);
    }
  }

  async create(input: PersonalDashboardDbCreate) {
    const now = new Date().toISOString();
    const id = input.id || randomUUID();
    try {
      this.db
        .prepare(
          `INSERT INTO user_dashboard (id, user_id, workspace, name, sort_order, layout, updated_at)
           VALUES (?, ?, ?, ?, ?, '[]', ?)`
        )
        .run(id, input.user_id, input.workspace, input.name, input.sort_order, now);
    } catch (error) {
      return normalizeSqliteError(error);
    }
    return (await this.get(input.user_id, input.workspace, id))!;
  }

  async update(userId: string, workspace: string, id: string, input: PersonalDashboardDbUpdate) {
    const existing = await this.get(userId, workspace, id);
    if (!existing) return null;

    const now = new Date().toISOString();
    try {
      this.db
        .prepare(
          `UPDATE user_dashboard
           SET name = ?, layout = ?, updated_at = ?
           WHERE user_id = ? AND workspace = ? AND id = ?`
        )
        .run(
          input.name ?? existing.name,
          input.layout ? JSON.stringify(input.layout) : JSON.stringify(existing.layout),
          now,
          userId,
          workspace,
          id
        );
    } catch (error) {
      return normalizeSqliteError(error);
    }
    return this.get(userId, workspace, id);
  }

  async remove(userId: string, workspace: string, id: string) {
    const existing = await this.get(userId, workspace, id);
    if (!existing) return null;
    try {
      this.db
        .prepare('DELETE FROM user_dashboard WHERE user_id = ? AND workspace = ? AND id = ?')
        .run(userId, workspace, id);
      return existing;
    } catch (error) {
      return normalizeSqliteError(error);
    }
  }
}
