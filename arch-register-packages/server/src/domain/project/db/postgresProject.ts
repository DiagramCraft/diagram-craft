import type {
  ProjectDbCreate,
  ProjectDbResult,
  ProjectDatabase,
  ProjectEntityDbCreate,
  ProjectEntityDbResult,
  ProjectFileDbResult,
  ProjectDbUpdate,
  ProjectFileDbUpsert
} from './projectDatabase';
import { normalizePostgresError, PostgresDatabaseBase } from '../../../db/postgresBase';

export class PostgresProjectDatabase extends PostgresDatabaseBase implements ProjectDatabase {
  async listProjects(workspace: string) {
    return await this.sql<ProjectDbResult[]>`
      SELECT p.*, wo.name AS owner_name
      FROM project p
      LEFT JOIN workspace_owner wo ON wo.id = p.owner
      WHERE p.workspace = ${workspace}
      ORDER BY p.name
    `;
  }

  async getProject(workspace: string, id: string) {
    const [row] = await this.sql<ProjectDbResult[]>`
      SELECT p.*, wo.name AS owner_name
      FROM project p
      LEFT JOIN workspace_owner wo ON wo.id = p.owner
      WHERE p.workspace = ${workspace} AND p.id = ${id}
    `;
    return row ?? null;
  }

