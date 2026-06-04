import { newid } from '@diagram-craft/utils/id';
import type {
  CreateProjectInput,
  ProjectsFilesDatabase,
  UpdateProjectInput,
  UpsertProjectFileInput
} from './database.js';
import { SqliteDatabaseBase, sqliteMappers } from './sqliteBase.js';

export class SqliteProjectsFilesDatabase
  extends SqliteDatabaseBase
  implements ProjectsFilesDatabase
{
  async listProjects(workspace: string) {
    return this.all(
      'SELECT * FROM project WHERE workspace = ? ORDER BY name',
      [workspace],
      sqliteMappers.project
    );
  }

  async getProject(workspace: string, id: string) {
    return this.get(
      'SELECT * FROM project WHERE workspace = ? AND id = ?',
      [workspace, id],
      sqliteMappers.project
    );
  }

  async createProject(input: CreateProjectInput) {
    this.run(
      'INSERT INTO project (id, workspace, name, description, owner, status, color, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        input.id,
        input.workspace,
        input.name,
        input.description,
        input.owner,
        input.status,
        input.color,
        input.created_at.toISOString(),
        input.updated_at.toISOString()
      ]
    );
    return (await this.getProject(input.workspace, input.id))!;
  }

  async updateProject(workspace: string, id: string, input: UpdateProjectInput) {
    this.run(
      'UPDATE project SET name = ?, description = ?, owner = ?, status = ?, color = ?, updated_at = ? WHERE workspace = ? AND id = ?',
      [
        input.name,
        input.description,
        input.owner,
        input.status,
        input.color,
        input.updated_at.toISOString(),
        workspace,
        id
      ]
    );
    return await this.getProject(workspace, id);
  }

  async deleteProject(workspace: string, id: string) {
    const row = await this.getProject(workspace, id);
    if (!row) return null;
    this.run('DELETE FROM project WHERE workspace = ? AND id = ?', [workspace, id]);
    return row;
  }

  async listProjectFiles(workspace: string, projectId: string) {
    return this.all(
      'SELECT * FROM project_file WHERE workspace = ? AND project_id = ? ORDER BY path',
      [workspace, projectId],
      sqliteMappers.projectFile
    );
  }

  async getProjectFileByPath(workspace: string, projectId: string, path: string) {
    return this.get(
      'SELECT * FROM project_file WHERE workspace = ? AND project_id = ? AND path = ?',
      [workspace, projectId, path],
      sqliteMappers.projectFile
    );
  }

  async updateProjectFileSizeById(
    workspace: string,
    projectId: string,
    fileId: string,
    sizeBytes: number,
    updated_at: Date
  ) {
    this.run(
      'UPDATE project_file SET size_bytes = ?, updated_at = ? WHERE workspace = ? AND project_id = ? AND id = ?',
      [sizeBytes, updated_at.toISOString(), workspace, projectId, fileId]
    );
  }

  async updateProjectFilePreview(
    workspace: string,
    projectId: string,
    fileId: string,
    previewSvg: string | null
  ) {
    this.run(
      'UPDATE project_file SET preview_svg = ? WHERE workspace = ? AND project_id = ? AND id = ?',
      [previewSvg, workspace, projectId, fileId]
    );
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
    this.run(
      `UPDATE project_file
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

  async updateProjectFileTemplateStatus(
    workspace: string,
    projectId: string,
    fileId: string,
    isTemplate: boolean,
    isWorkspaceTemplate: boolean,
    updated_at: Date
  ) {
    this.run(
      'UPDATE project_file SET is_template = ?, is_workspace_template = ?, updated_at = ? WHERE workspace = ? AND project_id = ? AND id = ?',
      [isTemplate ? 1 : 0, isWorkspaceTemplate ? 1 : 0, updated_at.toISOString(), workspace, projectId, fileId]
    );
  }

  async upsertProjectFile(input: UpsertProjectFileInput) {
    const id = newid();
    const tx = this.db.transaction(() => {
      const existing = this.get<{ id: string; created_at: string }>(
        'SELECT id, created_at FROM project_file WHERE workspace = ? AND project_id = ? AND path = ?',
        [input.workspace, input.project_id, input.path]
      );

      if (existing) {
        this.run(
          'UPDATE project_file SET name = ?, size_bytes = ?, comment_count = ?, unresolved_comment_count = ?, updated_at = ? WHERE id = ?',
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
          'INSERT INTO project_file (id, workspace, project_id, path, name, size_bytes, comment_count, unresolved_comment_count, is_template, is_workspace_template, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [
            id,
            input.workspace,
            input.project_id,
            input.path,
            input.name,
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
    return (await this.getProjectFileByPath(input.workspace, input.project_id, input.path))!;
  }

  async createProjectFileIfAbsent(
    input: Omit<UpsertProjectFileInput, 'updated_at'> & { updated_at: Date }
  ) {
    const existing = await this.getProjectFileByPath(
      input.workspace,
      input.project_id,
      input.path
    );
    if (existing) return null;
    return await this.upsertProjectFile(input);
  }

  async deleteProjectFileByPath(workspace: string, projectId: string, path: string) {
    const row = await this.getProjectFileByPath(workspace, projectId, path);
    if (!row) return null;
    this.run('DELETE FROM project_file WHERE workspace = ? AND project_id = ? AND path = ?', [
      workspace,
      projectId,
      path
    ]);
    return row;
  }

  async renameProjectFileFolder(
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
      'SELECT id FROM project_file WHERE workspace = ? AND project_id = ? AND path LIKE ?',
      [workspace, projectId, `${oldPathPrefix}%`]
    );

    const tx = this.db.transaction(() => {
      this.run(
        `UPDATE project_file
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

  async deleteProjectFileFolder(workspace: string, projectId: string, folderPath: string) {
    const folderPathPrefix = `${folderPath}/`;
    const matching = this.all(
      'SELECT * FROM project_file WHERE workspace = ? AND project_id = ? AND path LIKE ?',
      [workspace, projectId, `${folderPathPrefix}%`],
      sqliteMappers.projectFile
    );

    if (matching.length === 0) return [];

    const tx = this.db.transaction(() => {
      this.run(
        'DELETE FROM project_file WHERE workspace = ? AND project_id = ? AND path LIKE ?',
        [workspace, projectId, `${folderPathPrefix}%`]
      );
    });

    tx();
    return matching;
  }
}
