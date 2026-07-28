import type { DashboardDbCreate, DashboardDbUpdate, DashboardDatabase } from './dashboardDatabase';
import { mapWorkspaceDashboardRow } from './dashboardDatabase';
import { normalizePostgresError, PostgresDatabaseBase } from '../../../db/postgresBase';

export class PostgresDashboardDatabase extends PostgresDatabaseBase implements DashboardDatabase {
  async list(workspace: string) {
    const rows = await this.sql<Record<string, unknown>[]>`
      SELECT * FROM workspace_dashboard WHERE workspace = ${workspace} ORDER BY sort_order
    `;
    return rows.map(mapWorkspaceDashboardRow);
  }

  async get(workspace: string, id: string) {
    const [row] = await this.sql<Record<string, unknown>[]>`
      SELECT * FROM workspace_dashboard WHERE workspace = ${workspace} AND id = ${id}
    `;
    return row ? mapWorkspaceDashboardRow(row) : null;
  }

  async create(input: DashboardDbCreate) {
    try {
      const [row] = await this.sql<Record<string, unknown>[]>`
        INSERT INTO workspace_dashboard (id, workspace, name, sort_order, layout, updated_at, updated_by)
        VALUES (${input.id}, ${input.workspace}, ${input.name}, ${input.sort_order}, '[]', NOW(), ${input.updated_by})
        RETURNING *
      `;
      return mapWorkspaceDashboardRow(row!);
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async update(workspace: string, id: string, input: DashboardDbUpdate) {
    try {
      const [row] = await this.sql<Record<string, unknown>[]>`
        UPDATE workspace_dashboard
        SET name = COALESCE(${input.name ?? null}, name),
            layout = COALESCE(${input.layout ? this.json(input.layout) : null}, layout),
            updated_at = NOW(),
            updated_by = ${input.updated_by}
        WHERE workspace = ${workspace} AND id = ${id}
        RETURNING *
      `;
      return row ? mapWorkspaceDashboardRow(row) : null;
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async remove(workspace: string, id: string) {
    try {
      const [row] = await this.sql<Record<string, unknown>[]>`
        DELETE FROM workspace_dashboard
        WHERE workspace = ${workspace} AND id = ${id}
        RETURNING *
      `;
      return row ? mapWorkspaceDashboardRow(row) : null;
    } catch (error) {
      return normalizePostgresError(error);
    }
  }
}
