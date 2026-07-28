import type {
  ProjectDashboardDbCreate,
  ProjectDashboardDbUpdate,
  ProjectDashboardDatabase
} from './projectDashboardDatabase';
import { mapProjectDashboardRow } from './projectDashboardDatabase';
import { normalizePostgresError, PostgresDatabaseBase } from '../../../db/postgresBase';

export class PostgresProjectDashboardDatabase
  extends PostgresDatabaseBase
  implements ProjectDashboardDatabase
{
  async get(workspace: string, projectId: string) {
    const [row] = await this.sql<Record<string, unknown>[]>`
      SELECT * FROM project_dashboard WHERE workspace = ${workspace} AND project_id = ${projectId}
    `;
    return row ? mapProjectDashboardRow(row) : null;
  }

  async create(input: ProjectDashboardDbCreate) {
    try {
      const [row] = await this.sql<Record<string, unknown>[]>`
        INSERT INTO project_dashboard (id, workspace, project_id, layout, updated_at, updated_by)
        VALUES (${input.id}, ${input.workspace}, ${input.project_id}, '[]', NOW(), ${input.updated_by})
        RETURNING *
      `;
      return mapProjectDashboardRow(row!);
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async update(workspace: string, projectId: string, input: ProjectDashboardDbUpdate) {
    try {
      const [row] = await this.sql<Record<string, unknown>[]>`
        UPDATE project_dashboard
        SET layout = ${this.json(input.layout)},
            updated_at = NOW(),
            updated_by = ${input.updated_by}
        WHERE workspace = ${workspace} AND project_id = ${projectId}
        RETURNING *
      `;
      return row ? mapProjectDashboardRow(row) : null;
    } catch (error) {
      return normalizePostgresError(error);
    }
  }
}
