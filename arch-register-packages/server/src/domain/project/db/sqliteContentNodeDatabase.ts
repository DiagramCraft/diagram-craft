import { newid } from '@diagram-craft/utils/id';
import { SqliteDatabaseBase } from '../../../db/sqliteBase';
import type { ContentNodeDatabase, ContentNodeDbUpsert } from './contentNodeDatabase';
import { CONTENT_NODE_SELECT_SQL, contentNodeMapper } from './contentNodeDatabase';
import { normalizeContentNodeFields } from './projectDbNormalization';

export class SqliteContentNodeDatabase extends SqliteDatabaseBase implements ContentNodeDatabase {
  async listContentNodes(workspace: string, projectId: string) {
    return this.all(
      `${CONTENT_NODE_SELECT_SQL} WHERE cn.workspace = ? AND cn.project_id = ? ORDER BY cn.path`,
      [workspace, projectId],
      contentNodeMapper
    );
  }

  async listAllContentNodes(workspace: string) {
    return this.all(
      `${CONTENT_NODE_SELECT_SQL} WHERE cn.workspace = ? ORDER BY cn.path`,
      [workspace],
      contentNodeMapper
    );
  }

  async listEntityContentNodes(workspace: string, entityId: string) {
    return this.all(
      `${CONTENT_NODE_SELECT_SQL} WHERE cn.workspace = ? AND cn.entity_id = ? ORDER BY cn.path`,
      [workspace, entityId],
      contentNodeMapper
    );
  }

  async listWorkspaceContentNodes(workspace: string) {
    return this.all(
      `${CONTENT_NODE_SELECT_SQL} WHERE cn.workspace = ? AND cn.project_id IS NULL AND cn.entity_id IS NULL ORDER BY cn.path`,
      [workspace],
      contentNodeMapper
    );
  }

  async listContentNodesByMount(workspace: string, mountId: string) {
    return this.all(
      `${CONTENT_NODE_SELECT_SQL} WHERE cn.workspace = ? AND cn.mount_id = ? ORDER BY cn.path`,
      [workspace, mountId],
      contentNodeMapper
    );
  }

  async getContentNodeByPath(workspace: string, projectId: string, path: string) {
    return this.get(
      `${CONTENT_NODE_SELECT_SQL} WHERE cn.workspace = ? AND cn.project_id = ? AND cn.path = ?`,
      [workspace, projectId, path],
      contentNodeMapper
    );
  }

  async getContentNodeById(workspace: string, projectId: string, id: string) {
    return this.get(
      `${CONTENT_NODE_SELECT_SQL} WHERE cn.workspace = ? AND cn.project_id = ? AND cn.id = ?`,
      [workspace, projectId, id],
      contentNodeMapper
    );
  }

  async getAnyContentNodeById(workspace: string, id: string) {
    return this.get(
      `${CONTENT_NODE_SELECT_SQL} WHERE cn.workspace = ? AND cn.id = ?`,
      [workspace, id],
      contentNodeMapper
    );
  }

  async updateContentNodeSizeById(
    workspace: string,
    projectId: string,
    fileId: string,
    sizeBytes: number,
    updated_at: Date
  ) {
    this.run(
      'UPDATE content_node SET size_bytes = ?, updated_at = ? WHERE workspace = ? AND project_id = ? AND id = ?',
      [sizeBytes, updated_at.toISOString(), workspace, projectId, fileId]
    );
  }

