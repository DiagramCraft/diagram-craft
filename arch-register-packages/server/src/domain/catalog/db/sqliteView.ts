import type { SavedViewDbCreate, SavedViewDbUpdate, ViewDatabase } from './catalogDatabase';
import { SqliteDatabaseBase, sqliteMappers } from '../../../db/sqliteBase';

export class SqliteViewDatabase extends SqliteDatabaseBase implements ViewDatabase {
  async listSavedViews(
    workspace: string,
    options?: {
      projectId?: string | null;
      includeWorkspace?: boolean;
    }
  ) {
    const projectId = options?.projectId ?? null;
    const includeWorkspace = options?.includeWorkspace ?? false;

    if (projectId == null) {
      return this.all(
        'SELECT * FROM saved_view WHERE workspace = ? AND project_id IS NULL ORDER BY name',
        [workspace],
        sqliteMappers.savedView
      );
    }

    return this.all(
      `SELECT * FROM saved_view
       WHERE workspace = ?
         AND (
           project_id = ?
           OR (? = 1 AND project_id IS NULL)
         )
       ORDER BY CASE WHEN project_id IS NULL THEN 1 ELSE 0 END, name`,
      [workspace, projectId, includeWorkspace ? 1 : 0],
      sqliteMappers.savedView
    );
  }

  async getSavedView(workspace: string, id: string) {
    return this.get(
      'SELECT * FROM saved_view WHERE workspace = ? AND id = ?',
      [workspace, id],
      sqliteMappers.savedView
    );
  }

  async createSavedView(input: SavedViewDbCreate) {
    this.run(
      'INSERT INTO saved_view (id, workspace, project_id, project_scope, name, description, is_admin_view, view_mode, filters, config, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        input.id,
        input.workspace,
        input.project_id,
        input.project_scope,
        input.name,
        input.description,
        input.is_admin_view ? 1 : 0,
        input.view_mode,
        JSON.stringify(input.filters),
        input.config ? JSON.stringify(input.config) : null,
        input.created_at.toISOString(),
        input.updated_at.toISOString()
      ]
    );
    return (await this.getSavedView(input.workspace, input.id))!;
  }

  async updateSavedView(workspace: string, id: string, input: SavedViewDbUpdate) {
    const existing = await this.getSavedView(workspace, id);
    if (!existing) return null;

    this.run(
      `UPDATE saved_view
       SET name = ?,
           description = ?,
           is_admin_view = ?,
           view_mode = ?,
           filters = ?,
           config = ?,
           project_scope = ?,
           updated_at = ?
       WHERE workspace = ? AND id = ?`,
      [
        input.name ?? existing.name,
        input.description === undefined ? existing.description : input.description,
        (input.is_admin_view === undefined ? existing.is_admin_view : input.is_admin_view) ? 1 : 0,
        input.view_mode ?? existing.view_mode,
        input.filters ? JSON.stringify(input.filters) : JSON.stringify(existing.filters),
        input.config === undefined ? JSON.stringify(existing.config) : JSON.stringify(input.config),
        input.project_scope === undefined ? existing.project_scope : input.project_scope,
        input.updated_at.toISOString(),
        workspace,
        id
      ]
    );
    return await this.getSavedView(workspace, id);
  }

  async deleteSavedView(workspace: string, id: string) {
    const existing = await this.getSavedView(workspace, id);
    if (!existing) return null;

    this.run('DELETE FROM saved_view WHERE workspace = ? AND id = ?', [workspace, id]);
    return existing;
  }
}
