import { normalizePostgresError, PostgresDatabaseBase } from '../../../db/postgresBase';
import { mapDatabaseRows, type DatabaseRow } from '../../../db/rowMappers';
import type { ProjectEntityDatabase, ProjectEntityDbCreate } from './projectEntityDatabase';
import {
  PROJECT_ENTITY_SELECT_SQL,
  entityProjectMapper,
  projectEntityLinkMapper,
  projectEntityMapper
} from './projectEntityDatabase';
import { normalizeProjectEntityFields } from './projectDbNormalization';

export class PostgresProjectEntityDatabase
  extends PostgresDatabaseBase
  implements ProjectEntityDatabase
{
  async listProjectEntities(workspace: string, projectId: string) {
    const rows = await this.sql.unsafe<DatabaseRow[]>(
      `${PROJECT_ENTITY_SELECT_SQL} WHERE pe.workspace = $1 AND pe.project_id = $2 ORDER BY e.name`,
      [workspace, projectId]
    );
    return mapDatabaseRows(rows, projectEntityMapper);
  }

  async listProjectEntityLinks(workspace: string, projectId: string) {
    const rows = await this.sql<DatabaseRow[]>`
      SELECT entity_id, created_at
      FROM project_entity
      WHERE workspace = ${workspace} AND project_id = ${projectId}
    `;
    return mapDatabaseRows(rows, projectEntityLinkMapper);
  }

  async getEntityProjects(workspace: string, entityId: string) {
    const rows = await this.sql.unsafe<DatabaseRow[]>(
      `SELECT
         p.*,
         wo.name AS owner_name,
         pe.entity_type AS entity_type_id,
         pet.label AS entity_type_label,
         (SELECT COUNT(*) FROM content_node cn
          WHERE cn.workspace = p.workspace AND cn.project_id = p.id AND cn.type = 'diagram') AS file_count
       FROM project_entity pe
       JOIN project p ON p.workspace = pe.workspace AND p.id = pe.project_id
       LEFT JOIN workspace_owner wo ON wo.id = p.owner
       LEFT JOIN project_entity_type pet ON pet.workspace = pe.workspace AND pet.id = pe.entity_type
       WHERE pe.workspace = $1 AND pe.entity_id = $2
       ORDER BY p.pinned DESC,
         CASE p.status WHEN 'draft' THEN 0 WHEN 'active' THEN 1 WHEN 'complete' THEN 2 ELSE 3 END,
         p.name`,
      [workspace, entityId]
    );
    return mapDatabaseRows(rows, entityProjectMapper);
  }

  async addProjectEntity(input: ProjectEntityDbCreate) {
    const normalized = normalizeProjectEntityFields(input);
    try {
      await this.sql`
        INSERT INTO project_entity (workspace, project_id, entity_id, entity_type, is_done, created_at)
        VALUES (${normalized.workspace}, ${normalized.project_id}, ${normalized.entity_id}, ${normalized.entity_type_id}, ${normalized.is_done}, ${normalized.created_at})
      `;
      const [row] = await this.sql.unsafe<DatabaseRow[]>(
        `${PROJECT_ENTITY_SELECT_SQL} WHERE pe.workspace = $1 AND pe.project_id = $2 AND pe.entity_id = $3`,
        [input.workspace, input.project_id, input.entity_id]
      );
      return projectEntityMapper(row!);
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async updateProjectEntity(
    workspace: string,
    projectId: string,
    entityId: string,
    entityTypeId: string | null,
    isDone: boolean
  ) {
    try {
      const result = await this.sql`
        UPDATE project_entity
        SET entity_type = ${entityTypeId}, is_done = ${isDone}
        WHERE workspace = ${workspace} AND project_id = ${projectId} AND entity_id = ${entityId}
      `;
      if (result.count === 0) return null;
      const [row] = await this.sql.unsafe<DatabaseRow[]>(
        `${PROJECT_ENTITY_SELECT_SQL} WHERE pe.workspace = $1 AND pe.project_id = $2 AND pe.entity_id = $3`,
        [workspace, projectId, entityId]
      );
      return row ? projectEntityMapper(row) : null;
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async removeProjectEntity(workspace: string, projectId: string, entityId: string) {
    try {
      await this.sql`
        DELETE FROM project_entity
        WHERE workspace = ${workspace} AND project_id = ${projectId} AND entity_id = ${entityId}
      `;
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async isEntityLinkedToProject(workspace: string, projectId: string, entityId: string) {
    const [row] = await this.sql<{ exists: boolean }[]>`
      SELECT EXISTS(
        SELECT 1 FROM project_entity
        WHERE workspace = ${workspace} AND project_id = ${projectId} AND entity_id = ${entityId}
      ) AS exists
    `;
    return Boolean(row?.exists);
  }
}
