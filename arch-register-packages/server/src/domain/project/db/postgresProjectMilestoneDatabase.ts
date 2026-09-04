import { normalizePostgresError, PostgresDatabaseBase } from '../../../db/postgresBase';
import { mapDatabaseRows, type DatabaseRow } from '../../../db/rowMappers';
import type {
  ProjectMilestoneDatabase,
  ProjectMilestoneDbCreate,
  ProjectMilestoneDbUpdate
} from './projectMilestoneDatabase';
import { projectMilestoneMapper } from './projectMilestoneDatabase';

export class PostgresProjectMilestoneDatabase
  extends PostgresDatabaseBase
  implements ProjectMilestoneDatabase
{
  async listMilestones(workspace: string) {
    const rows = await this.sql<DatabaseRow[]>`
      SELECT * FROM project_milestone WHERE workspace = ${workspace} ORDER BY sort_order, name
    `;
    return mapDatabaseRows(rows, projectMilestoneMapper);
  }

  async getMilestone(workspace: string, projectId: string, id: string) {
    const [row] = await this.sql<DatabaseRow[]>`
      SELECT * FROM project_milestone WHERE workspace = ${workspace} AND project_id = ${projectId} AND id = ${id}
    `;
    return row ? projectMilestoneMapper(row) : null;
  }

  async getMilestoneById(workspace: string, id: string) {
    const [row] = await this.sql<DatabaseRow[]>`
      SELECT * FROM project_milestone WHERE workspace = ${workspace} AND id = ${id}
    `;
    return row ? projectMilestoneMapper(row) : null;
  }

  async createMilestone(input: ProjectMilestoneDbCreate) {
    try {
      const [row] = await this.sql<DatabaseRow[]>`
        INSERT INTO project_milestone (id, workspace, project_id, name, target_date, status, sort_order, created_at, updated_at)
        VALUES (${input.id}, ${input.workspace}, ${input.project_id}, ${input.name}, ${input.target_date}, ${input.status}, ${input.sort_order}, ${input.created_at}, ${input.updated_at})
        RETURNING *
      `;
      return projectMilestoneMapper(row!);
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async updateMilestone(
    workspace: string,
    projectId: string,
    id: string,
    input: ProjectMilestoneDbUpdate
  ) {
    try {
      const [row] = await this.sql<DatabaseRow[]>`
        UPDATE project_milestone
        SET name = ${input.name},
            target_date = ${input.target_date},
            status = ${input.status},
            sort_order = ${input.sort_order},
            updated_at = ${input.updated_at}
        WHERE workspace = ${workspace} AND project_id = ${projectId} AND id = ${id}
        RETURNING *
      `;
      return row ? projectMilestoneMapper(row) : null;
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async deleteMilestone(workspace: string, projectId: string, id: string) {
    const row = await this.getMilestone(workspace, projectId, id);
    if (!row) return null;
    await this.sql`
      DELETE FROM project_milestone WHERE workspace = ${workspace} AND project_id = ${projectId} AND id = ${id}
    `;
    return row;
  }
}
