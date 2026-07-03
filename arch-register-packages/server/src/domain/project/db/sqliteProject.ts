import { newid } from '@diagram-craft/utils/id';
import type {
  ProjectDbCreate,
  ProjectDatabase,
  ProjectEntityDbCreate,
  ProjectEntityLinkDbResult,
  ProjectDbUpdate,
  ContentNodeDbUpsert,
  MarkdownRevisionDbCreate,
  AssessmentDbCreate,
  AssessmentDbUpdate
} from './projectDatabase';
import { SqliteDatabaseBase, sqliteMappers } from '../../../db/sqliteBase';
import { isUuidLike } from '../../../utils/publicIds';

const PROJECT_ENTITY_JOIN_SQL = `
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
`;

const PROJECT_JOIN_SQL = `
  SELECT p.*, wo.name AS owner_name
  FROM project p
  LEFT JOIN workspace_owner wo ON wo.id = p.owner
`;

const CONTENT_NODE_SELECT_SQL = `
  SELECT
    cn.*,
    cm.title AS metadata_title,
    cm.description AS metadata_description,
    cm.company AS metadata_company,
    cm.category AS metadata_category,
    cm.keywords AS metadata_keywords
  FROM content_node cn
  LEFT JOIN content_metadata cm ON cm.workspace = cn.workspace AND cm.node_id = cn.id
`;

export class SqliteProjectDatabase extends SqliteDatabaseBase implements ProjectDatabase {
  async listProjects(workspace: string) {
    return this.all(
      `${PROJECT_JOIN_SQL} WHERE p.workspace = ? ORDER BY p.name`,
      [workspace],
      sqliteMappers.enrichedProject
    );
  }

  async getProject(workspace: string, identifier: string) {
    if (!isUuidLike(identifier)) {
      const row = await this.getProjectByPublicId(identifier);
      return row?.workspace === workspace ? row : null;
    }
    return this.get(
      `${PROJECT_JOIN_SQL} WHERE p.workspace = ? AND p.id = ?`,
      [workspace, identifier],
      sqliteMappers.enrichedProject
    );
  }

  private async getProjectByPublicId(publicId: string) {
    return this.get(
      `${PROJECT_JOIN_SQL} WHERE p.public_id = ?`,
      [publicId],
      sqliteMappers.enrichedProject
    );
  }

