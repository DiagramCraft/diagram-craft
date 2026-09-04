import { SqliteDatabaseBase } from '../../../db/sqliteBase';
import { isUuidLike } from '../../../utils/publicIds';
import type { ProjectCrudDatabase, ProjectDbCreate, ProjectDbUpdate } from './projectCrudDatabase';
import { PROJECT_SELECT_SQL, projectMapper } from './projectCrudDatabase';
import { normalizeProjectPublicId } from './projectDbNormalization';

export class SqliteProjectCrudDatabase extends SqliteDatabaseBase implements ProjectCrudDatabase {
  async listProjects(workspace: string) {
    return this.all(
      `${PROJECT_SELECT_SQL} WHERE p.workspace = ? ORDER BY p.name`,
      [workspace],
      projectMapper
    );
  }

  async getProject(workspace: string, identifier: string) {
    if (!isUuidLike(identifier)) {
      const row = await this.getProjectByPublicId(identifier);
      return row?.workspace === workspace ? row : null;
    }
    return this.get(
      `${PROJECT_SELECT_SQL} WHERE p.workspace = ? AND p.id = ?`,
      [workspace, identifier],
      projectMapper
    );
  }

  private async getProjectByPublicId(publicId: string) {
    return this.get(`${PROJECT_SELECT_SQL} WHERE p.public_id = ?`, [publicId], projectMapper);
  }

  async createProject(input: ProjectDbCreate) {
    const normalized = normalizeProjectPublicId(input);
    this.run(
      'INSERT INTO project (id, workspace, public_id, name, description, owner, status, color, start_date, target_date, pinned, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        input.id,
        input.workspace,
        normalized.public_id,
        input.name,
        input.description,
        input.owner,
        input.status,
        input.color,
        input.start_date,
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
      'UPDATE project SET name = ?, description = ?, owner = ?, status = ?, color = ?, start_date = ?, target_date = ?, pinned = ?, updated_at = ? WHERE workspace = ? AND id = ?',
      [
        input.name,
        input.description,
        input.owner,
        input.status,
        input.color,
        input.start_date,
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
}
