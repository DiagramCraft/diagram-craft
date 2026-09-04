import { SqliteDatabaseBase } from '../../../db/sqliteBase';
import type { ProjectEntityDatabase, ProjectEntityDbCreate } from './projectEntityDatabase';
import {
  PROJECT_ENTITY_SELECT_SQL,
  entityProjectMapper,
  projectEntityLinkMapper,
  projectEntityMapper
} from './projectEntityDatabase';
import { normalizeProjectEntityFields } from './projectDbNormalization';

export class SqliteProjectEntityDatabase
  extends SqliteDatabaseBase
  implements ProjectEntityDatabase
{
  async listProjectEntities(workspace: string, projectId: string) {
    return this.all(
      `${PROJECT_ENTITY_SELECT_SQL} WHERE pe.workspace = ? AND pe.project_id = ? ORDER BY e.name`,
      [workspace, projectId],
      projectEntityMapper
    );
  }

  async listProjectEntityLinks(workspace: string, projectId: string) {
    return this.all(
      `SELECT entity_id, created_at FROM project_entity WHERE workspace = ? AND project_id = ?`,
      [workspace, projectId],
      projectEntityLinkMapper
    );
  }

  async getEntityProjects(workspace: string, entityId: string) {
    return this.all(
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
       WHERE pe.workspace = ? AND pe.entity_id = ?
       ORDER BY p.pinned DESC,
         CASE p.status WHEN 'draft' THEN 0 WHEN 'active' THEN 1 WHEN 'complete' THEN 2 ELSE 3 END,
         p.name`,
      [workspace, entityId],
      entityProjectMapper
    );
  }

  async addProjectEntity(input: ProjectEntityDbCreate) {
    const normalized = normalizeProjectEntityFields(input);
    this.run(
      'INSERT INTO project_entity (workspace, project_id, entity_id, entity_type, is_done, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [
        input.workspace,
        input.project_id,
        input.entity_id,
        normalized.entity_type_id,
        normalized.is_done ? 1 : 0,
        normalized.created_at.toISOString()
      ]
    );
    return this.get(
      `${PROJECT_ENTITY_SELECT_SQL} WHERE pe.workspace = ? AND pe.project_id = ? AND pe.entity_id = ?`,
      [input.workspace, input.project_id, input.entity_id],
      projectEntityMapper
    )!;
  }

  async updateProjectEntity(
    workspace: string,
    projectId: string,
    entityId: string,
    entityTypeId: string | null,
    isDone: boolean
  ) {
    this.run(
      'UPDATE project_entity SET entity_type = ?, is_done = ? WHERE workspace = ? AND project_id = ? AND entity_id = ?',
      [entityTypeId ?? null, isDone ? 1 : 0, workspace, projectId, entityId]
    );
    return this.get(
      `${PROJECT_ENTITY_SELECT_SQL} WHERE pe.workspace = ? AND pe.project_id = ? AND pe.entity_id = ?`,
      [workspace, projectId, entityId],
      projectEntityMapper
    );
  }

  async removeProjectEntity(workspace: string, projectId: string, entityId: string) {
    this.run(
      'DELETE FROM project_entity WHERE workspace = ? AND project_id = ? AND entity_id = ?',
      [workspace, projectId, entityId]
    );
  }

  async isEntityLinkedToProject(workspace: string, projectId: string, entityId: string) {
    const row = this.get(
      'SELECT 1 AS found FROM project_entity WHERE workspace = ? AND project_id = ? AND entity_id = ?',
      [workspace, projectId, entityId],
      (r: Record<string, unknown>) => Boolean(r['found'])
    );
    return Boolean(row);
  }
}
