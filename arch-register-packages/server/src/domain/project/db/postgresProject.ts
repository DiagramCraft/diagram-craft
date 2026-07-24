import type {
  ProjectDbCreate,
  ProjectDatabase,
  ProjectEntityDbCreate,
  ProjectEntityLinkDbResult,
  ContentNodeDbResult,
  ProjectDbUpdate,
  ContentNodeDbUpsert,
  MarkdownRevisionDbCreate,
  MarkdownRevisionDbResult,
  AssessmentDbCreate,
  AssessmentDbUpdate,
  AssessmentResponseDbUpsert,
  ProjectMilestoneDbCreate,
  ProjectMilestoneDbUpdate
} from './projectDatabase';
import {
  PROJECT_SELECT_SQL,
  CONTENT_NODE_SELECT_SQL,
  PROJECT_ENTITY_SELECT_SQL,
  MARKDOWN_REVISION_SELECT_SQL,
  ASSESSMENT_RESPONSE_SELECT_SQL,
  DIAGRAM_ENTITY_FILE_SELECT_SQL,
  projectMappers
} from './projectDatabase';
import { normalizePostgresError, PostgresDatabaseBase } from '../../../db/postgresBase';
import { mapDatabaseRows, type DatabaseRow } from '../../../db/rowMappers';
import { randomUUID } from 'node:crypto';
import { isUuidLike } from '../../../utils/publicIds';

export class PostgresProjectDatabase extends PostgresDatabaseBase implements ProjectDatabase {
  async listProjects(workspace: string) {
    const rows = await this.sql.unsafe<DatabaseRow[]>(
      `${PROJECT_SELECT_SQL} WHERE p.workspace = $1 ORDER BY p.name`,
      [workspace]
    );
    return mapDatabaseRows(rows, projectMappers.project);
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
    return rows[0] ? projectMappers.project(rows[0]) : null;
  }

  private async getProjectByPublicId(publicId: string) {
    const rows = await this.sql.unsafe<DatabaseRow[]>(
      `${PROJECT_SELECT_SQL} WHERE p.public_id = $1`,
      [publicId]
    );
    return rows[0] ? projectMappers.project(rows[0]) : null;
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
    const rows = await this.sql.unsafe<DatabaseRow[]>(
      `${CONTENT_NODE_SELECT_SQL}
       WHERE cn.workspace = $1 AND cn.project_id = $2
       ORDER BY cn.path`,
      [workspace, projectId]
    );
    return mapDatabaseRows(rows, projectMappers.contentNode);
  }

  async listAllContentNodes(workspace: string) {
    const rows = await this.sql.unsafe<DatabaseRow[]>(
      `${CONTENT_NODE_SELECT_SQL}
       WHERE cn.workspace = $1
       ORDER BY cn.path`,
      [workspace]
    );
    return mapDatabaseRows(rows, projectMappers.contentNode);
  }

  async listEntityContentNodes(workspace: string, entityId: string) {
    const rows = await this.sql.unsafe<DatabaseRow[]>(
      `${CONTENT_NODE_SELECT_SQL}
       WHERE cn.workspace = $1 AND cn.entity_id = $2
       ORDER BY cn.path`,
      [workspace, entityId]
    );
    return mapDatabaseRows(rows, projectMappers.contentNode);
  }

  async listWorkspaceContentNodes(workspace: string) {
    const rows = await this.sql.unsafe<DatabaseRow[]>(
      `${CONTENT_NODE_SELECT_SQL}
       WHERE cn.workspace = $1 AND cn.project_id IS NULL AND cn.entity_id IS NULL
       ORDER BY cn.path`,
      [workspace]
    );
    return mapDatabaseRows(rows, projectMappers.contentNode);
  }

  async listContentNodesByMount(workspace: string, mountId: string) {
    const rows = await this.sql.unsafe<DatabaseRow[]>(
      `${CONTENT_NODE_SELECT_SQL}
       WHERE cn.workspace = $1 AND cn.mount_id = $2
       ORDER BY cn.path`,
      [workspace, mountId]
    );
    return mapDatabaseRows(rows, projectMappers.contentNode);
  }