  async updateContentNodePreview(
    workspace: string,
    projectId: string,
    fileId: string,
    previewSvg: string | null
  ) {
    this.run(
      'UPDATE content_node SET preview_svg = ? WHERE workspace = ? AND project_id = ? AND id = ?',
      [previewSvg, workspace, projectId, fileId]
    );
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
    this.run(
      `UPDATE content_node
       SET size_bytes = ?,
           comment_count = ?,
           unresolved_comment_count = ?,
           preview_svg = ?,
           updated_at = ?
       WHERE workspace = ? AND (project_id = ? OR entity_id = ?) AND id = ?`,
      [
        sizeBytes,
        commentCount,
        unresolvedCommentCount,
        previewSvg,
        updated_at.toISOString(),
        workspace,
        projectIdOrEntityId,
        projectIdOrEntityId,
        fileId
      ]
    );
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
    this.run(
      `UPDATE content_node
       SET size_bytes = ?,
           comment_count = ?,
           unresolved_comment_count = ?,
           preview_svg = ?,
           updated_at = ?
       WHERE workspace = ? AND project_id IS NULL AND entity_id IS NULL AND id = ?`,
      [
        sizeBytes,
        commentCount,
        unresolvedCommentCount,
        previewSvg,
        updated_at.toISOString(),
        workspace,
        fileId
      ]
    );
  }

  async updateContentNodeTemplateStatus(
    workspace: string,
    projectId: string,
    fileId: string,
    isTemplate: boolean,
    isWorkspaceTemplate: boolean,
    updated_at: Date
  ) {
    this.run(
      'UPDATE content_node SET is_template = ?, is_workspace_template = ?, updated_at = ? WHERE workspace = ? AND project_id = ? AND id = ?',
      [
        isTemplate ? 1 : 0,
        isWorkspaceTemplate ? 1 : 0,
        updated_at.toISOString(),
        workspace,
        projectId,
        fileId
      ]
    );
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
    this.run(
      `INSERT INTO content_metadata (workspace, node_id, title, description, company, category, keywords, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(workspace, node_id) DO UPDATE SET
         title = excluded.title,
         description = excluded.description,
         company = excluded.company,
         category = excluded.category,
         keywords = excluded.keywords,
         updated_at = excluded.updated_at`,
      [
        input.workspace,
        input.node_id,
        input.title,
        input.description,
        input.company,
        input.category,
        JSON.stringify(input.keywords),
        input.updated_at.toISOString()
      ]
    );
  }

  async deleteContentMetadata(workspace: string, nodeId: string) {
    this.run('DELETE FROM content_metadata WHERE workspace = ? AND node_id = ?', [
      workspace,
      nodeId
    ]);
  }

  async upsertContentNode(input: ContentNodeDbUpsert) {
    const id = input.id ?? newid();
    const normalized = normalizeContentNodeFields(input, id);
    const isWorkspaceOwned = normalized.project_id == null && normalized.entity_id == null;
    const ownerClause = isWorkspaceOwned
      ? 'project_id IS NULL AND entity_id IS NULL'
      : normalized.entity_id != null
        ? 'entity_id = ?'
        : 'project_id = ?';
    const ownerValue = isWorkspaceOwned
      ? null
      : normalized.entity_id != null
        ? normalized.entity_id
        : normalized.project_id;

    const tx = this.db.transaction(() => {
      const existing = this.get<{ id: string; created_at: string; mount_id: string | null }>(
        isWorkspaceOwned
          ? `SELECT id, created_at, mount_id FROM content_node WHERE workspace = ? AND project_id IS NULL AND entity_id IS NULL AND path = ?`
          : `SELECT id, created_at, mount_id FROM content_node WHERE workspace = ? AND ${ownerClause} AND path = ?`,
        isWorkspaceOwned ? [input.workspace, input.path] : [input.workspace, ownerValue, input.path]
      );

      if (existing) {
        if (existing.mount_id !== normalized.mount_id) {
          throw new Error('Content node ownership conflict');
        }
        this.run(
          'UPDATE content_node SET name = ?, parent_id = COALESCE(?, parent_id), role = ?, type = CASE WHEN ? IS NOT NULL THEN ? ELSE type END, size_bytes = ?, comment_count = ?, unresolved_comment_count = ?, updated_at = ?, updated_by = ?, mime_type = COALESCE(?, mime_type), original_filename = CASE WHEN ? IS NOT NULL THEN ? ELSE original_filename END, mount_id = COALESCE(?, mount_id) WHERE id = ?',
          [
            input.name,
            normalized.parent_id,
            normalized.role,
            input.mount_id ?? null,
            input.type ?? null,
            input.size_bytes,
            input.comment_count,
            input.unresolved_comment_count,
            normalized.updated_at.toISOString(),
            normalized.updated_by,
            normalized.mime_type,
            normalized.mount_id,
            normalized.original_filename,
            normalized.mount_id,
            existing.id
          ]
        );
      } else {
        this.run(
          'INSERT INTO content_node (id, workspace, project_id, entity_id, parent_id, path, name, role, type, size_bytes, comment_count, unresolved_comment_count, is_template, is_workspace_template, created_at, updated_at, created_by, updated_by, mime_type, original_filename, mount_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [
            id,
            input.workspace,
            normalized.project_id,
            normalized.entity_id,
            normalized.parent_id,
            input.path,
            input.name,
            normalized.role,
            normalized.type,
            input.size_bytes,
            input.comment_count,
            input.unresolved_comment_count,
            0,
            0,
            normalized.created_at.toISOString(),
            normalized.updated_at.toISOString(),
            normalized.created_by,
            normalized.updated_by,
            normalized.mime_type,
            normalized.original_filename,
            normalized.mount_id
          ]
        );
      }
    });

