import { isUuidLike } from '../../../utils/publicIds';
import { normalizePostgresError, PostgresDatabaseBase } from '../../../db/postgresBase';
import { mapDatabaseRows, type DatabaseRow } from '../../../db/rowMappers';
import type { ProjectCrudDatabase, ProjectDbCreate, ProjectDbUpdate } from './projectCrudDatabase';
import { PROJECT_SELECT_SQL, projectMapper } from './projectCrudDatabase';
import { normalizeProjectPublicId } from './projectDbNormalization';

export class PostgresProjectCrudDatabase
  extends PostgresDatabaseBase
  implements ProjectCrudDatabase
{
  async listProjects(workspace: string) {
    const rows = await this.sql.unsafe<DatabaseRow[]>(
      `${PROJECT_SELECT_SQL} WHERE p.workspace = $1 ORDER BY p.name`,
      [workspace]
    );
    return mapDatabaseRows(rows, projectMapper);
  }

  async getProject(workspace: string, identifier: string) {
    if (!isUuidLike(identifier)) {
      const row = await this.getProjectByPublicId(identifier);
      return row?.workspace === workspace ? row : null;
    }
    const rows = await this.sql.unsafe<DatabaseRow[]>(
      `${PROJECT_SELECT_SQL} WHERE p.workspace = $1 AND p.id = $2`,
      [workspace, identifier]
    );
    return rows[0] ? projectMapper(rows[0]) : null;
  }

  private async getProjectByPublicId(publicId: string) {
    const rows = await this.sql.unsafe<DatabaseRow[]>(
      `${PROJECT_SELECT_SQL} WHERE p.public_id = $1`,
      [publicId]
    );
    return rows[0] ? projectMapper(rows[0]) : null;
  }

  async createProject(input: ProjectDbCreate) {
    const normalized = normalizeProjectPublicId(input);
    try {
      await this.sql`
        INSERT INTO project (id, workspace, public_id, name, description, owner, status, color, start_date, target_date, pinned, created_at, updated_at)
        VALUES (${normalized.id}, ${normalized.workspace}, ${normalized.public_id}, ${normalized.name}, ${normalized.description}, ${normalized.owner}, ${normalized.status}, ${normalized.color}, ${normalized.start_date}, ${normalized.target_date}, ${normalized.pinned}, ${normalized.created_at}, ${normalized.updated_at})
      `;
      return (await this.getProject(input.workspace, input.id))!;
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async updateProject(workspace: string, id: string, input: ProjectDbUpdate) {
    try {
      const result = await this.sql`
        UPDATE project
        SET name = ${input.name},
            description = ${input.description},
            owner = ${input.owner},
            status = ${input.status},
            color = ${input.color},
            start_date = ${input.start_date},
            target_date = ${input.target_date},
            pinned = ${input.pinned},
            updated_at = ${input.updated_at}
        WHERE workspace = ${workspace} AND id = ${id}
      `;
      if (result.count === 0) return null;
      return await this.getProject(workspace, id);
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async deleteProject(workspace: string, id: string) {
    try {
      await this.sql`
        DELETE FROM project
        WHERE workspace = ${workspace} AND id = ${id}
        RETURNING *
      `;
    } catch (error) {
      return normalizePostgresError(error);
    }
  }
}
