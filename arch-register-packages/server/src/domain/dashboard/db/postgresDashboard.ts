import type { DashboardDbCreate, DashboardDbUpdate, DashboardDatabase } from './dashboardDatabase';
import { mapWorkspaceDashboardRow } from './dashboardDatabase';
import { normalizePostgresError, PostgresDatabaseBase } from '../../../db/postgresBase';

export class PostgresDashboardDatabase extends PostgresDatabaseBase implements DashboardDatabase {
  async list(workspace: string) {
    const rows = await this.sql<Record<string, unknown>[]>`
      SELECT * FROM workspace_dashboard WHERE workspace = ${workspace} AND app_key IS NULL ORDER BY sort_order
    `;
    return rows.map(mapWorkspaceDashboardRow);
  }

  async getByAppKey(workspace: string, appKey: string) {
    const [row] = await this.sql<Record<string, unknown>[]>`
      SELECT * FROM workspace_dashboard WHERE workspace = ${workspace} AND app_key = ${appKey}
    `;
    return row ? mapWorkspaceDashboardRow(row) : null;
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
        INSERT INTO workspace_dashboard (id, workspace, name, description, sort_order, app_key, layout, updated_at, updated_by)
        VALUES (${input.id}, ${input.workspace}, ${input.name}, ${input.description ?? ''}, ${input.sort_order}, ${input.app_key ?? null}, '[]', NOW(), ${input.updated_by})
        RETURNING *
      `;
      return mapWorkspaceDashboardRow(row!);
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async update(workspace: string, id: string, input: DashboardDbUpdate) {
    const touchesSidebar = 'sidebar' in input;
    try {
      const [row] = await this.sql<Record<string, unknown>[]>`
        UPDATE workspace_dashboard
        SET name = COALESCE(${input.name ?? null}, name),
            description = COALESCE(${input.description ?? null}, description),
            layout = COALESCE(${input.layout ? this.json(input.layout) : null}, layout),
            sidebar = ${touchesSidebar ? this.json(input.sidebar ?? null) : this.sql`sidebar`},
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