    tx();
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
  }

  async createContentNodeIfAbsent(
    input: Omit<ContentNodeDbUpsert, 'updated_at'> & { updated_at: Date }
  ) {
    let existing = null;
    if (input.project_id != null) {
      existing = await this.getContentNodeByPath(input.workspace, input.project_id, input.path);
    } else if (input.entity_id != null) {
      existing =
        (await this.listEntityContentNodes(input.workspace, input.entity_id)).find(
          n => n.path === input.path
        ) ?? null;
    } else {
      existing =
        (await this.listWorkspaceContentNodes(input.workspace)).find(n => n.path === input.path) ??
        null;
    }
    if (existing) return null;
    return await this.upsertContentNode(input);
  }

  async deleteContentNodesByIds(workspace: string, nodeIds: readonly string[]) {
    if (nodeIds.length === 0) return;
    const placeholders = nodeIds.map(() => '?').join(', ');
    this.run(`DELETE FROM content_node WHERE workspace = ? AND id IN (${placeholders})`, [
      workspace,
      ...nodeIds
    ]);
  }

  async deleteContentNodeByPath(workspace: string, projectId: string, path: string) {
    const row = await this.getContentNodeByPath(workspace, projectId, path);
    if (!row) return null;
    this.run('DELETE FROM content_node WHERE workspace = ? AND project_id = ? AND path = ?', [
      workspace,
      projectId,
      path
    ]);
    return row;
  }

  async renameContentNodeFolder(
    workspace: string,
    projectId: string,
    oldPath: string,
    newPath: string,
    updated_at: Date
  ) {
    const oldPathPrefix = `${oldPath}/`;
    const newPathPrefix = `${newPath}/`;
    const oldPathLength = oldPath.length;

    const folderRow = this.get<{ id: string }>(
      'SELECT id FROM content_node WHERE workspace = ? AND project_id = ? AND path = ? AND type = ?',
      [workspace, projectId, oldPath, 'folder']
    );

    const childIds = this.all<{ id: string }>(
      'SELECT id FROM content_node WHERE workspace = ? AND project_id = ? AND path LIKE ?',
      [workspace, projectId, `${oldPathPrefix}%`]
    );

    const tx = this.db.transaction(() => {
      if (folderRow) {
        this.run(
          'UPDATE content_node SET path = ?, updated_at = ? WHERE workspace = ? AND project_id = ? AND id = ?',
          [newPath, updated_at.toISOString(), workspace, projectId, folderRow.id]
        );
      }
      this.run(
        `UPDATE content_node
         SET path = ? || substr(path, ?),
             updated_at = ?
         WHERE workspace = ? AND project_id = ? AND path LIKE ?`,
        [
          newPathPrefix,
          oldPathLength + 2,
          updated_at.toISOString(),
          workspace,
          projectId,
          `${oldPathPrefix}%`
        ]
      );
    });

    tx();
    return [...(folderRow ? [folderRow.id] : []), ...childIds.map(row => row.id)];
  }

  async deleteContentNodeFolder(workspace: string, projectId: string, folderPath: string) {
    const folder = await this.getContentNodeByPath(workspace, projectId, folderPath);
    if (!folder) return [];

    const descendants = this.all(
      `WITH RECURSIVE desc_tree(id) AS (
         SELECT id FROM content_node WHERE parent_id = ?
         UNION ALL
         SELECT cn.id FROM content_node cn
         JOIN desc_tree d ON cn.parent_id = d.id
       )
       SELECT cn.*, cm.title AS metadata_title, cm.description AS metadata_description,
              cm.company AS metadata_company, cm.category AS metadata_category, cm.keywords AS metadata_keywords
       FROM content_node cn
       LEFT JOIN content_metadata cm ON cm.workspace = cn.workspace AND cm.node_id = cn.id
       WHERE cn.id IN (SELECT id FROM desc_tree)`,
      [folder.id],
      contentNodeMapper
    );

    const tx = this.db.transaction(() => {
      this.run('DELETE FROM content_node WHERE workspace = ? AND project_id = ? AND id = ?', [
        workspace,
        projectId,
        folder.id
      ]);
    });

    tx();
    return [folder, ...descendants];
  }

  async deleteEntityContentNodeByPath(workspace: string, entityId: string, path: string) {
    const row =
      (await this.listEntityContentNodes(workspace, entityId)).find(n => n.path === path) ?? null;
    if (!row) return null;
    this.run('DELETE FROM content_node WHERE workspace = ? AND entity_id = ? AND path = ?', [
      workspace,
      entityId,
      path
    ]);
    return row;
  }

  async renameEntityContentNodeFolder(
    workspace: string,
    entityId: string,
    oldPath: string,
    newPath: string,
    updated_at: Date
  ) {
    const oldPathPrefix = `${oldPath}/`;
    const newPathPrefix = `${newPath}/`;
    const oldPathLength = oldPath.length;

    const folderRow = this.get<{ id: string }>(
      'SELECT id FROM content_node WHERE workspace = ? AND entity_id = ? AND path = ? AND type = ?',
      [workspace, entityId, oldPath, 'folder']
    );

    const childIds = this.all<{ id: string }>(
      'SELECT id FROM content_node WHERE workspace = ? AND entity_id = ? AND path LIKE ?',
      [workspace, entityId, `${oldPathPrefix}%`]
    );

    const tx = this.db.transaction(() => {
      if (folderRow) {
        this.run(
          'UPDATE content_node SET path = ?, updated_at = ? WHERE workspace = ? AND entity_id = ? AND id = ?',
          [newPath, updated_at.toISOString(), workspace, entityId, folderRow.id]
        );
      }
      this.run(
        `UPDATE content_node
         SET path = ? || substr(path, ?),
             updated_at = ?
         WHERE workspace = ? AND entity_id = ? AND path LIKE ?`,
        [
          newPathPrefix,
          oldPathLength + 2,
          updated_at.toISOString(),
          workspace,
          entityId,
          `${oldPathPrefix}%`
        ]
      );
    });

    tx();
    return [...(folderRow ? [folderRow.id] : []), ...childIds.map(row => row.id)];
  }

  async deleteEntityContentNodeFolder(workspace: string, entityId: string, folderPath: string) {
    const entityNodes = await this.listEntityContentNodes(workspace, entityId);
    const folder = entityNodes.find(n => n.path === folderPath && n.type === 'folder') ?? null;
    if (!folder) return [];

    const descendants = this.all(
      `WITH RECURSIVE desc_tree(id) AS (
         SELECT id FROM content_node WHERE parent_id = ?
         UNION ALL
         SELECT cn.id FROM content_node cn
         JOIN desc_tree d ON cn.parent_id = d.id
       )
       SELECT cn.*, cm.title AS metadata_title, cm.description AS metadata_description,
              cm.company AS metadata_company, cm.category AS metadata_category, cm.keywords AS metadata_keywords
       FROM content_node cn
       LEFT JOIN content_metadata cm ON cm.workspace = cn.workspace AND cm.node_id = cn.id
       WHERE cn.id IN (SELECT id FROM desc_tree)`,
      [folder.id],
      contentNodeMapper
    );

    const tx = this.db.transaction(() => {
      this.run('DELETE FROM content_node WHERE workspace = ? AND entity_id = ? AND id = ?', [
        workspace,
        entityId,
        folder.id
      ]);
    });

    tx();
    return [folder, ...descendants];
  }

  async deleteWorkspaceContentNodeByPath(workspace: string, path: string) {
    const row =
      (await this.listWorkspaceContentNodes(workspace)).find(n => n.path === path) ?? null;
    if (!row) return null;
    this.run(
      'DELETE FROM content_node WHERE workspace = ? AND project_id IS NULL AND entity_id IS NULL AND path = ?',
      [workspace, path]
    );
    return row;
  }

  async renameWorkspaceContentNodeFolder(
    workspace: string,
    oldPath: string,
    newPath: string,
    updated_at: Date
  ) {
    const oldPathPrefix = `${oldPath}/`;
    const newPathPrefix = `${newPath}/`;
    const oldPathLength = oldPath.length;

    const folderRow = this.get<{ id: string }>(
      'SELECT id FROM content_node WHERE workspace = ? AND project_id IS NULL AND entity_id IS NULL AND path = ? AND type = ?',
      [workspace, oldPath, 'folder']
    );

    const childIds = this.all<{ id: string }>(
      'SELECT id FROM content_node WHERE workspace = ? AND project_id IS NULL AND entity_id IS NULL AND path LIKE ?',
      [workspace, `${oldPathPrefix}%`]
    );

    const tx = this.db.transaction(() => {
      if (folderRow) {
        this.run(
          'UPDATE content_node SET path = ?, updated_at = ? WHERE workspace = ? AND project_id IS NULL AND entity_id IS NULL AND id = ?',
          [newPath, updated_at.toISOString(), workspace, folderRow.id]
        );
      }
      this.run(
        `UPDATE content_node
         SET path = ? || substr(path, ?),
             updated_at = ?
         WHERE workspace = ? AND project_id IS NULL AND entity_id IS NULL AND path LIKE ?`,
        [newPathPrefix, oldPathLength + 2, updated_at.toISOString(), workspace, `${oldPathPrefix}%`]
      );
    });

    tx();
    return [...(folderRow ? [folderRow.id] : []), ...childIds.map(row => row.id)];
  }

  async deleteWorkspaceContentNodeFolder(workspace: string, folderPath: string) {
    const wsNodes = await this.listWorkspaceContentNodes(workspace);
    const folder = wsNodes.find(n => n.path === folderPath && n.type === 'folder') ?? null;
    if (!folder) return [];

    const descendants = this.all(
      `WITH RECURSIVE desc_tree(id) AS (
         SELECT id FROM content_node WHERE parent_id = ?
         UNION ALL
         SELECT cn.id FROM content_node cn
         JOIN desc_tree d ON cn.parent_id = d.id
       )
       SELECT cn.*, cm.title AS metadata_title, cm.description AS metadata_description,
              cm.company AS metadata_company, cm.category AS metadata_category, cm.keywords AS metadata_keywords
       FROM content_node cn
       LEFT JOIN content_metadata cm ON cm.workspace = cn.workspace AND cm.node_id = cn.id
       WHERE cn.id IN (SELECT id FROM desc_tree)`,
      [folder.id],
      contentNodeMapper
    );

    const tx = this.db.transaction(() => {
      this.run(
        'DELETE FROM content_node WHERE workspace = ? AND project_id IS NULL AND entity_id IS NULL AND id = ?',
        [workspace, folder.id]
      );
    });

    tx();
    return [folder, ...descendants];
  }
}
