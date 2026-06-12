import { newid } from '@diagram-craft/utils/id';
import type {
  ProjectDbCreate,
  ProjectDatabase,
  ProjectEntityDbCreate,
  ProjectDbUpdate,
  ContentNodeDbUpsert
} from './projectDatabase';
import { SqliteDatabaseBase, sqliteMappers } from '../../../db/sqliteBase';

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
  JOIN entity e ON e.id = pe.entity_id
  LEFT JOIN entity_schema es ON es.id = e.schema_id
  LEFT JOIN project_entity_type pet ON pet.id = pe.entity_type AND pet.workspace = pe.workspace
`;

const PROJECT_JOIN_SQL = `
  SELECT p.*, wo.name AS owner_name
  FROM project p
  LEFT JOIN workspace_owner wo ON wo.id = p.owner
`;

export class SqliteProjectDatabase extends SqliteDatabaseBase implements ProjectDatabase {
  async listProjects(workspace: string) {
    return this.all(
      `${PROJECT_JOIN_SQL} WHERE p.workspace = ? ORDER BY p.name`,
      [workspace],
      sqliteMappers.enrichedProject
    );
  }

  async getProject(workspace: string, id: string) {
    return this.get(
      `${PROJECT_JOIN_SQL} WHERE p.workspace = ? AND p.id = ?`,
      [workspace, id],
      sqliteMappers.enrichedProject
    );
  }

  async createProject(input: ProjectDbCreate) {
    this.run(
      'INSERT INTO project (id, workspace, name, description, owner, status, color, target_date, pinned, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        input.id,
        input.workspace,
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
      'SELECT * FROM content_node WHERE workspace = ? AND project_id = ? ORDER BY path',
      [workspace, projectId],
      sqliteMappers.contentNode
    );
  }

  async getContentNodeByPath(workspace: string, projectId: string, path: string) {
    return this.get(
      'SELECT * FROM content_node WHERE workspace = ? AND project_id = ? AND path = ?',
      [workspace, projectId, path],
      sqliteMappers.contentNode
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
    projectId: string,
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
       WHERE workspace = ? AND project_id = ? AND id = ?`,
      [
        sizeBytes,
        commentCount,
        unresolvedCommentCount,
        previewSvg,
        updated_at.toISOString(),
        workspace,
        projectId,
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

  async upsertContentNode(input: ContentNodeDbUpsert) {
    const id = newid();
    const tx = this.db.transaction(() => {
      const existing = this.get<{ id: string; created_at: string }>(
        'SELECT id, created_at FROM content_node WHERE workspace = ? AND project_id = ? AND path = ?',
        [input.workspace, input.project_id, input.path]
      );

      if (existing) {
        this.run(
          'UPDATE content_node SET name = ?, size_bytes = ?, comment_count = ?, unresolved_comment_count = ?, updated_at = ? WHERE id = ?',
          [
            input.name,
            input.size_bytes,
            input.comment_count,
            input.unresolved_comment_count,
            input.updated_at.toISOString(),
            existing.id
          ]
        );
      } else {
        this.run(
          'INSERT INTO content_node (id, workspace, project_id, path, name, type, size_bytes, comment_count, unresolved_comment_count, is_template, is_workspace_template, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [
            id,
            input.workspace,
            input.project_id,
            input.path,
            input.name,
            input.type ?? 'diagram',
            input.size_bytes,
            input.comment_count,
            input.unresolved_comment_count,
            0,
            0,
            input.created_atIfNew.toISOString(),
            input.updated_at.toISOString()
          ]
        );
      }
    });

    tx();
    return (await this.getContentNodeByPath(input.workspace, input.project_id, input.path))!;
  }

  async createContentNodeIfAbsent(
    input: Omit<ContentNodeDbUpsert, 'updated_at'> & { updated_at: Date }
  ) {
    const existing = await this.getContentNodeByPath(input.workspace, input.project_id, input.path);
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

    const matchingIds = this.all<{ id: string }>(
      'SELECT id FROM content_node WHERE workspace = ? AND project_id = ? AND path LIKE ?',
      [workspace, projectId, `${oldPathPrefix}%`]
    );

    const tx = this.db.transaction(() => {
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
    return matchingIds.map(row => row.id);
  }

  async deleteContentNodeFolder(workspace: string, projectId: string, folderPath: string) {
    const folderPathPrefix = `${folderPath}/`;
    const matching = this.all(
      'SELECT * FROM content_node WHERE workspace = ? AND project_id = ? AND path LIKE ?',
      [workspace, projectId, `${folderPathPrefix}%`],
      sqliteMappers.contentNode
    );

    if (matching.length === 0) return [];

    const tx = this.db.transaction(() => {
      this.run('DELETE FROM content_node WHERE workspace = ? AND project_id = ? AND path LIKE ?', [
        workspace,
        projectId,
        `${folderPathPrefix}%`
      ]);
    });

    tx();
    return matching;
  }

  async listProjectEntities(workspace: string, projectId: string) {
    return this.all(
      `${PROJECT_ENTITY_JOIN_SQL} WHERE pe.workspace = ? AND pe.project_id = ? ORDER BY e.name`,
      [workspace, projectId],
      sqliteMappers.projectEntity
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
        pf.preview_svg AS file_preview_svg,
        pf.created_at  AS file_created_at,
        pf.updated_at  AS file_updated_at,
        p.id           AS project_id,
        p.name         AS project_name
      FROM diagram_entity_ref der
      JOIN content_node pf ON pf.id = der.file_id AND pf.workspace = der.workspace
      JOIN project p ON p.id = pf.project_id AND p.workspace = pf.workspace
      WHERE der.workspace = ? AND der.entity_id = ?
      ORDER BY p.name, pf.name`,
      [workspace, entityId],
      row => ({
        file_id: String(row['file_id']),
        file_path: String(row['file_path']),
        file_name: String(row['file_name']),
        file_size_bytes: Number(row['file_size_bytes']),
        file_preview_svg: row['file_preview_svg'] != null ? String(row['file_preview_svg']) : null,
        file_created_at: new Date(String(row['file_created_at'])),
        file_updated_at: new Date(String(row['file_updated_at'])),
        project_id: String(row['project_id']),
        project_name: String(row['project_name'])
      })
    );
  }
}