  async getContentNodeByPath(workspace: string, projectId: string, path: string) {
    const [row] = await this.sql.unsafe<DatabaseRow[]>(
      `${CONTENT_NODE_SELECT_SQL}
       WHERE cn.workspace = $1 AND cn.project_id = $2 AND cn.path = $3`,
      [workspace, projectId, path]
    );
    return row ? projectMappers.contentNode(row) : null;
  }

  async getContentNodeById(workspace: string, projectId: string, id: string) {
    // Externally mounted content can surface synthetic, non-UUID node ids (see
    // isUuidLike usage in getProject above); id/node_id columns are UUID-typed,
    // so treat a non-UUID id as "not found" rather than letting Postgres reject
    // the query outright.
    if (!isUuidLike(id)) return null;
    const [row] = await this.sql.unsafe<DatabaseRow[]>(
      `${CONTENT_NODE_SELECT_SQL}
       WHERE cn.workspace = $1 AND cn.project_id = $2 AND cn.id = $3`,
      [workspace, projectId, id]
    );
    return row ? projectMappers.contentNode(row) : null;
  }

  async getAnyContentNodeById(workspace: string, id: string) {
    if (!isUuidLike(id)) return null;
    const [row] = await this.sql.unsafe<DatabaseRow[]>(
      `${CONTENT_NODE_SELECT_SQL}
       WHERE cn.workspace = $1 AND cn.id = $2`,
      [workspace, id]
    );
    return row ? projectMappers.contentNode(row) : null;
  }

  async listMarkdownRevisions(workspace: string, nodeId: string) {
    if (!isUuidLike(nodeId)) return [];
    const rows = await this.sql.unsafe<DatabaseRow[]>(
      `${MARKDOWN_REVISION_SELECT_SQL}
       WHERE mr.workspace = $1 AND mr.node_id = $2
       ORDER BY mr.revision_number DESC`,
      [workspace, nodeId]
    );
    return mapDatabaseRows(rows, projectMappers.markdownRevision);
  }

  async getMarkdownRevision(workspace: string, nodeId: string, revisionId: string) {
    if (!isUuidLike(nodeId) || !isUuidLike(revisionId)) return null;
    const [row] = await this.sql.unsafe<DatabaseRow[]>(
      `${MARKDOWN_REVISION_SELECT_SQL}
       WHERE mr.workspace = $1 AND mr.node_id = $2 AND mr.id = $3`,
      [workspace, nodeId, revisionId]
    );
    return row ? projectMappers.markdownRevision(row) : null;
  }

