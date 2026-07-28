import type {
  PersonalDashboardDbCreate,
  PersonalDashboardDbUpdate,
  PersonalDashboardDatabase
} from './personalDashboardDatabase';
import { mapUserDashboardRow } from './personalDashboardDatabase';
import { normalizePostgresError, PostgresDatabaseBase } from '../../../db/postgresBase';

export class PostgresPersonalDashboardDatabase
  extends PostgresDatabaseBase
  implements PersonalDashboardDatabase
{
  async list(userId: string, workspace: string) {
    const rows = await this.sql<Record<string, unknown>[]>`
      SELECT * FROM user_dashboard WHERE user_id = ${userId} AND workspace = ${workspace} ORDER BY sort_order
    `;
    return rows.map(mapUserDashboardRow);
  }

  async get(userId: string, workspace: string, id: string) {
    const [row] = await this.sql<Record<string, unknown>[]>`
      SELECT * FROM user_dashboard WHERE user_id = ${userId} AND workspace = ${workspace} AND id = ${id}
    `;
    return row ? mapUserDashboardRow(row) : null;
  }

  async create(input: PersonalDashboardDbCreate) {
    try {
      const [row] = await this.sql<Record<string, unknown>[]>`
        INSERT INTO user_dashboard (id, user_id, workspace, name, sort_order, layout, updated_at)
        VALUES (${input.id}, ${input.user_id}, ${input.workspace}, ${input.name}, ${input.sort_order}, '[]', NOW())
        RETURNING *
      `;
      return mapUserDashboardRow(row!);
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async update(userId: string, workspace: string, id: string, input: PersonalDashboardDbUpdate) {
    try {
      const [row] = await this.sql<Record<string, unknown>[]>`
        UPDATE user_dashboard
        SET name = COALESCE(${input.name ?? null}, name),
            layout = COALESCE(${input.layout ? this.json(input.layout) : null}, layout),
            updated_at = NOW()
        WHERE user_id = ${userId} AND workspace = ${workspace} AND id = ${id}
        RETURNING *
      `;
      return row ? mapUserDashboardRow(row) : null;
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async remove(userId: string, workspace: string, id: string) {
    try {
      const [row] = await this.sql<Record<string, unknown>[]>`
        DELETE FROM user_dashboard
        WHERE user_id = ${userId} AND workspace = ${workspace} AND id = ${id}
        RETURNING *
      `;
      return row ? mapUserDashboardRow(row) : null;
    } catch (error) {
      return normalizePostgresError(error);
    }
  }
}
