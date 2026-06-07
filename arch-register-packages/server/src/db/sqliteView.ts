import type { CreateSavedViewInput, UpdateSavedViewInput, ViewDatabase } from './database';
import { SqliteDatabaseBase, sqliteMappers } from './sqliteBase';

export class SqliteViewDatabase extends SqliteDatabaseBase implements ViewDatabase {
  async listSavedViews(workspace: string) {
    return this.all(
      'SELECT * FROM saved_view WHERE workspace = ? ORDER BY name',
      [workspace],
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

  async createSavedView(input: CreateSavedViewInput) {
    this.run(
      'INSERT INTO saved_view (id, workspace, name, description, view_mode, filters, config, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        input.id,
        input.workspace,
        input.name,
        input.description,
        input.view_mode,
        JSON.stringify(input.filters),
        input.config ? JSON.stringify(input.config) : null,
        input.created_at.toISOString(),
        input.updated_at.toISOString()
      ]
    );
    return (await this.getSavedView(input.workspace, input.id))!;
  }

  async updateSavedView(workspace: string, id: string, input: UpdateSavedViewInput) {
    const existing = await this.getSavedView(workspace, id);
    if (!existing) return null;

    this.run(
      `UPDATE saved_view
       SET name = ?,
           description = ?,
           view_mode = ?,
           filters = ?,
           config = ?,
           updated_at = ?
       WHERE workspace = ? AND id = ?`,
      [
        input.name ?? existing.name,
        input.description === undefined ? existing.description : input.description,
        input.view_mode ?? existing.view_mode,
        input.filters ? JSON.stringify(input.filters) : JSON.stringify(existing.filters),
        input.config ? JSON.stringify(input.config) : JSON.stringify(existing.config),
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
