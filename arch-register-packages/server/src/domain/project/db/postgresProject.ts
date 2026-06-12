import type {
  ProjectDbCreate,
  ProjectDbResult,
  ProjectDatabase,
  ProjectEntityDbCreate,
  ProjectEntityDbResult,
  ContentNodeDbResult,
  ProjectDbUpdate,
  ContentNodeDbUpsert,
  DiagramEntityFileDbResult
} from './projectDatabase';
import { normalizePostgresError, PostgresDatabaseBase } from '../../../db/postgresBase';
import { randomUUID } from 'node:crypto';

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

  async listContentNodes(workspace: string, projectId: string) {
    return await this.sql<ContentNodeDbResult[]>`
      SELECT *
      FROM content_node
      WHERE workspace = ${workspace} AND project_id = ${projectId}
      ORDER BY path
    `;
  }

  async listEntityContentNodes(workspace: string, entityId: string) {
    return await this.sql<ContentNodeDbResult[]>`
      SELECT *
      FROM content_node
      WHERE workspace = ${workspace} AND entity_id = ${entityId}
      ORDER BY path
    `;
  }

  async getContentNodeByPath(workspace: string, projectId: string, path: string) {
    const [row] = await this.sql<ContentNodeDbResult[]>`
      SELECT * FROM content_node
      WHERE workspace = ${workspace} AND project_id = ${projectId} AND path = ${path}
    `;
    return row ?? null;
  }

  async getContentNodeById(workspace: string, projectId: string, id: string) {
    const [row] = await this.sql<ContentNodeDbResult[]>`
      SELECT * FROM content_node
      WHERE workspace = ${workspace} AND project_id = ${projectId} AND id = ${id}
    `;
    return row ?? null;
  }

  async updateContentNodeSizeById(
    workspace: string,
    projectId: string,
    fileId: string,
    sizeBytes: number,
    updated_at: Date
  ) {
    try {
      await this.sql`
        UPDATE content_node
        SET size_bytes = ${sizeBytes}, updated_at = ${updated_at}
        WHERE workspace = ${workspace} AND project_id = ${projectId} AND id = ${fileId}
      `;
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async updateContentNodePreview(
    workspace: string,
    projectId: string,
    fileId: string,
    previewSvg: string | null
  ) {
    try {
      await this.sql`
        UPDATE content_node
        SET preview_svg = ${previewSvg}
        WHERE workspace = ${workspace} AND project_id = ${projectId} AND id = ${fileId}
      `;
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async updateContentNodeDerivedData(
    workspace: string,
    projectIdOrEntityId: string,
    fileId: string,
    sizeBytes: number,
    commentCount: number,
    unresolvedCommentCount: number,
    previewSvg: string | null,
    updated_at: Date
  ) {
    try {
      await this.sql`
        UPDATE content_node
        SET size_bytes = ${sizeBytes},
            comment_count = ${commentCount},
            unresolved_comment_count = ${unresolvedCommentCount},
            preview_svg = ${previewSvg},
            updated_at = ${updated_at}
        WHERE workspace = ${workspace} 
          AND (project_id = ${projectIdOrEntityId} OR entity_id = ${projectIdOrEntityId})
          AND id = ${fileId}
      `;
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async updateContentNodeTemplateStatus(
    workspace: string,
    projectId: string,
    fileId: string,
    isTemplate: boolean,
    isWorkspaceTemplate: boolean,
    updated_at: Date
  ) {
    try {
      await this.sql`
        UPDATE content_node
        SET is_template = ${isTemplate}, is_workspace_template = ${isWorkspaceTemplate}, updated_at = ${updated_at}
        WHERE workspace = ${workspace} AND project_id = ${projectId} AND id = ${fileId}
      `;
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async upsertContentNode(input: ContentNodeDbUpsert) {
    try {
      const id = input.id ?? randomUUID();
      // Partial unique indexes require ON CONFLICT (cols) WHERE condition, not ON CONSTRAINT
      const [row] = input.entity_id != null
        ? await this.sql<ContentNodeDbResult[]>`
            INSERT INTO content_node (id, workspace, project_id, entity_id, parent_id, path, name, type, size_bytes, comment_count, unresolved_comment_count, is_template, is_workspace_template, created_at, updated_at)
            VALUES (${id}, ${input.workspace}, ${input.project_id ?? null}, ${input.entity_id}, ${input.parent_id ?? null}, ${input.path}, ${input.name}, ${input.type ?? 'diagram'}, ${input.size_bytes}, ${input.comment_count}, ${input.unresolved_comment_count}, false, false, ${input.created_atIfNew}, ${input.updated_at})
            ON CONFLICT (workspace, entity_id, path) WHERE entity_id IS NOT NULL
            DO UPDATE SET
              name = EXCLUDED.name,
              parent_id = COALESCE(EXCLUDED.parent_id, content_node.parent_id),
              size_bytes = EXCLUDED.size_bytes,
              comment_count = EXCLUDED.comment_count,
              unresolved_comment_count = EXCLUDED.unresolved_comment_count,
              updated_at = EXCLUDED.updated_at
            RETURNING *
          `
        : await this.sql<ContentNodeDbResult[]>`
            INSERT INTO content_node (id, workspace, project_id, entity_id, parent_id, path, name, type, size_bytes, comment_count, unresolved_comment_count, is_template, is_workspace_template, created_at, updated_at)
            VALUES (${id}, ${input.workspace}, ${input.project_id ?? null}, ${input.entity_id ?? null}, ${input.parent_id ?? null}, ${input.path}, ${input.name}, ${input.type ?? 'diagram'}, ${input.size_bytes}, ${input.comment_count}, ${input.unresolved_comment_count}, false, false, ${input.created_atIfNew}, ${input.updated_at})
            ON CONFLICT (workspace, project_id, path) WHERE project_id IS NOT NULL
            DO UPDATE SET
              name = EXCLUDED.name,
              parent_id = COALESCE(EXCLUDED.parent_id, content_node.parent_id),
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

  async createContentNodeIfAbsent(
    input: Omit<ContentNodeDbUpsert, 'updated_at'> & { updated_at: Date }
  ) {
    try {
      const id = input.id ?? randomUUID();
      // Partial unique indexes require ON CONFLICT (cols) WHERE condition, not ON CONSTRAINT
      const [row] = input.entity_id != null
        ? await this.sql<ContentNodeDbResult[]>`
            INSERT INTO content_node (id, workspace, project_id, entity_id, parent_id, path, name, type, size_bytes, comment_count, unresolved_comment_count, is_template, is_workspace_template, created_at, updated_at)
            VALUES (${id}, ${input.workspace}, ${input.project_id ?? null}, ${input.entity_id}, ${input.parent_id ?? null}, ${input.path}, ${input.name}, ${input.type ?? 'diagram'}, ${input.size_bytes}, ${input.comment_count}, ${input.unresolved_comment_count}, false, false, ${input.created_atIfNew}, ${input.updated_at})
            ON CONFLICT (workspace, entity_id, path) WHERE entity_id IS NOT NULL DO NOTHING
            RETURNING *
          `
        : await this.sql<ContentNodeDbResult[]>`
            INSERT INTO content_node (id, workspace, project_id, entity_id, parent_id, path, name, type, size_bytes, comment_count, unresolved_comment_count, is_template, is_workspace_template, created_at, updated_at)
            VALUES (${id}, ${input.workspace}, ${input.project_id ?? null}, ${input.entity_id ?? null}, ${input.parent_id ?? null}, ${input.path}, ${input.name}, ${input.type ?? 'diagram'}, ${input.size_bytes}, ${input.comment_count}, ${input.unresolved_comment_count}, false, false, ${input.created_atIfNew}, ${input.updated_at})
            ON CONFLICT (workspace, project_id, path) WHERE project_id IS NOT NULL DO NOTHING
            RETURNING *
          `;
      return row ?? null;
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async deleteContentNodeByPath(workspace: string, projectId: string, path: string) {
    try {
      const [row] = await this.sql<ContentNodeDbResult[]>`
        DELETE FROM content_node
        WHERE workspace = ${workspace} AND project_id = ${projectId} AND path = ${path}
        RETURNING *
      `;
      return row ?? null;
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async renameContentNodeFolder(
    workspace: string,
    projectId: string,
    oldPath: string,
    newPath: string,
    updated_at: Date
  ) {
    try {
      const folderRows = await this.sql<{ id: string }[]>`
        UPDATE content_node
        SET path = ${newPath}, updated_at = ${updated_at}
        WHERE workspace = ${workspace} AND project_id = ${projectId}
          AND path = ${oldPath} AND type = 'folder'
        RETURNING id
      `;
      const childRows = await this.sql<{ id: string }[]>`
        UPDATE content_node
        SET path = ${newPath} || substring(path from ${oldPath.length + 1}),
            updated_at = ${updated_at}
        WHERE workspace = ${workspace} AND project_id = ${projectId} AND path LIKE ${`${oldPath}/%`}
        RETURNING id
      `;
      return [...folderRows.map(r => r.id), ...childRows.map(r => r.id)];
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async deleteContentNodeFolder(workspace: string, projectId: string, folderPath: string) {
    try {
      const [folder] = await this.sql<ContentNodeDbResult[]>`
        SELECT * FROM content_node
        WHERE workspace = ${workspace} AND project_id = ${projectId}
          AND path = ${folderPath} AND type = 'folder'
      `;
      if (!folder) return [];

      const descendants = await this.sql<ContentNodeDbResult[]>`
        WITH RECURSIVE desc_tree AS (
          SELECT * FROM content_node WHERE parent_id = ${folder.id}
          UNION ALL
          SELECT cn.* FROM content_node cn
          JOIN desc_tree dt ON cn.parent_id = dt.id
        )
        SELECT * FROM desc_tree
      `;

      await this.sql`
        DELETE FROM content_node
        WHERE workspace = ${workspace} AND project_id = ${projectId} AND id = ${folder.id}
      `;

      return [folder, ...descendants];
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

  async syncDiagramEntityRefs(workspace: string, fileId: string, entityIds: string[]) {
    try {
      await this.sql.begin(async tx => {
        await tx`
          DELETE FROM diagram_entity_ref
          WHERE workspace = ${workspace} AND file_id = ${fileId}
        `;
        for (const entityId of entityIds) {
          await tx`
            INSERT INTO diagram_entity_ref (workspace, file_id, entity_id)
            VALUES (${workspace}, ${fileId}, ${entityId})
            ON CONFLICT DO NOTHING
          `;
        }
      });
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async getEntityDiagramFiles(workspace: string, entityId: string) {
    return await this.sql<DiagramEntityFileDbResult[]>`
      SELECT
        pf.id          AS file_id,
        pf.path        AS file_path,
        pf.name        AS file_name,
        pf.size_bytes  AS file_size_bytes,
        pf.preview_svg AS file_preview_svg,
        pf.created_at  AS file_created_at,
        pf.updated_at  AS file_updated_at,
        p.id           AS project_id,
        p.name         AS project_name
      FROM diagram_entity_ref der
      JOIN content_node pf ON pf.id = der.file_id AND pf.workspace = der.workspace
      LEFT JOIN project p ON p.id = pf.project_id AND p.workspace = pf.workspace
      WHERE der.workspace = ${workspace} AND der.entity_id = ${entityId}
      ORDER BY COALESCE(p.name, ''), pf.name
    `;
  }
}
