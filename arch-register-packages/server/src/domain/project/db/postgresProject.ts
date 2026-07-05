import type {
  ProjectDbCreate,
  ProjectDbResult,
  ProjectDatabase,
  ProjectEntityDbCreate,
  ProjectEntityDbResult,
  ProjectEntityLinkDbResult,
  ContentNodeDbResult,
  ProjectDbUpdate,
  ContentNodeDbUpsert,
  DiagramEntityFileDbResult,
  MarkdownRevisionDbCreate,
  MarkdownRevisionDbResult,
  AssessmentDbResult,
  AssessmentDbCreate,
  AssessmentDbUpdate,
  AssessmentResponseDbResult,
  AssessmentResponseDbUpsert
} from './projectDatabase';
import { normalizePostgresError, PostgresDatabaseBase } from '../../../db/postgresBase';
import { randomUUID } from 'node:crypto';
import { isUuidLike } from '../../../utils/publicIds';

const CONTENT_NODE_SELECT_SQL = `
  SELECT
    cn.*,
    cm.title AS metadata_title,
    cm.description AS metadata_description,
    cm.company AS metadata_company,
    cm.category AS metadata_category,
    COALESCE(cm.keywords, '[]'::jsonb) AS metadata_keywords
  FROM content_node cn
  LEFT JOIN content_metadata cm ON cm.workspace = cn.workspace AND cm.node_id = cn.id
`;

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

  async getProject(workspace: string, identifier: string) {
    if (!isUuidLike(identifier)) {
      const row = await this.getProjectByPublicId(identifier);
      return row?.workspace === workspace ? row : null;
    }
    const [row] = await this.sql<ProjectDbResult[]>`
      SELECT p.*, wo.name AS owner_name
      FROM project p
      LEFT JOIN workspace_owner wo ON wo.id = p.owner
      WHERE p.workspace = ${workspace} AND p.id = ${identifier}
    `;
    return row ?? null;
  }

  private async getProjectByPublicId(publicId: string) {
    const [row] = await this.sql<ProjectDbResult[]>`
      SELECT p.*, wo.name AS owner_name
      FROM project p
      LEFT JOIN workspace_owner wo ON wo.id = p.owner
      WHERE p.public_id = ${publicId}
    `;
    return row ?? null;
  }

  async createProject(input: ProjectDbCreate) {
    try {
      await this.sql`
        INSERT INTO project (id, workspace, public_id, name, description, owner, status, color, target_date, pinned, created_at, updated_at)
        VALUES (${input.id}, ${input.workspace}, ${input.public_id ?? input.id}, ${input.name}, ${input.description}, ${input.owner}, ${input.status}, ${input.color}, ${input.target_date}, ${input.pinned}, ${input.created_at}, ${input.updated_at})
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
    return await this.sql.unsafe<ContentNodeDbResult[]>(
      `${CONTENT_NODE_SELECT_SQL}
       WHERE cn.workspace = $1 AND cn.project_id = $2
       ORDER BY cn.path`,
      [workspace, projectId]
    );
  }

  async listAllContentNodes(workspace: string) {
    return await this.sql.unsafe<ContentNodeDbResult[]>(
      `${CONTENT_NODE_SELECT_SQL}
       WHERE cn.workspace = $1
       ORDER BY cn.path`,
      [workspace]
    );
  }

  async listEntityContentNodes(workspace: string, entityId: string) {
    return await this.sql.unsafe<ContentNodeDbResult[]>(
      `${CONTENT_NODE_SELECT_SQL}
       WHERE cn.workspace = $1 AND cn.entity_id = $2
       ORDER BY cn.path`,
      [workspace, entityId]
    );
  }

  async listWorkspaceContentNodes(workspace: string) {
    return await this.sql.unsafe<ContentNodeDbResult[]>(
      `${CONTENT_NODE_SELECT_SQL}
       WHERE cn.workspace = $1 AND cn.project_id IS NULL AND cn.entity_id IS NULL
       ORDER BY cn.path`,
      [workspace]
    );
  }

  async getContentNodeByPath(workspace: string, projectId: string, path: string) {
    const [row] = await this.sql.unsafe<ContentNodeDbResult[]>(
      `${CONTENT_NODE_SELECT_SQL}
       WHERE cn.workspace = $1 AND cn.project_id = $2 AND cn.path = $3`,
      [workspace, projectId, path]
    );
    return row ?? null;
  }

  async getContentNodeById(workspace: string, projectId: string, id: string) {
    const [row] = await this.sql.unsafe<ContentNodeDbResult[]>(
      `${CONTENT_NODE_SELECT_SQL}
       WHERE cn.workspace = $1 AND cn.project_id = $2 AND cn.id = $3`,
      [workspace, projectId, id]
    );
    return row ?? null;
  }

  async getAnyContentNodeById(workspace: string, id: string) {
    const [row] = await this.sql.unsafe<ContentNodeDbResult[]>(
      `${CONTENT_NODE_SELECT_SQL}
       WHERE cn.workspace = $1 AND cn.id = $2`,
      [workspace, id]
    );
    return row ?? null;
  }

  async listMarkdownRevisions(workspace: string, nodeId: string) {
    return await this.sql<MarkdownRevisionDbResult[]>`
      SELECT mr.*, u.display_name AS created_by_name
      FROM content_node_revision mr
      LEFT JOIN users u ON u.id = mr.created_by
      WHERE mr.workspace = ${workspace} AND mr.node_id = ${nodeId}
      ORDER BY mr.revision_number DESC
    `;
  }

  async getMarkdownRevision(workspace: string, nodeId: string, revisionId: string) {
    const [row] = await this.sql<MarkdownRevisionDbResult[]>`
      SELECT mr.*, u.display_name AS created_by_name
      FROM content_node_revision mr
      LEFT JOIN users u ON u.id = mr.created_by
      WHERE mr.workspace = ${workspace} AND mr.node_id = ${nodeId} AND mr.id = ${revisionId}
    `;
    return row ?? null;
  }

  async createMarkdownRevision(input: MarkdownRevisionDbCreate) {
    try {
      const id = input.id ?? randomUUID();
      const [row] = await this.sql<MarkdownRevisionDbResult[]>`
        INSERT INTO content_node_revision
          (id, workspace, node_id, revision_number, title, body, created_at, created_by, restored_from_revision_id)
        VALUES
          (${id}, ${input.workspace}, ${input.node_id}, ${input.revision_number}, ${input.title}, ${input.body}, ${input.created_at}, ${input.created_by}, ${input.restored_from_revision_id ?? null})
        RETURNING *
      `;
      if (!row) {
        throw new Error('Failed to create markdown revision');
      }
      return (await this.getMarkdownRevision(input.workspace, input.node_id, row.id))!;
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async getNextMarkdownRevisionNumber(workspace: string, nodeId: string) {
    const [row] = await this.sql<{ next_revision_number: number }[]>`
      SELECT COALESCE(MAX(revision_number), 0) + 1 AS next_revision_number
      FROM content_node_revision
      WHERE workspace = ${workspace} AND node_id = ${nodeId}
    `;
    return Number(row?.next_revision_number ?? 1);
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

  async updateWorkspaceContentNodeDerivedData(
    workspace: string,
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
          AND project_id IS NULL
          AND entity_id IS NULL
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

  async upsertContentMetadata(input: {
    workspace: string;
    node_id: string;
    title: string | null;
    description: string | null;
    company: string | null;
    category: string | null;
    keywords: string[];
    updated_at: Date;
  }) {
    try {
      await this.sql`
        INSERT INTO content_metadata (workspace, node_id, title, description, company, category, keywords, updated_at)
        VALUES (${input.workspace}, ${input.node_id}, ${input.title}, ${input.description}, ${input.company}, ${input.category}, ${this.json(input.keywords)}, ${input.updated_at})
        ON CONFLICT (workspace, node_id)
        DO UPDATE SET
          title = EXCLUDED.title,
          description = EXCLUDED.description,
          company = EXCLUDED.company,
          category = EXCLUDED.category,
          keywords = EXCLUDED.keywords,
          updated_at = EXCLUDED.updated_at
      `;
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async deleteContentMetadata(workspace: string, nodeId: string) {
    try {
      await this.sql`
        DELETE FROM content_metadata
        WHERE workspace = ${workspace} AND node_id = ${nodeId}
      `;
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async upsertContentNode(input: ContentNodeDbUpsert) {
    try {
      const id = input.id ?? randomUUID();
      const isWorkspaceOwned = input.project_id == null && input.entity_id == null;
      // Partial unique indexes require ON CONFLICT (cols) WHERE condition, not ON CONSTRAINT
      let row: ContentNodeDbResult | undefined;
      if (input.entity_id != null) {
        [row] = await this.sql<ContentNodeDbResult[]>`
          INSERT INTO content_node (id, workspace, project_id, entity_id, parent_id, path, name, role, type, size_bytes, comment_count, unresolved_comment_count, is_template, is_workspace_template, created_at, updated_at, created_by, updated_by, mime_type, original_filename)
          VALUES (${id}, ${input.workspace}, ${input.project_id ?? null}, ${input.entity_id}, ${input.parent_id ?? null}, ${input.path}, ${input.name}, ${input.role ?? null}, ${input.type ?? 'diagram'}, ${input.size_bytes}, ${input.comment_count}, ${input.unresolved_comment_count}, false, false, ${input.created_atIfNew}, ${input.updated_at}, ${input.created_byIfNew ?? null}, ${input.updated_by ?? null}, ${input.mime_type ?? null}, ${input.original_filename ?? null})
          ON CONFLICT (workspace, entity_id, path) WHERE entity_id IS NOT NULL
          DO UPDATE SET
            name = EXCLUDED.name,
            parent_id = COALESCE(EXCLUDED.parent_id, content_node.parent_id),
            role = EXCLUDED.role,
            size_bytes = EXCLUDED.size_bytes,
            comment_count = EXCLUDED.comment_count,
            unresolved_comment_count = EXCLUDED.unresolved_comment_count,
            updated_at = EXCLUDED.updated_at,
            updated_by = EXCLUDED.updated_by,
            mime_type = COALESCE(EXCLUDED.mime_type, content_node.mime_type),
            original_filename = COALESCE(EXCLUDED.original_filename, content_node.original_filename)
          RETURNING *
        `;
      } else if (isWorkspaceOwned) {
        [row] = await this.sql<ContentNodeDbResult[]>`
          INSERT INTO content_node (id, workspace, project_id, entity_id, parent_id, path, name, role, type, size_bytes, comment_count, unresolved_comment_count, is_template, is_workspace_template, created_at, updated_at, created_by, updated_by, mime_type, original_filename)
          VALUES (${id}, ${input.workspace}, null, null, ${input.parent_id ?? null}, ${input.path}, ${input.name}, ${input.role ?? null}, ${input.type ?? 'diagram'}, ${input.size_bytes}, ${input.comment_count}, ${input.unresolved_comment_count}, false, false, ${input.created_atIfNew}, ${input.updated_at}, ${input.created_byIfNew ?? null}, ${input.updated_by ?? null}, ${input.mime_type ?? null}, ${input.original_filename ?? null})
          ON CONFLICT (workspace, path) WHERE project_id IS NULL AND entity_id IS NULL
          DO UPDATE SET
            name = EXCLUDED.name,
            parent_id = COALESCE(EXCLUDED.parent_id, content_node.parent_id),
            role = EXCLUDED.role,
            size_bytes = EXCLUDED.size_bytes,
            comment_count = EXCLUDED.comment_count,
            unresolved_comment_count = EXCLUDED.unresolved_comment_count,
            updated_at = EXCLUDED.updated_at,
            updated_by = EXCLUDED.updated_by,
            mime_type = COALESCE(EXCLUDED.mime_type, content_node.mime_type),
            original_filename = COALESCE(EXCLUDED.original_filename, content_node.original_filename)
          RETURNING *
        `;
      } else {
        [row] = await this.sql<ContentNodeDbResult[]>`
          INSERT INTO content_node (id, workspace, project_id, entity_id, parent_id, path, name, role, type, size_bytes, comment_count, unresolved_comment_count, is_template, is_workspace_template, created_at, updated_at, created_by, updated_by, mime_type, original_filename)
          VALUES (${id}, ${input.workspace}, ${input.project_id ?? null}, ${input.entity_id ?? null}, ${input.parent_id ?? null}, ${input.path}, ${input.name}, ${input.role ?? null}, ${input.type ?? 'diagram'}, ${input.size_bytes}, ${input.comment_count}, ${input.unresolved_comment_count}, false, false, ${input.created_atIfNew}, ${input.updated_at}, ${input.created_byIfNew ?? null}, ${input.updated_by ?? null}, ${input.mime_type ?? null}, ${input.original_filename ?? null})
          ON CONFLICT (workspace, project_id, path) WHERE project_id IS NOT NULL
          DO UPDATE SET
            name = EXCLUDED.name,
            parent_id = COALESCE(EXCLUDED.parent_id, content_node.parent_id),
            role = EXCLUDED.role,
            size_bytes = EXCLUDED.size_bytes,
            comment_count = EXCLUDED.comment_count,
            unresolved_comment_count = EXCLUDED.unresolved_comment_count,
            updated_at = EXCLUDED.updated_at,
            updated_by = EXCLUDED.updated_by,
            mime_type = COALESCE(EXCLUDED.mime_type, content_node.mime_type),
            original_filename = COALESCE(EXCLUDED.original_filename, content_node.original_filename)
          RETURNING *
        `;
      }
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
      const isWorkspaceOwned = input.project_id == null && input.entity_id == null;
      // Partial unique indexes require ON CONFLICT (cols) WHERE condition, not ON CONSTRAINT
      let row: ContentNodeDbResult | undefined;
      if (input.entity_id != null) {
        [row] = await this.sql<ContentNodeDbResult[]>`
          INSERT INTO content_node (id, workspace, project_id, entity_id, parent_id, path, name, role, type, size_bytes, comment_count, unresolved_comment_count, is_template, is_workspace_template, created_at, updated_at, created_by, updated_by, mime_type, original_filename)
          VALUES (${id}, ${input.workspace}, ${input.project_id ?? null}, ${input.entity_id}, ${input.parent_id ?? null}, ${input.path}, ${input.name}, ${input.role ?? null}, ${input.type ?? 'diagram'}, ${input.size_bytes}, ${input.comment_count}, ${input.unresolved_comment_count}, false, false, ${input.created_atIfNew}, ${input.updated_at}, ${input.created_byIfNew ?? null}, ${input.updated_by ?? null}, ${input.mime_type ?? null}, ${input.original_filename ?? null})
          ON CONFLICT (workspace, entity_id, path) WHERE entity_id IS NOT NULL DO NOTHING
          RETURNING *
        `;
      } else if (isWorkspaceOwned) {
        [row] = await this.sql<ContentNodeDbResult[]>`
          INSERT INTO content_node (id, workspace, project_id, entity_id, parent_id, path, name, role, type, size_bytes, comment_count, unresolved_comment_count, is_template, is_workspace_template, created_at, updated_at, created_by, updated_by, mime_type, original_filename)
          VALUES (${id}, ${input.workspace}, null, null, ${input.parent_id ?? null}, ${input.path}, ${input.name}, ${input.role ?? null}, ${input.type ?? 'diagram'}, ${input.size_bytes}, ${input.comment_count}, ${input.unresolved_comment_count}, false, false, ${input.created_atIfNew}, ${input.updated_at}, ${input.created_byIfNew ?? null}, ${input.updated_by ?? null}, ${input.mime_type ?? null}, ${input.original_filename ?? null})
          ON CONFLICT (workspace, path) WHERE project_id IS NULL AND entity_id IS NULL DO NOTHING
          RETURNING *
        `;
      } else {
        [row] = await this.sql<ContentNodeDbResult[]>`
          INSERT INTO content_node (id, workspace, project_id, entity_id, parent_id, path, name, role, type, size_bytes, comment_count, unresolved_comment_count, is_template, is_workspace_template, created_at, updated_at, created_by, updated_by, mime_type, original_filename)
          VALUES (${id}, ${input.workspace}, ${input.project_id ?? null}, ${input.entity_id ?? null}, ${input.parent_id ?? null}, ${input.path}, ${input.name}, ${input.role ?? null}, ${input.type ?? 'diagram'}, ${input.size_bytes}, ${input.comment_count}, ${input.unresolved_comment_count}, false, false, ${input.created_atIfNew}, ${input.updated_at}, ${input.created_byIfNew ?? null}, ${input.updated_by ?? null}, ${input.mime_type ?? null}, ${input.original_filename ?? null})
          ON CONFLICT (workspace, project_id, path) WHERE project_id IS NOT NULL DO NOTHING
          RETURNING *
        `;
      }
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

  async deleteEntityContentNodeByPath(workspace: string, entityId: string, path: string) {
    try {
      const [row] = await this.sql<ContentNodeDbResult[]>`
        DELETE FROM content_node
        WHERE workspace = ${workspace} AND entity_id = ${entityId} AND path = ${path}
        RETURNING *
      `;
      return row ?? null;
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async renameEntityContentNodeFolder(
    workspace: string,
    entityId: string,
    oldPath: string,
    newPath: string,
    updated_at: Date
  ) {
    try {
      const folderRows = await this.sql<{ id: string }[]>`
        UPDATE content_node
        SET path = ${newPath}, updated_at = ${updated_at}
        WHERE workspace = ${workspace} AND entity_id = ${entityId}
          AND path = ${oldPath} AND type = 'folder'
        RETURNING id
      `;
      const childRows = await this.sql<{ id: string }[]>`
        UPDATE content_node
        SET path = ${newPath} || substring(path from ${oldPath.length + 1}),
            updated_at = ${updated_at}
        WHERE workspace = ${workspace} AND entity_id = ${entityId} AND path LIKE ${`${oldPath}/%`}
        RETURNING id
      `;
      return [...folderRows.map(r => r.id), ...childRows.map(r => r.id)];
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async deleteEntityContentNodeFolder(workspace: string, entityId: string, folderPath: string) {
    try {
      const [folder] = await this.sql<ContentNodeDbResult[]>`
        SELECT * FROM content_node
        WHERE workspace = ${workspace} AND entity_id = ${entityId}
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
        WHERE workspace = ${workspace} AND entity_id = ${entityId} AND id = ${folder.id}
      `;

      return [folder, ...descendants];
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async deleteWorkspaceContentNodeByPath(workspace: string, path: string) {
    try {
      const [row] = await this.sql<ContentNodeDbResult[]>`
        DELETE FROM content_node
        WHERE workspace = ${workspace} AND project_id IS NULL AND entity_id IS NULL AND path = ${path}
        RETURNING *
      `;
      return row ?? null;
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async renameWorkspaceContentNodeFolder(
    workspace: string,
    oldPath: string,
    newPath: string,
    updated_at: Date
  ) {
    try {
      const folderRows = await this.sql<{ id: string }[]>`
        UPDATE content_node
        SET path = ${newPath}, updated_at = ${updated_at}
        WHERE workspace = ${workspace} AND project_id IS NULL AND entity_id IS NULL
          AND path = ${oldPath} AND type = 'folder'
        RETURNING id
      `;
      const childRows = await this.sql<{ id: string }[]>`
        UPDATE content_node
        SET path = ${newPath} || substring(path from ${oldPath.length + 1}),
            updated_at = ${updated_at}
        WHERE workspace = ${workspace} AND project_id IS NULL AND entity_id IS NULL
          AND path LIKE ${`${oldPath}/%`}
        RETURNING id
      `;
      return [...folderRows.map(r => r.id), ...childRows.map(r => r.id)];
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async deleteWorkspaceContentNodeFolder(workspace: string, folderPath: string) {
    try {
      const [folder] = await this.sql<ContentNodeDbResult[]>`
        SELECT * FROM content_node
        WHERE workspace = ${workspace} AND project_id IS NULL AND entity_id IS NULL
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
        WHERE workspace = ${workspace} AND project_id IS NULL AND entity_id IS NULL AND id = ${folder.id}
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
      JOIN entity e ON e.id = pe.entity_id AND e.deleted_at IS NULL
      LEFT JOIN entity_schema es ON es.id = e.schema_id
      LEFT JOIN project_entity_type pet ON pet.id = pe.entity_type AND pet.workspace = pe.workspace
      WHERE pe.workspace = ${workspace} AND pe.project_id = ${projectId}
      ORDER BY e.name
    `;
  }

  async listProjectEntityLinks(workspace: string, projectId: string) {
    return await this.sql<ProjectEntityLinkDbResult[]>`
      SELECT entity_id, created_at
      FROM project_entity
      WHERE workspace = ${workspace} AND project_id = ${projectId}
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
      JOIN entity e ON e.id = pe.entity_id AND e.deleted_at IS NULL
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
          e.description AS entity_description,
          e.schema_id  AS entity_schema_id,
          es.name      AS entity_schema_name,
          pe.entity_type AS entity_type_id,
          pet.label    AS entity_type_label,
          pe.is_done
        FROM project_entity pe
        JOIN entity e ON e.id = pe.entity_id AND e.deleted_at IS NULL
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
          e.description AS entity_description,
          e.schema_id  AS entity_schema_id,
          es.name      AS entity_schema_name,
          pe.entity_type AS entity_type_id,
          pet.label    AS entity_type_label,
          pe.is_done
        FROM project_entity pe
        JOIN entity e ON e.id = pe.entity_id AND e.deleted_at IS NULL
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
        pf.type        AS file_type,
        pf.preview_svg AS file_preview_svg,
        pf.comment_count AS file_comment_count,
        pf.unresolved_comment_count AS file_unresolved_comment_count,
        pf.created_at  AS file_created_at,
        pf.updated_at  AS file_updated_at,
        cm.title       AS file_metadata_title,
        cm.description AS file_metadata_description,
        cm.company     AS file_metadata_company,
        cm.category    AS file_metadata_category,
        COALESCE(cm.keywords, '[]'::jsonb) AS file_metadata_keywords,
        p.id           AS project_id,
        p.public_id    AS project_public_id,
        p.name         AS project_name
      FROM diagram_entity_ref der
      JOIN content_node pf ON pf.id = der.file_id AND pf.workspace = der.workspace
      LEFT JOIN content_metadata cm ON cm.workspace = pf.workspace AND cm.node_id = pf.id
      LEFT JOIN project p ON p.id = pf.project_id AND p.workspace = pf.workspace
      WHERE der.workspace = ${workspace} AND der.entity_id = ${entityId}
      ORDER BY COALESCE(p.name, ''), pf.name
    `;
  }

  async listAssessments(workspace: string, projectId: string) {
    return await this.sql<AssessmentDbResult[]>`
      SELECT * FROM assessment WHERE workspace = ${workspace} AND project_id = ${projectId} ORDER BY name
    `;
  }

  async getAssessment(workspace: string, projectId: string, id: string) {
    const [row] = await this.sql<AssessmentDbResult[]>`
      SELECT * FROM assessment WHERE workspace = ${workspace} AND project_id = ${projectId} AND id = ${id}
    `;
    return row ?? null;
  }

  async getAssessmentById(workspace: string, id: string) {
    const [row] = await this.sql<AssessmentDbResult[]>`
      SELECT * FROM assessment WHERE workspace = ${workspace} AND id = ${id}
    `;
    return row ?? null;
  }

  async createAssessment(input: AssessmentDbCreate) {
    try {
      const [row] = await this.sql<AssessmentDbResult[]>`
        INSERT INTO assessment (id, workspace, project_id, name, description, status, scope, fields, created_at, updated_at)
        VALUES (${input.id}, ${input.workspace}, ${input.project_id}, ${input.name}, ${input.description}, ${input.status}, ${this.json(input.scope)}, ${this.json(input.fields)}, ${input.created_at}, ${input.updated_at})
        RETURNING *
      `;
      return row!;
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async updateAssessment(workspace: string, projectId: string, id: string, input: AssessmentDbUpdate) {
    try {
      const [row] = await this.sql<AssessmentDbResult[]>`
        UPDATE assessment
        SET name = ${input.name},
            description = ${input.description},
            status = ${input.status},
            scope = ${this.json(input.scope)},
            fields = ${this.json(input.fields)},
            updated_at = ${input.updated_at}
        WHERE workspace = ${workspace} AND project_id = ${projectId} AND id = ${id}
        RETURNING *
      `;
      return row ?? null;
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async deleteAssessment(workspace: string, projectId: string, id: string) {
    const row = await this.getAssessment(workspace, projectId, id);
    if (!row) return null;
    await this.sql`
      DELETE FROM assessment WHERE workspace = ${workspace} AND project_id = ${projectId} AND id = ${id}
    `;
    return row;
  }

  async listAssessmentResponses(workspace: string, assessmentId: string) {
    return await this.sql<AssessmentResponseDbResult[]>`
      SELECT * FROM assessment_response WHERE workspace = ${workspace} AND assessment_id = ${assessmentId}
    `;
  }

  async getAssessmentResponse(workspace: string, assessmentId: string, entityId: string) {
    const [row] = await this.sql<AssessmentResponseDbResult[]>`
      SELECT * FROM assessment_response
      WHERE workspace = ${workspace} AND assessment_id = ${assessmentId} AND entity_id = ${entityId}
    `;
    return row ?? null;
  }

  async upsertAssessmentResponse(input: AssessmentResponseDbUpsert) {
    try {
      const [row] = await this.sql<AssessmentResponseDbResult[]>`
        INSERT INTO assessment_response (id, workspace, assessment_id, entity_id, "values", created_at, updated_at, updated_by)
        VALUES (${randomUUID()}, ${input.workspace}, ${input.assessment_id}, ${input.entity_id}, ${this.json(input.values)}, now(), now(), ${input.updated_by})
        ON CONFLICT (workspace, assessment_id, entity_id)
        DO UPDATE SET "values" = ${this.json(input.values)}, updated_at = now(), updated_by = ${input.updated_by}
        RETURNING *
      `;
      return row!;
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async countAssessmentResponses(workspace: string, assessmentId: string) {
    const [row] = await this.sql<{ count: string }[]>`
      SELECT COUNT(*) AS count FROM assessment_response
      WHERE workspace = ${workspace} AND assessment_id = ${assessmentId}
    `;
    return Number(row?.count ?? 0);
  }
}