  async createProject(input: ProjectDbCreate) {
    try {
      await this.sql`
        INSERT INTO project (id, workspace, name, description, owner, status, color, target_date, pinned, created_at, updated_at)
        VALUES (${input.id}, ${input.workspace}, ${input.name}, ${input.description}, ${input.owner}, ${input.status}, ${input.color}, ${input.target_date}, ${input.pinned}, ${input.created_at}, ${input.updated_at})
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

  async listProjectFiles(workspace: string, projectId: string) {
    return await this.sql<ProjectFileDbResult[]>`
      SELECT *
      FROM project_file
      WHERE workspace = ${workspace} AND project_id = ${projectId}
      ORDER BY path
    `;
  }

  async getProjectFileByPath(workspace: string, projectId: string, path: string) {
    const [row] = await this.sql<ProjectFileDbResult[]>`
      SELECT * FROM project_file
      WHERE workspace = ${workspace} AND project_id = ${projectId} AND path = ${path}
    `;
    return row ?? null;
  }

  async updateProjectFileSizeById(
    workspace: string,
    projectId: string,
    fileId: string,
    sizeBytes: number,
    updated_at: Date
  ) {
    try {
      await this.sql`
        UPDATE project_file
        SET size_bytes = ${sizeBytes}, updated_at = ${updated_at}
        WHERE workspace = ${workspace} AND project_id = ${projectId} AND id = ${fileId}
      `;
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async updateProjectFilePreview(
    workspace: string,
    projectId: string,
    fileId: string,
    previewSvg: string | null
  ) {
    try {
      await this.sql`
        UPDATE project_file
        SET preview_svg = ${previewSvg}
        WHERE workspace = ${workspace} AND project_id = ${projectId} AND id = ${fileId}
      `;
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async updateProjectFileDerivedData(
    workspace: string,
    projectId: string,
    fileId: string,
    sizeBytes: number,
    commentCount: number,
    unresolvedCommentCount: number,
    previewSvg: string | null,
    updated_at: Date
  ) {
    try {
      await this.sql`
        UPDATE project_file
        SET size_bytes = ${sizeBytes},
            comment_count = ${commentCount},
            unresolved_comment_count = ${unresolvedCommentCount},
            preview_svg = ${previewSvg},
            updated_at = ${updated_at}
        WHERE workspace = ${workspace} AND project_id = ${projectId} AND id = ${fileId}
      `;
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async updateProjectFileTemplateStatus(
    workspace: string,
    projectId: string,
    fileId: string,
    isTemplate: boolean,
    isWorkspaceTemplate: boolean,
    updated_at: Date
  ) {
    try {
      await this.sql`
        UPDATE project_file
        SET is_template = ${isTemplate}, is_workspace_template = ${isWorkspaceTemplate}, updated_at = ${updated_at}
        WHERE workspace = ${workspace} AND project_id = ${projectId} AND id = ${fileId}
      `;
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async upsertProjectFile(input: ProjectFileDbUpsert) {
    try {
      const [row] = await this.sql<ProjectFileDbResult[]>`
        INSERT INTO project_file (id, workspace, project_id, path, name, size_bytes, comment_count, unresolved_comment_count, is_template, is_workspace_template, created_at, updated_at)
        VALUES (gen_random_uuid(), ${input.workspace}, ${input.project_id}, ${input.path}, ${input.name}, ${input.size_bytes}, ${input.comment_count}, ${input.unresolved_comment_count}, false, false, ${input.created_atIfNew}, ${input.updated_at})
        ON CONFLICT (workspace, project_id, path)
        DO UPDATE SET
          name = EXCLUDED.name,
          size_bytes = EXCLUDED.size_bytes,
          comment_count = EXCLUDED.comment_count,
          unresolved_comment_count = EXCLUDED.unresolved_comment_count,
          updated_at = EXCLUDED.updated_at
        RETURNING *
      `;
      return row!;
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async createProjectFileIfAbsent(
    input: Omit<ProjectFileDbUpsert, 'updated_at'> & { updated_at: Date }
  ) {
    try {
      const [row] = await this.sql<ProjectFileDbResult[]>`
        INSERT INTO project_file (id, workspace, project_id, path, name, size_bytes, comment_count, unresolved_comment_count, is_template, is_workspace_template, created_at, updated_at)
        VALUES (gen_random_uuid(), ${input.workspace}, ${input.project_id}, ${input.path}, ${input.name}, ${input.size_bytes}, ${input.comment_count}, ${input.unresolved_comment_count}, false, false, ${input.created_atIfNew}, ${input.updated_at})
        ON CONFLICT (workspace, project_id, path) DO NOTHING
        RETURNING *
      `;
      return row ?? null;
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async deleteProjectFileByPath(workspace: string, projectId: string, path: string) {
    try {
      const [row] = await this.sql<ProjectFileDbResult[]>`
        DELETE FROM project_file
        WHERE workspace = ${workspace} AND project_id = ${projectId} AND path = ${path}
        RETURNING *
      `;
      return row ?? null;
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async renameProjectFileFolder(
    workspace: string,
    projectId: string,
    oldPath: string,
    newPath: string,
    updated_at: Date
  ) {
    try {
      const rows = await this.sql<{ id: string }[]>`
        UPDATE project_file
        SET path = ${newPath} || substring(path from ${oldPath.length + 1}),
            updated_at = ${updated_at}
        WHERE workspace = ${workspace} AND project_id = ${projectId} AND path LIKE ${`${oldPath}/%`}
        RETURNING id
      `;
      return rows.map(row => row.id);
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async deleteProjectFileFolder(workspace: string, projectId: string, folderPath: string) {
    try {
      return await this.sql<ProjectFileDbResult[]>`
        DELETE FROM project_file
        WHERE workspace = ${workspace} AND project_id = ${projectId} AND path LIKE ${`${folderPath}/%`}
        RETURNING *
      `;
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async listProjectEntities(workspace: string, projectId: string) {
    return await this.sql<ProjectEntityDbResult[]>`
      SELECT
        pe.workspace,
        pe.project_id,
        pe.entity_id,
        e.name        AS entity_name,
        e.slug        AS entity_slug,
        e.description AS entity_description,
        e.schema_id   AS entity_schema_id,
        es.name       AS entity_schema_name,
        pe.entity_type AS entity_type_id,
        pet.label     AS entity_type_label,
        pe.is_done
      FROM project_entity pe
      JOIN entity e ON e.id = pe.entity_id
      LEFT JOIN entity_schema es ON es.id = e.schema_id
      LEFT JOIN project_entity_type pet ON pet.id = pe.entity_type AND pet.workspace = pe.workspace
      WHERE pe.workspace = ${workspace} AND pe.project_id = ${projectId}
      ORDER BY e.name
    `;
  }

  async getEntityProjects(workspace: string, entityId: string) {
    return await this.sql<ProjectEntityDbResult[]>`
      SELECT
        pe.workspace,
        pe.project_id,
        pe.entity_id,
        e.name        AS entity_name,
        e.slug        AS entity_slug,
        e.description AS entity_description,
        e.schema_id   AS entity_schema_id,
        es.name       AS entity_schema_name,
        pe.entity_type AS entity_type_id,
        pet.label     AS entity_type_label,
        pe.is_done
      FROM project_entity pe
      JOIN entity e ON e.id = pe.entity_id
      LEFT JOIN entity_schema es ON es.id = e.schema_id
      LEFT JOIN project_entity_type pet ON pet.id = pe.entity_type AND pet.workspace = pe.workspace
      WHERE pe.workspace = ${workspace} AND pe.entity_id = ${entityId}
      ORDER BY e.name
    `;
  }

  async addProjectEntity(input: ProjectEntityDbCreate) {
    try {
      await this.sql`
        INSERT INTO project_entity (workspace, project_id, entity_id, entity_type, is_done, created_at)
        VALUES (${input.workspace}, ${input.project_id}, ${input.entity_id}, ${input.entity_type_id}, ${input.is_done ?? false}, ${input.created_at})
      `;
      const [row] = await this.sql<ProjectEntityDbResult[]>`
        SELECT
          pe.workspace,
          pe.project_id,
          pe.entity_id,
          e.name       AS entity_name,
          e.slug       AS entity_slug,
          e.schema_id  AS entity_schema_id,
          es.name      AS entity_schema_name,
          pe.entity_type AS entity_type_id,
          pet.label    AS entity_type_label,
          pe.is_done
        FROM project_entity pe
        JOIN entity e ON e.id = pe.entity_id
        LEFT JOIN entity_schema es ON es.id = e.schema_id
        LEFT JOIN project_entity_type pet ON pet.id = pe.entity_type AND pet.workspace = pe.workspace
        WHERE pe.workspace = ${input.workspace} AND pe.project_id = ${input.project_id} AND pe.entity_id = ${input.entity_id}
      `;
      return row!;
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
      const [row] = await this.sql<ProjectEntityDbResult[]>`
        SELECT
          pe.workspace,
          pe.project_id,
          pe.entity_id,
          e.name       AS entity_name,
          e.slug       AS entity_slug,
          e.schema_id  AS entity_schema_id,
          es.name      AS entity_schema_name,
          pe.entity_type AS entity_type_id,
          pet.label    AS entity_type_label,
          pe.is_done
        FROM project_entity pe
        JOIN entity e ON e.id = pe.entity_id
        LEFT JOIN entity_schema es ON es.id = e.schema_id
        LEFT JOIN project_entity_type pet ON pet.id = pe.entity_type AND pet.workspace = pe.workspace
        WHERE pe.workspace = ${workspace} AND pe.project_id = ${projectId} AND pe.entity_id = ${entityId}
      `;
      return row ?? null;
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
}