  async createMarkdownRevision(input: MarkdownRevisionDbCreate) {
    try {
      const id = input.id ?? randomUUID();
      const [row] = await this.sql<MarkdownRevisionDbResult[]>`
        INSERT INTO content_node_revision
          (id, workspace, node_id, revision_number, title, body, created_at, created_by, restored_from_revision_id, document_type_id, metadata)
        VALUES
          (${id}, ${input.workspace}, ${input.node_id}, ${input.revision_number}, ${input.title}, ${input.body}, ${input.created_at}, ${input.created_by}, ${input.restored_from_revision_id ?? null}, ${input.document_type_id ?? null}, ${this.json(input.metadata ?? {})})
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
      if (input.entity_id != null) {
        const [row] = await this.sql<DatabaseRow[]>`
          INSERT INTO content_node (id, workspace, project_id, entity_id, parent_id, path, name, role, type, size_bytes, comment_count, unresolved_comment_count, is_template, is_workspace_template, created_at, updated_at, created_by, updated_by, mime_type, original_filename, mount_id)
          VALUES (${id}, ${input.workspace}, ${input.project_id ?? null}, ${input.entity_id}, ${input.parent_id ?? null}, ${input.path}, ${input.name}, ${input.role ?? null}, ${input.type ?? 'diagram'}, ${input.size_bytes}, ${input.comment_count}, ${input.unresolved_comment_count}, false, false, ${input.created_atIfNew}, ${input.updated_at}, ${input.created_byIfNew ?? null}, ${input.updated_by ?? null}, ${input.mime_type ?? null}, ${input.original_filename ?? null}, ${input.mount_id ?? null})
          ON CONFLICT (workspace, entity_id, path) WHERE entity_id IS NOT NULL
          DO UPDATE SET
            name = EXCLUDED.name,
            parent_id = COALESCE(EXCLUDED.parent_id, content_node.parent_id),
            role = EXCLUDED.role,
            type = CASE WHEN EXCLUDED.mount_id IS NOT NULL THEN EXCLUDED.type ELSE content_node.type END,
            size_bytes = EXCLUDED.size_bytes,
            comment_count = EXCLUDED.comment_count,
            unresolved_comment_count = EXCLUDED.unresolved_comment_count,
            updated_at = EXCLUDED.updated_at,
            updated_by = EXCLUDED.updated_by,
            mime_type = COALESCE(EXCLUDED.mime_type, content_node.mime_type),
            original_filename = CASE WHEN EXCLUDED.mount_id IS NOT NULL THEN EXCLUDED.original_filename ELSE content_node.original_filename END,
            mount_id = EXCLUDED.mount_id
          WHERE content_node.mount_id IS NOT DISTINCT FROM EXCLUDED.mount_id
          RETURNING id
        `;
        if (!row) throw new Error('Content node ownership conflict');
      } else if (isWorkspaceOwned) {
        const [row] = await this.sql<DatabaseRow[]>`
          INSERT INTO content_node (id, workspace, project_id, entity_id, parent_id, path, name, role, type, size_bytes, comment_count, unresolved_comment_count, is_template, is_workspace_template, created_at, updated_at, created_by, updated_by, mime_type, original_filename, mount_id)
          VALUES (${id}, ${input.workspace}, null, null, ${input.parent_id ?? null}, ${input.path}, ${input.name}, ${input.role ?? null}, ${input.type ?? 'diagram'}, ${input.size_bytes}, ${input.comment_count}, ${input.unresolved_comment_count}, false, false, ${input.created_atIfNew}, ${input.updated_at}, ${input.created_byIfNew ?? null}, ${input.updated_by ?? null}, ${input.mime_type ?? null}, ${input.original_filename ?? null}, ${input.mount_id ?? null})
          ON CONFLICT (workspace, path) WHERE project_id IS NULL AND entity_id IS NULL
          DO UPDATE SET
            name = EXCLUDED.name,
            parent_id = COALESCE(EXCLUDED.parent_id, content_node.parent_id),
            role = EXCLUDED.role,
            type = CASE WHEN EXCLUDED.mount_id IS NOT NULL THEN EXCLUDED.type ELSE content_node.type END,
            size_bytes = EXCLUDED.size_bytes,
            comment_count = EXCLUDED.comment_count,
            unresolved_comment_count = EXCLUDED.unresolved_comment_count,
            updated_at = EXCLUDED.updated_at,
            updated_by = EXCLUDED.updated_by,
            mime_type = COALESCE(EXCLUDED.mime_type, content_node.mime_type),
            original_filename = CASE WHEN EXCLUDED.mount_id IS NOT NULL THEN EXCLUDED.original_filename ELSE content_node.original_filename END,
            mount_id = EXCLUDED.mount_id
          WHERE content_node.mount_id IS NOT DISTINCT FROM EXCLUDED.mount_id
          RETURNING id
        `;
        if (!row) throw new Error('Content node ownership conflict');
      } else {
        const [row] = await this.sql<DatabaseRow[]>`
          INSERT INTO content_node (id, workspace, project_id, entity_id, parent_id, path, name, role, type, size_bytes, comment_count, unresolved_comment_count, is_template, is_workspace_template, created_at, updated_at, created_by, updated_by, mime_type, original_filename, mount_id)
          VALUES (${id}, ${input.workspace}, ${input.project_id ?? null}, ${input.entity_id ?? null}, ${input.parent_id ?? null}, ${input.path}, ${input.name}, ${input.role ?? null}, ${input.type ?? 'diagram'}, ${input.size_bytes}, ${input.comment_count}, ${input.unresolved_comment_count}, false, false, ${input.created_atIfNew}, ${input.updated_at}, ${input.created_byIfNew ?? null}, ${input.updated_by ?? null}, ${input.mime_type ?? null}, ${input.original_filename ?? null}, ${input.mount_id ?? null})
          ON CONFLICT (workspace, project_id, path) WHERE project_id IS NOT NULL
          DO UPDATE SET
            name = EXCLUDED.name,
            parent_id = COALESCE(EXCLUDED.parent_id, content_node.parent_id),
            role = EXCLUDED.role,
            type = CASE WHEN EXCLUDED.mount_id IS NOT NULL THEN EXCLUDED.type ELSE content_node.type END,
            size_bytes = EXCLUDED.size_bytes,
            comment_count = EXCLUDED.comment_count,
            unresolved_comment_count = EXCLUDED.unresolved_comment_count,
            updated_at = EXCLUDED.updated_at,
            updated_by = EXCLUDED.updated_by,
            mime_type = COALESCE(EXCLUDED.mime_type, content_node.mime_type),
            original_filename = CASE WHEN EXCLUDED.mount_id IS NOT NULL THEN EXCLUDED.original_filename ELSE content_node.original_filename END,
            mount_id = EXCLUDED.mount_id
          WHERE content_node.mount_id IS NOT DISTINCT FROM EXCLUDED.mount_id
          RETURNING id
        `;
        if (!row) throw new Error('Content node ownership conflict');
      }
      if (input.project_id != null) {
        return (await this.getContentNodeByPath(input.workspace, input.project_id, input.path))!;
      }
      if (input.entity_id != null) {
        return (await this.listEntityContentNodes(input.workspace, input.entity_id)).find(
          n => n.path === input.path
        )!;
      }
      return (await this.listWorkspaceContentNodes(input.workspace)).find(
        n => n.path === input.path
      )!;
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
      let inserted: { id: string } | undefined;
      if (input.entity_id != null) {
        [inserted] = await this.sql<{ id: string }[]>`
          INSERT INTO content_node (id, workspace, project_id, entity_id, parent_id, path, name, role, type, size_bytes, comment_count, unresolved_comment_count, is_template, is_workspace_template, created_at, updated_at, created_by, updated_by, mime_type, original_filename, mount_id)
          VALUES (${id}, ${input.workspace}, ${input.project_id ?? null}, ${input.entity_id}, ${input.parent_id ?? null}, ${input.path}, ${input.name}, ${input.role ?? null}, ${input.type ?? 'diagram'}, ${input.size_bytes}, ${input.comment_count}, ${input.unresolved_comment_count}, false, false, ${input.created_atIfNew}, ${input.updated_at}, ${input.created_byIfNew ?? null}, ${input.updated_by ?? null}, ${input.mime_type ?? null}, ${input.original_filename ?? null}, ${input.mount_id ?? null})
          ON CONFLICT (workspace, entity_id, path) WHERE entity_id IS NOT NULL DO NOTHING
          RETURNING id
        `;
      } else if (isWorkspaceOwned) {
        [inserted] = await this.sql<{ id: string }[]>`
          INSERT INTO content_node (id, workspace, project_id, entity_id, parent_id, path, name, role, type, size_bytes, comment_count, unresolved_comment_count, is_template, is_workspace_template, created_at, updated_at, created_by, updated_by, mime_type, original_filename, mount_id)
          VALUES (${id}, ${input.workspace}, null, null, ${input.parent_id ?? null}, ${input.path}, ${input.name}, ${input.role ?? null}, ${input.type ?? 'diagram'}, ${input.size_bytes}, ${input.comment_count}, ${input.unresolved_comment_count}, false, false, ${input.created_atIfNew}, ${input.updated_at}, ${input.created_byIfNew ?? null}, ${input.updated_by ?? null}, ${input.mime_type ?? null}, ${input.original_filename ?? null}, ${input.mount_id ?? null})
          ON CONFLICT (workspace, path) WHERE project_id IS NULL AND entity_id IS NULL DO NOTHING
          RETURNING id
        `;
      } else {
        [inserted] = await this.sql<{ id: string }[]>`
          INSERT INTO content_node (id, workspace, project_id, entity_id, parent_id, path, name, role, type, size_bytes, comment_count, unresolved_comment_count, is_template, is_workspace_template, created_at, updated_at, created_by, updated_by, mime_type, original_filename, mount_id)
          VALUES (${id}, ${input.workspace}, ${input.project_id ?? null}, ${input.entity_id ?? null}, ${input.parent_id ?? null}, ${input.path}, ${input.name}, ${input.role ?? null}, ${input.type ?? 'diagram'}, ${input.size_bytes}, ${input.comment_count}, ${input.unresolved_comment_count}, false, false, ${input.created_atIfNew}, ${input.updated_at}, ${input.created_byIfNew ?? null}, ${input.updated_by ?? null}, ${input.mime_type ?? null}, ${input.original_filename ?? null}, ${input.mount_id ?? null})
          ON CONFLICT (workspace, project_id, path) WHERE project_id IS NOT NULL DO NOTHING
          RETURNING id
        `;
      }
      if (!inserted) return null;
      if (input.project_id != null) {
        return await this.getContentNodeByPath(input.workspace, input.project_id, input.path);
      }
      if (input.entity_id != null) {
        return (
          (await this.listEntityContentNodes(input.workspace, input.entity_id)).find(
            n => n.path === input.path
          ) ?? null
        );
      }
      return (
        (await this.listWorkspaceContentNodes(input.workspace)).find(n => n.path === input.path) ??
        null
      );
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
      return row ? projectMappers.contentNode(row as unknown as DatabaseRow) : null;
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async deleteContentNodesByIds(workspace: string, nodeIds: readonly string[]) {
    if (nodeIds.length === 0) return;
    try {
      await this.sql`
        DELETE FROM content_node
        WHERE workspace = ${workspace} AND id IN ${this.sql(nodeIds as string[])}
      `;
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
        SET path = ${newPath} || substring(path from (${oldPath.length + 1})::int),
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
      const [folder] = await this.sql<DatabaseRow[]>`
        SELECT * FROM content_node
        WHERE workspace = ${workspace} AND project_id = ${projectId}
          AND path = ${folderPath} AND type = 'folder'
      `;
      if (!folder) return [];

      const descendants = await this.sql<DatabaseRow[]>`
        WITH RECURSIVE desc_tree AS (
          SELECT * FROM content_node WHERE parent_id = ${String(folder['id'])}
          UNION ALL
          SELECT cn.* FROM content_node cn
          JOIN desc_tree dt ON cn.parent_id = dt.id
        )
        SELECT * FROM desc_tree
      `;

      await this.sql`
        DELETE FROM content_node
        WHERE workspace = ${workspace} AND project_id = ${projectId} AND id = ${String(folder['id'])}
      `;

      return [
        projectMappers.contentNode(folder),
        ...mapDatabaseRows(descendants, projectMappers.contentNode)
      ];
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
        SET path = ${newPath} || substring(path from (${oldPath.length + 1})::int),
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
      const [folder] = await this.sql<DatabaseRow[]>`
        SELECT * FROM content_node
        WHERE workspace = ${workspace} AND entity_id = ${entityId}
          AND path = ${folderPath} AND type = 'folder'
      `;
      if (!folder) return [];

      const descendants = await this.sql<DatabaseRow[]>`
        WITH RECURSIVE desc_tree AS (
          SELECT * FROM content_node WHERE parent_id = ${String(folder['id'])}
          UNION ALL
          SELECT cn.* FROM content_node cn
          JOIN desc_tree dt ON cn.parent_id = dt.id
        )
        SELECT * FROM desc_tree
      `;

      await this.sql`
        DELETE FROM content_node
        WHERE workspace = ${workspace} AND entity_id = ${entityId} AND id = ${String(folder['id'])}
      `;

      return [
        projectMappers.contentNode(folder),
        ...mapDatabaseRows(descendants, projectMappers.contentNode)
      ];
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
        SET path = ${newPath} || substring(path from (${oldPath.length + 1})::int),
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
      const [folder] = await this.sql<DatabaseRow[]>`
        SELECT * FROM content_node
        WHERE workspace = ${workspace} AND project_id IS NULL AND entity_id IS NULL
          AND path = ${folderPath} AND type = 'folder'
      `;
      if (!folder) return [];

      const descendants = await this.sql<DatabaseRow[]>`
        WITH RECURSIVE desc_tree AS (
          SELECT * FROM content_node WHERE parent_id = ${String(folder['id'])}
          UNION ALL
          SELECT cn.* FROM content_node cn
          JOIN desc_tree dt ON cn.parent_id = dt.id
        )
        SELECT * FROM desc_tree
      `;

      await this.sql`
        DELETE FROM content_node
        WHERE workspace = ${workspace} AND project_id IS NULL AND entity_id IS NULL AND id = ${String(folder['id'])}
      `;

      return [
        projectMappers.contentNode(folder),
        ...mapDatabaseRows(descendants, projectMappers.contentNode)
      ];
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async listProjectEntities(workspace: string, projectId: string) {
    const rows = await this.sql.unsafe<DatabaseRow[]>(
      `${PROJECT_ENTITY_SELECT_SQL} WHERE pe.workspace = $1 AND pe.project_id = $2 ORDER BY e.name`,
      [workspace, projectId]
    );
    return mapDatabaseRows(rows, projectMappers.projectEntity);
  }

  async listProjectEntityLinks(workspace: string, projectId: string) {
    const rows = await this.sql<ProjectEntityLinkDbResult[]>`
      SELECT entity_id, created_at
      FROM project_entity
      WHERE workspace = ${workspace} AND project_id = ${projectId}
    `;
    return rows.map(row => ({ entity_id: row.entity_id, created_at: new Date(row.created_at) }));
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
    return mapDatabaseRows(rows, projectMappers.entityProject);
  }

  async addProjectEntity(input: ProjectEntityDbCreate) {
    try {
      await this.sql`
        INSERT INTO project_entity (workspace, project_id, entity_id, entity_type, is_done, created_at)
        VALUES (${input.workspace}, ${input.project_id}, ${input.entity_id}, ${input.entity_type_id}, ${input.is_done ?? false}, ${input.created_at})
      `;
      const [row] = await this.sql.unsafe<DatabaseRow[]>(
        `${PROJECT_ENTITY_SELECT_SQL} WHERE pe.workspace = $1 AND pe.project_id = $2 AND pe.entity_id = $3`,
        [input.workspace, input.project_id, input.entity_id]
      );
      return projectMappers.projectEntity(row!);
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
      return row ? projectMappers.projectEntity(row) : null;
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
    const rows = await this.sql.unsafe<DatabaseRow[]>(
      `${DIAGRAM_ENTITY_FILE_SELECT_SQL}
       WHERE der.workspace = $1 AND der.entity_id = $2
       ORDER BY COALESCE(p.name, ''), pf.name`,
      [workspace, entityId]
    );
    return mapDatabaseRows(rows, projectMappers.diagramEntityFile);
  }

  async listAssessments(workspace: string, projectId: string) {
    const rows = await this.sql<DatabaseRow[]>`
      SELECT * FROM assessment WHERE workspace = ${workspace} AND project_id = ${projectId} ORDER BY name
    `;
    return mapDatabaseRows(rows, projectMappers.assessment);
  }

  async getAssessment(workspace: string, projectId: string, id: string) {
    const [row] = await this.sql<DatabaseRow[]>`
      SELECT * FROM assessment WHERE workspace = ${workspace} AND project_id = ${projectId} AND id = ${id}
    `;
    return row ? projectMappers.assessment(row) : null;
  }

  async getAssessmentById(workspace: string, id: string) {
    const [row] = await this.sql<DatabaseRow[]>`
      SELECT * FROM assessment WHERE workspace = ${workspace} AND id = ${id}
    `;
    return row ? projectMappers.assessment(row) : null;
  }

  async createAssessment(input: AssessmentDbCreate) {
    try {
      const [row] = await this.sql<DatabaseRow[]>`
        INSERT INTO assessment (id, workspace, project_id, name, description, status, scope, scope_conditions, fields, created_at, updated_at)
        VALUES (${input.id}, ${input.workspace}, ${input.project_id}, ${input.name}, ${input.description}, ${input.status}, ${this.json(input.scope)}, ${this.json(input.scope_conditions)}, ${this.json(input.fields)}, ${input.created_at}, ${input.updated_at})
        RETURNING *
      `;
      return projectMappers.assessment(row!);
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async updateAssessment(
    workspace: string,
    projectId: string,
    id: string,
    input: AssessmentDbUpdate
  ) {
    try {
      const [row] = await this.sql<DatabaseRow[]>`
        UPDATE assessment
        SET name = ${input.name},
            description = ${input.description},
            status = ${input.status},
            scope = ${this.json(input.scope)},
            scope_conditions = ${this.json(input.scope_conditions)},
            fields = ${this.json(input.fields)},
            updated_at = ${input.updated_at}
        WHERE workspace = ${workspace} AND project_id = ${projectId} AND id = ${id}
        RETURNING *
      `;
      return row ? projectMappers.assessment(row) : null;
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

  async listMilestones(workspace: string, projectId: string) {
    const rows = await this.sql<DatabaseRow[]>`
      SELECT * FROM project_milestone WHERE workspace = ${workspace} AND project_id = ${projectId} ORDER BY sort_order, name
    `;
    return mapDatabaseRows(rows, projectMappers.projectMilestone);
  }

  async getMilestone(workspace: string, projectId: string, id: string) {
    const [row] = await this.sql<DatabaseRow[]>`
      SELECT * FROM project_milestone WHERE workspace = ${workspace} AND project_id = ${projectId} AND id = ${id}
    `;
    return row ? projectMappers.projectMilestone(row) : null;
  }

  async createMilestone(input: ProjectMilestoneDbCreate) {
    try {
      const [row] = await this.sql<DatabaseRow[]>`
        INSERT INTO project_milestone (id, workspace, project_id, name, target_date, status, sort_order, created_at, updated_at)
        VALUES (${input.id}, ${input.workspace}, ${input.project_id}, ${input.name}, ${input.target_date}, ${input.status}, ${input.sort_order}, ${input.created_at}, ${input.updated_at})
        RETURNING *
      `;
      return projectMappers.projectMilestone(row!);
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
      return row ? projectMappers.projectMilestone(row) : null;
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

  async isEntityLinkedToProject(workspace: string, projectId: string, entityId: string) {
    const [row] = await this.sql<{ exists: boolean }[]>`
      SELECT EXISTS(
        SELECT 1 FROM project_entity
        WHERE workspace = ${workspace} AND project_id = ${projectId} AND entity_id = ${entityId}
      ) AS exists
    `;
    return Boolean(row?.exists);
  }

  async listAssessmentResponses(workspace: string, assessmentId: string) {
    const rows = await this.sql.unsafe<DatabaseRow[]>(
      `${ASSESSMENT_RESPONSE_SELECT_SQL}
       WHERE ar.workspace = $1 AND ar.assessment_id = $2`,
      [workspace, assessmentId]
    );
    return mapDatabaseRows(rows, projectMappers.assessmentResponse);
  }

  async getAssessmentResponse(workspace: string, assessmentId: string, entityId: string) {
    const [row] = await this.sql.unsafe<DatabaseRow[]>(
      `${ASSESSMENT_RESPONSE_SELECT_SQL}
       WHERE ar.workspace = $1 AND ar.assessment_id = $2 AND ar.entity_id = $3`,
      [workspace, assessmentId, entityId]
    );
    return row ? projectMappers.assessmentResponse(row) : null;
  }

  async upsertAssessmentResponse(input: AssessmentResponseDbUpsert) {
    try {
      await this.sql`
        INSERT INTO assessment_response (id, workspace, assessment_id, entity_id, "values", created_at, updated_at, updated_by)
        VALUES (${randomUUID()}, ${input.workspace}, ${input.assessment_id}, ${input.entity_id}, ${this.json(input.values)}, now(), now(), ${input.updated_by})
        ON CONFLICT (workspace, assessment_id, entity_id)
        DO UPDATE SET "values" = ${this.json(input.values)}, updated_at = now(), updated_by = ${input.updated_by}
      `;
      return (await this.getAssessmentResponse(
        input.workspace,
        input.assessment_id,
        input.entity_id
      ))!;
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
