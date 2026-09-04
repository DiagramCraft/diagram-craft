import { randomUUID } from 'node:crypto';
import { normalizePostgresError, PostgresDatabaseBase } from '../../../db/postgresBase';
import { mapDatabaseRows, type DatabaseRow } from '../../../db/rowMappers';
import { isUuidLike } from '../../../utils/publicIds';
import type {
  ContentNodeDatabase,
  ContentNodeDbResult,
  ContentNodeDbUpsert
} from './contentNodeDatabase';
import { CONTENT_NODE_SELECT_SQL, contentNodeMapper } from './contentNodeDatabase';
import { normalizeContentNodeFields } from './projectDbNormalization';

export class PostgresContentNodeDatabase
  extends PostgresDatabaseBase
  implements ContentNodeDatabase
{
  async listContentNodes(workspace: string, projectId: string) {
    const rows = await this.sql.unsafe<DatabaseRow[]>(
      `${CONTENT_NODE_SELECT_SQL}
       WHERE cn.workspace = $1 AND cn.project_id = $2
       ORDER BY cn.path`,
      [workspace, projectId]
    );
    return mapDatabaseRows(rows, contentNodeMapper);
  }

  async listAllContentNodes(workspace: string) {
    const rows = await this.sql.unsafe<DatabaseRow[]>(
      `${CONTENT_NODE_SELECT_SQL}
       WHERE cn.workspace = $1
       ORDER BY cn.path`,
      [workspace]
    );
    return mapDatabaseRows(rows, contentNodeMapper);
  }

  async listEntityContentNodes(workspace: string, entityId: string) {
    const rows = await this.sql.unsafe<DatabaseRow[]>(
      `${CONTENT_NODE_SELECT_SQL}
       WHERE cn.workspace = $1 AND cn.entity_id = $2
       ORDER BY cn.path`,
      [workspace, entityId]
    );
    return mapDatabaseRows(rows, contentNodeMapper);
  }

  async listWorkspaceContentNodes(workspace: string) {
    const rows = await this.sql.unsafe<DatabaseRow[]>(
      `${CONTENT_NODE_SELECT_SQL}
       WHERE cn.workspace = $1 AND cn.project_id IS NULL AND cn.entity_id IS NULL
       ORDER BY cn.path`,
      [workspace]
    );
    return mapDatabaseRows(rows, contentNodeMapper);
  }

  async listContentNodesByMount(workspace: string, mountId: string) {
    const rows = await this.sql.unsafe<DatabaseRow[]>(
      `${CONTENT_NODE_SELECT_SQL}
       WHERE cn.workspace = $1 AND cn.mount_id = $2
       ORDER BY cn.path`,
      [workspace, mountId]
    );
    return mapDatabaseRows(rows, contentNodeMapper);
  }

  async getContentNodeByPath(workspace: string, projectId: string, path: string) {
    const [row] = await this.sql.unsafe<DatabaseRow[]>(
      `${CONTENT_NODE_SELECT_SQL}
       WHERE cn.workspace = $1 AND cn.project_id = $2 AND cn.path = $3`,
      [workspace, projectId, path]
    );
    return row ? contentNodeMapper(row) : null;
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
    return row ? contentNodeMapper(row) : null;
  }

  async getAnyContentNodeById(workspace: string, id: string) {
    if (!isUuidLike(id)) return null;
    const [row] = await this.sql.unsafe<DatabaseRow[]>(
      `${CONTENT_NODE_SELECT_SQL}
       WHERE cn.workspace = $1 AND cn.id = $2`,
      [workspace, id]
    );
    return row ? contentNodeMapper(row) : null;
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
      const normalized = normalizeContentNodeFields(input, id);
      const isWorkspaceOwned = normalized.project_id == null && normalized.entity_id == null;
      // Partial unique indexes require ON CONFLICT (cols) WHERE condition, not ON CONSTRAINT
      if (input.entity_id != null) {
        const [row] = await this.sql<DatabaseRow[]>`
          INSERT INTO content_node (id, workspace, project_id, entity_id, parent_id, path, name, role, type, size_bytes, comment_count, unresolved_comment_count, is_template, is_workspace_template, created_at, updated_at, created_by, updated_by, mime_type, original_filename, mount_id)
          VALUES (${normalized.id}, ${normalized.workspace}, ${normalized.project_id}, ${normalized.entity_id}, ${normalized.parent_id}, ${normalized.path}, ${normalized.name}, ${normalized.role}, ${normalized.type}, ${normalized.size_bytes}, ${normalized.comment_count}, ${normalized.unresolved_comment_count}, false, false, ${normalized.created_at}, ${normalized.updated_at}, ${normalized.created_by}, ${normalized.updated_by}, ${normalized.mime_type}, ${normalized.original_filename}, ${normalized.mount_id})
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
          VALUES (${normalized.id}, ${normalized.workspace}, ${normalized.project_id}, ${normalized.entity_id}, ${normalized.parent_id}, ${normalized.path}, ${normalized.name}, ${normalized.role}, ${normalized.type}, ${normalized.size_bytes}, ${normalized.comment_count}, ${normalized.unresolved_comment_count}, false, false, ${normalized.created_at}, ${normalized.updated_at}, ${normalized.created_by}, ${normalized.updated_by}, ${normalized.mime_type}, ${normalized.original_filename}, ${normalized.mount_id})
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
          VALUES (${normalized.id}, ${normalized.workspace}, ${normalized.project_id}, ${normalized.entity_id}, ${normalized.parent_id}, ${normalized.path}, ${normalized.name}, ${normalized.role}, ${normalized.type}, ${normalized.size_bytes}, ${normalized.comment_count}, ${normalized.unresolved_comment_count}, false, false, ${normalized.created_at}, ${normalized.updated_at}, ${normalized.created_by}, ${normalized.updated_by}, ${normalized.mime_type}, ${normalized.original_filename}, ${normalized.mount_id})
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
      if (normalized.project_id != null) {
        return (await this.getContentNodeByPath(
          normalized.workspace,
          normalized.project_id,
          normalized.path
        ))!;
      }
      if (normalized.entity_id != null) {
        return (await this.listEntityContentNodes(normalized.workspace, normalized.entity_id)).find(
          n => n.path === normalized.path
        )!;
      }
      return (await this.listWorkspaceContentNodes(normalized.workspace)).find(
        n => n.path === normalized.path
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
      const normalized = normalizeContentNodeFields(input, id);
      const isWorkspaceOwned = normalized.project_id == null && normalized.entity_id == null;
      // Partial unique indexes require ON CONFLICT (cols) WHERE condition, not ON CONSTRAINT
      let inserted: { id: string } | undefined;
      if (input.entity_id != null) {
        [inserted] = await this.sql<{ id: string }[]>`
          INSERT INTO content_node (id, workspace, project_id, entity_id, parent_id, path, name, role, type, size_bytes, comment_count, unresolved_comment_count, is_template, is_workspace_template, created_at, updated_at, created_by, updated_by, mime_type, original_filename, mount_id)
          VALUES (${normalized.id}, ${normalized.workspace}, ${normalized.project_id}, ${normalized.entity_id}, ${normalized.parent_id}, ${normalized.path}, ${normalized.name}, ${normalized.role}, ${normalized.type}, ${normalized.size_bytes}, ${normalized.comment_count}, ${normalized.unresolved_comment_count}, false, false, ${normalized.created_at}, ${normalized.updated_at}, ${normalized.created_by}, ${normalized.updated_by}, ${normalized.mime_type}, ${normalized.original_filename}, ${normalized.mount_id})
          ON CONFLICT (workspace, entity_id, path) WHERE entity_id IS NOT NULL DO NOTHING
          RETURNING id
        `;
      } else if (isWorkspaceOwned) {
        [inserted] = await this.sql<{ id: string }[]>`
          INSERT INTO content_node (id, workspace, project_id, entity_id, parent_id, path, name, role, type, size_bytes, comment_count, unresolved_comment_count, is_template, is_workspace_template, created_at, updated_at, created_by, updated_by, mime_type, original_filename, mount_id)
          VALUES (${normalized.id}, ${normalized.workspace}, ${normalized.project_id}, ${normalized.entity_id}, ${normalized.parent_id}, ${normalized.path}, ${normalized.name}, ${normalized.role}, ${normalized.type}, ${normalized.size_bytes}, ${normalized.comment_count}, ${normalized.unresolved_comment_count}, false, false, ${normalized.created_at}, ${normalized.updated_at}, ${normalized.created_by}, ${normalized.updated_by}, ${normalized.mime_type}, ${normalized.original_filename}, ${normalized.mount_id})
          ON CONFLICT (workspace, path) WHERE project_id IS NULL AND entity_id IS NULL DO NOTHING
          RETURNING id
        `;
      } else {
        [inserted] = await this.sql<{ id: string }[]>`
          INSERT INTO content_node (id, workspace, project_id, entity_id, parent_id, path, name, role, type, size_bytes, comment_count, unresolved_comment_count, is_template, is_workspace_template, created_at, updated_at, created_by, updated_by, mime_type, original_filename, mount_id)
          VALUES (${normalized.id}, ${normalized.workspace}, ${normalized.project_id}, ${normalized.entity_id}, ${normalized.parent_id}, ${normalized.path}, ${normalized.name}, ${normalized.role}, ${normalized.type}, ${normalized.size_bytes}, ${normalized.comment_count}, ${normalized.unresolved_comment_count}, false, false, ${normalized.created_at}, ${normalized.updated_at}, ${normalized.created_by}, ${normalized.updated_by}, ${normalized.mime_type}, ${normalized.original_filename}, ${normalized.mount_id})
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
      const [row] = await this.sql<DatabaseRow[]>`
        DELETE FROM content_node
        WHERE workspace = ${workspace} AND project_id = ${projectId} AND path = ${path}
        RETURNING *
      `;
      return row ? contentNodeMapper(row) : null;
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

      return [contentNodeMapper(folder), ...mapDatabaseRows(descendants, contentNodeMapper)];
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

      return [contentNodeMapper(folder), ...mapDatabaseRows(descendants, contentNodeMapper)];
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

      return [contentNodeMapper(folder), ...mapDatabaseRows(descendants, contentNodeMapper)];
    } catch (error) {
      return normalizePostgresError(error);
    }
  }
}
