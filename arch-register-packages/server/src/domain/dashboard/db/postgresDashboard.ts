import type { DashboardWidget } from '@arch-register/api-types/dashboardContract';
import type { DashboardDatabase } from './dashboardDatabase';
import { mapWorkspaceDashboardRow } from './dashboardDatabase';
import { normalizePostgresError, PostgresDatabaseBase } from '../../../db/postgresBase';
import { randomUUID } from 'node:crypto';

export class PostgresDashboardDatabase extends PostgresDatabaseBase implements DashboardDatabase {
  async get(workspace: string) {
    const [row] = await this.sql<Record<string, unknown>[]>`
      SELECT * FROM workspace_dashboard WHERE workspace = ${workspace}
    `;
    return row ? mapWorkspaceDashboardRow(row) : null;
  }

  async put(workspace: string, widgets: DashboardWidget[], actorUserId: string | null) {
    try {
      const [row] = await this.sql<Record<string, unknown>[]>`
        INSERT INTO workspace_dashboard (id, workspace, layout, updated_at, updated_by)
        VALUES (${randomUUID()}, ${workspace}, ${this.json(widgets)}, NOW(), ${actorUserId})
        ON CONFLICT (workspace) DO UPDATE
        SET layout = EXCLUDED.layout, updated_at = NOW(), updated_by = EXCLUDED.updated_by
        RETURNING *
      `;
      return mapWorkspaceDashboardRow(row!);
    } catch (error) {
      return normalizePostgresError(error);
    }
  }
}