  async createProject(input: ProjectDbCreate) {
    this.run(
      'INSERT INTO project (id, workspace, public_id, name, description, owner, status, color, target_date, pinned, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        input.id,
        input.workspace,
        input.public_id ?? input.id,
        input.name,
        input.description,
        input.owner,
        input.status,
        input.color,
        input.target_date,
        input.pinned ? 1 : 0,
        input.created_at.toISOString(),
        input.updated_at.toISOString()
      ]
    );
    return (await this.getProject(input.workspace, input.id))!;
  }

  async updateProject(workspace: string, id: string, input: ProjectDbUpdate) {
    this.run(
      'UPDATE project SET name = ?, description = ?, owner = ?, status = ?, color = ?, target_date = ?, pinned = ?, updated_at = ? WHERE workspace = ? AND id = ?',
      [
        input.name,
        input.description,
        input.owner,
        input.status,
        input.color,
        input.target_date,
        input.pinned ? 1 : 0,
        input.updated_at.toISOString(),
        workspace,
        id
      ]
    );
    return await this.getProject(workspace, id);
  }

  async deleteProject(workspace: string, id: string) {
    const row = await this.getProject(workspace, id);
    if (!row) return;
    this.run('DELETE FROM project WHERE workspace = ? AND id = ?', [workspace, id]);
  }

  async listContentNodes(workspace: string, projectId: string) {
    return this.all(
      `${CONTENT_NODE_SELECT_SQL} WHERE cn.workspace = ? AND cn.project_id = ? ORDER BY cn.path`,
      [workspace, projectId],
      sqliteMappers.contentNode
    );
  }

  async listAllContentNodes(workspace: string) {
    return this.all(
      `${CONTENT_NODE_SELECT_SQL} WHERE cn.workspace = ? ORDER BY cn.path`,
      [workspace],
      sqliteMappers.contentNode
    );
  }

  async listEntityContentNodes(workspace: string, entityId: string) {
    return this.all(
      `${CONTENT_NODE_SELECT_SQL} WHERE cn.workspace = ? AND cn.entity_id = ? ORDER BY cn.path`,
      [workspace, entityId],
      sqliteMappers.contentNode
    );
  }

  async listWorkspaceContentNodes(workspace: string) {
    return this.all(
      `${CONTENT_NODE_SELECT_SQL} WHERE cn.workspace = ? AND cn.project_id IS NULL AND cn.entity_id IS NULL ORDER BY cn.path`,
      [workspace],
      sqliteMappers.contentNode
    );
  }

  async getContentNodeByPath(workspace: string, projectId: string, path: string) {
    return this.get(
      `${CONTENT_NODE_SELECT_SQL} WHERE cn.workspace = ? AND cn.project_id = ? AND cn.path = ?`,
      [workspace, projectId, path],
      sqliteMappers.contentNode
    );
  }

  async getContentNodeById(workspace: string, projectId: string, id: string) {
    return this.get(
      `${CONTENT_NODE_SELECT_SQL} WHERE cn.workspace = ? AND cn.project_id = ? AND cn.id = ?`,
      [workspace, projectId, id],
      sqliteMappers.contentNode
    );
  }

  async getAnyContentNodeById(workspace: string, id: string) {
    return this.get(
      `${CONTENT_NODE_SELECT_SQL} WHERE cn.workspace = ? AND cn.id = ?`,
      [workspace, id],
      sqliteMappers.contentNode
    );
  }

  async listMarkdownRevisions(workspace: string, nodeId: string) {
    return this.all(
      `SELECT mr.*, u.display_name AS created_by_name
       FROM content_node_revision mr
       LEFT JOIN users u ON u.id = mr.created_by
       WHERE mr.workspace = ? AND mr.node_id = ?
       ORDER BY mr.revision_number DESC`,
      [workspace, nodeId],
      sqliteMappers.markdownRevision
    );
  }

  async getMarkdownRevision(workspace: string, nodeId: string, revisionId: string) {
    return this.get(
      `SELECT mr.*, u.display_name AS created_by_name
       FROM content_node_revision mr
       LEFT JOIN users u ON u.id = mr.created_by
       WHERE mr.workspace = ? AND mr.node_id = ? AND mr.id = ?`,
      [workspace, nodeId, revisionId],
      sqliteMappers.markdownRevision
    );
  }

  async createMarkdownRevision(input: MarkdownRevisionDbCreate) {
    const id = input.id ?? newid();
    this.run(
      `INSERT INTO content_node_revision
         (id, workspace, node_id, revision_number, title, body, created_at, created_by, restored_from_revision_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        input.workspace,
        input.node_id,
        input.revision_number,
        input.title,
        input.body,
        input.created_at.toISOString(),
        input.created_by,
        input.restored_from_revision_id ?? null
      ]
    );
    return (await this.getMarkdownRevision(input.workspace, input.node_id, id))!;
  }

  async getNextMarkdownRevisionNumber(workspace: string, nodeId: string) {
    const row = this.db
      .prepare(
        'SELECT COALESCE(MAX(revision_number), 0) + 1 AS next_revision_number FROM content_node_revision WHERE workspace = ? AND node_id = ?'
      )
      .get(workspace, nodeId) as { next_revision_number: number };
    return Number(row.next_revision_number);
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
      [sizeBytes, commentCount, unresolvedCommentCount, previewSvg, updated_at.toISOString(), workspace, fileId]
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
    const isWorkspaceOwned = input.project_id == null && input.entity_id == null;
    const ownerClause = isWorkspaceOwned
      ? 'project_id IS NULL AND entity_id IS NULL'
      : input.entity_id != null
        ? 'entity_id = ?'
        : 'project_id = ?';
    const ownerValue = isWorkspaceOwned ? null : (input.entity_id != null ? input.entity_id : input.project_id);

    const tx = this.db.transaction(() => {
      const existing = this.get<{ id: string; created_at: string }>(
        isWorkspaceOwned
          ? `SELECT id, created_at FROM content_node WHERE workspace = ? AND project_id IS NULL AND entity_id IS NULL AND path = ?`
          : `SELECT id, created_at FROM content_node WHERE workspace = ? AND ${ownerClause} AND path = ?`,
        isWorkspaceOwned ? [input.workspace, input.path] : [input.workspace, ownerValue, input.path]
      );

      if (existing) {
        this.run(
          'UPDATE content_node SET name = ?, parent_id = COALESCE(?, parent_id), role = ?, size_bytes = ?, comment_count = ?, unresolved_comment_count = ?, updated_at = ?, updated_by = ?, mime_type = COALESCE(?, mime_type), original_filename = COALESCE(?, original_filename) WHERE id = ?',
          [
            input.name,
            input.parent_id ?? null,
            input.role ?? null,
            input.size_bytes,
            input.comment_count,
            input.unresolved_comment_count,
            input.updated_at.toISOString(),
            input.updated_by ?? null,
            input.mime_type ?? null,
            input.original_filename ?? null,
            existing.id
          ]
        );
      } else {
        this.run(
          'INSERT INTO content_node (id, workspace, project_id, entity_id, parent_id, path, name, role, type, size_bytes, comment_count, unresolved_comment_count, is_template, is_workspace_template, created_at, updated_at, created_by, updated_by, mime_type, original_filename) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [
            id,
            input.workspace,
            input.project_id ?? null,
            input.entity_id ?? null,
            input.parent_id ?? null,
            input.path,
            input.name,
            input.role ?? null,
            input.type ?? 'diagram',
            input.size_bytes,
            input.comment_count,
            input.unresolved_comment_count,
            0,
            0,
            input.created_atIfNew.toISOString(),
            input.updated_at.toISOString(),
            input.created_byIfNew ?? null,
            input.updated_by ?? null,
            input.mime_type ?? null,
            input.original_filename ?? null
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
      existing = (await this.listEntityContentNodes(input.workspace, input.entity_id)).find(
        n => n.path === input.path
      ) ?? null;
    } else {
      existing = (await this.listWorkspaceContentNodes(input.workspace)).find(
        n => n.path === input.path
      ) ?? null;
    }
    if (existing) return null;
    return await this.upsertContentNode(input);
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
      sqliteMappers.contentNode
    );

    const tx = this.db.transaction(() => {
      this.run(
        'DELETE FROM content_node WHERE workspace = ? AND project_id = ? AND id = ?',
        [workspace, projectId, folder.id]
      );
    });

    tx();
    return [folder, ...descendants];
  }

  async deleteEntityContentNodeByPath(workspace: string, entityId: string, path: string) {
    const row = (await this.listEntityContentNodes(workspace, entityId)).find(n => n.path === path) ?? null;
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
      sqliteMappers.contentNode
    );

    const tx = this.db.transaction(() => {
      this.run(
        'DELETE FROM content_node WHERE workspace = ? AND entity_id = ? AND id = ?',
        [workspace, entityId, folder.id]
      );
    });

    tx();
    return [folder, ...descendants];
  }

  async deleteWorkspaceContentNodeByPath(workspace: string, path: string) {
    const row = (await this.listWorkspaceContentNodes(workspace)).find(n => n.path === path) ?? null;
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
        [
          newPathPrefix,
          oldPathLength + 2,
          updated_at.toISOString(),
          workspace,
          `${oldPathPrefix}%`
        ]
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
      sqliteMappers.contentNode
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

  async listProjectEntities(workspace: string, projectId: string) {
    return this.all(
      `${PROJECT_ENTITY_JOIN_SQL} WHERE pe.workspace = ? AND pe.project_id = ? ORDER BY e.name`,
      [workspace, projectId],
      sqliteMappers.projectEntity
    );
  }

  async listProjectEntityLinks(workspace: string, projectId: string) {
    return this.all(
      `SELECT entity_id, created_at FROM project_entity WHERE workspace = ? AND project_id = ?`,
      [workspace, projectId],
      (row: Record<string, unknown>): ProjectEntityLinkDbResult => ({
        entity_id: String(row['entity_id']),
        created_at: new Date(String(row['created_at']))
      })
    );
  }

  async getEntityProjects(workspace: string, entityId: string) {
    return this.all(
      `${PROJECT_ENTITY_JOIN_SQL} WHERE pe.workspace = ? AND pe.entity_id = ? ORDER BY e.name`,
      [workspace, entityId],
      sqliteMappers.projectEntity
    );
  }

  async addProjectEntity(input: ProjectEntityDbCreate) {
    this.run(
      'INSERT INTO project_entity (workspace, project_id, entity_id, entity_type, is_done, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [
        input.workspace,
        input.project_id,
        input.entity_id,
        input.entity_type_id ?? null,
        input.is_done ? 1 : 0,
        input.created_at.toISOString()
      ]
    );
    return this.get(
      `${PROJECT_ENTITY_JOIN_SQL} WHERE pe.workspace = ? AND pe.project_id = ? AND pe.entity_id = ?`,
      [input.workspace, input.project_id, input.entity_id],
      sqliteMappers.projectEntity
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
      `${PROJECT_ENTITY_JOIN_SQL} WHERE pe.workspace = ? AND pe.project_id = ? AND pe.entity_id = ?`,
      [workspace, projectId, entityId],
      sqliteMappers.projectEntity
    );
  }

  async removeProjectEntity(workspace: string, projectId: string, entityId: string) {
    this.run(
      'DELETE FROM project_entity WHERE workspace = ? AND project_id = ? AND entity_id = ?',
      [workspace, projectId, entityId]
    );
  }

  async syncDiagramEntityRefs(workspace: string, fileId: string, entityIds: string[]) {
    const tx = this.db.transaction(() => {
      this.db
        .prepare('DELETE FROM diagram_entity_ref WHERE workspace = ? AND file_id = ?')
        .run(workspace, fileId);
      const insert = this.db.prepare(
        'INSERT OR IGNORE INTO diagram_entity_ref (workspace, file_id, entity_id) VALUES (?, ?, ?)'
      );
      for (const entityId of entityIds) {
        insert.run(workspace, fileId, entityId);
      }
    });
    tx();
  }

  async getEntityDiagramFiles(workspace: string, entityId: string) {
    return this.all(
      `SELECT
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
        cm.keywords    AS file_metadata_keywords,
        p.id           AS project_id,
        p.public_id    AS project_public_id,
        p.name         AS project_name
      FROM diagram_entity_ref der
      JOIN content_node pf ON pf.id = der.file_id AND pf.workspace = der.workspace
      LEFT JOIN content_metadata cm ON cm.workspace = pf.workspace AND cm.node_id = pf.id
      LEFT JOIN project p ON p.id = pf.project_id AND p.workspace = pf.workspace
      WHERE der.workspace = ? AND der.entity_id = ?
      ORDER BY COALESCE(p.name, ''), pf.name`,
      [workspace, entityId],
      row => ({
        file_id: String(row['file_id']),
        file_path: String(row['file_path']),
        file_name: String(row['file_name']),
        file_size_bytes: Number(row['file_size_bytes']),
        file_type: String(row['file_type']) as 'diagram' | 'folder' | 'markdown' | 'file',
        file_preview_svg: row['file_preview_svg'] != null ? String(row['file_preview_svg']) : null,
        file_comment_count: Number(row['file_comment_count'] ?? 0),
        file_unresolved_comment_count: Number(row['file_unresolved_comment_count'] ?? 0),
        file_created_at: new Date(String(row['file_created_at'])),
        file_updated_at: new Date(String(row['file_updated_at'])),
        file_metadata_title:
          row['file_metadata_title'] != null ? String(row['file_metadata_title']) : null,
        file_metadata_description:
          row['file_metadata_description'] != null
            ? String(row['file_metadata_description'])
            : null,
        file_metadata_company:
          row['file_metadata_company'] != null ? String(row['file_metadata_company']) : null,
        file_metadata_category:
          row['file_metadata_category'] != null ? String(row['file_metadata_category']) : null,
        file_metadata_keywords: JSON.parse(String(row['file_metadata_keywords'] ?? '[]')) as string[],
        project_id: String(row['project_id']),
        project_public_id: String(row['project_public_id']),
        project_name: String(row['project_name'])
      })
    );
  }

  async listAssessments(workspace: string, projectId: string) {
    return this.all(
      'SELECT * FROM assessment WHERE workspace = ? AND project_id = ? ORDER BY name',
      [workspace, projectId],
      sqliteMappers.assessment
    );
  }

  async getAssessment(workspace: string, projectId: string, id: string) {
    return this.get(
      'SELECT * FROM assessment WHERE workspace = ? AND project_id = ? AND id = ?',
      [workspace, projectId, id],
      sqliteMappers.assessment
    );
  }

  async createAssessment(input: AssessmentDbCreate) {
    this.run(
      `INSERT INTO assessment (id, workspace, project_id, name, description, status, scope, fields, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.id,
        input.workspace,
        input.project_id,
        input.name,
        input.description,
        input.status,
        JSON.stringify(input.scope),
        JSON.stringify(input.fields),
        input.created_at.toISOString(),
        input.updated_at.toISOString()
      ]
    );
    return (await this.getAssessment(input.workspace, input.project_id, input.id))!;
  }

  async updateAssessment(workspace: string, projectId: string, id: string, input: AssessmentDbUpdate) {
    this.run(
      `UPDATE assessment
       SET name = ?, description = ?, status = ?, scope = ?, fields = ?, updated_at = ?
       WHERE workspace = ? AND project_id = ? AND id = ?`,
      [
        input.name,
        input.description,
        input.status,
        JSON.stringify(input.scope),
        JSON.stringify(input.fields),
        input.updated_at.toISOString(),
        workspace,
        projectId,
        id
      ]
    );
    return await this.getAssessment(workspace, projectId, id);
  }

  async deleteAssessment(workspace: string, projectId: string, id: string) {
    const row = await this.getAssessment(workspace, projectId, id);
    if (!row) return null;
    this.run('DELETE FROM assessment WHERE workspace = ? AND project_id = ? AND id = ?', [
      workspace,
      projectId,
      id
    ]);
    return row;
  }
}
