import { SqliteDatabaseBase } from '../../../db/sqliteBase';
import type {
  ProjectMilestoneDatabase,
  ProjectMilestoneDbCreate,
  ProjectMilestoneDbUpdate
} from './projectMilestoneDatabase';
import { projectMilestoneMapper } from './projectMilestoneDatabase';

export class SqliteProjectMilestoneDatabase
  extends SqliteDatabaseBase
  implements ProjectMilestoneDatabase
{
  async listMilestones(workspace: string) {
    return this.all(
      'SELECT * FROM project_milestone WHERE workspace = ? ORDER BY sort_order, name',
      [workspace],
      projectMilestoneMapper
    );
  }

  async getMilestone(workspace: string, projectId: string, id: string) {
    return this.get(
      'SELECT * FROM project_milestone WHERE workspace = ? AND project_id = ? AND id = ?',
      [workspace, projectId, id],
      projectMilestoneMapper
    );
  }

  async getMilestoneById(workspace: string, id: string) {
    return this.get(
      'SELECT * FROM project_milestone WHERE workspace = ? AND id = ?',
      [workspace, id],
      projectMilestoneMapper
    );
  }

  async createMilestone(input: ProjectMilestoneDbCreate) {
    this.run(
      `INSERT INTO project_milestone (id, workspace, project_id, name, target_date, status, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.id,
        input.workspace,
        input.project_id,
        input.name,
        input.target_date,
        input.status,
        input.sort_order,
        input.created_at.toISOString(),
        input.updated_at.toISOString()
      ]
    );
    return (await this.getMilestone(input.workspace, input.project_id, input.id))!;
  }

  async updateMilestone(
    workspace: string,
    projectId: string,
    id: string,
    input: ProjectMilestoneDbUpdate
  ) {
    this.run(
      `UPDATE project_milestone
       SET name = ?, target_date = ?, status = ?, sort_order = ?, updated_at = ?
       WHERE workspace = ? AND project_id = ? AND id = ?`,
      [
        input.name,
        input.target_date,
        input.status,
        input.sort_order,
        input.updated_at.toISOString(),
        workspace,
        projectId,
        id
      ]
    );
    return await this.getMilestone(workspace, projectId, id);
  }

  async deleteMilestone(workspace: string, projectId: string, id: string) {
    const row = await this.getMilestone(workspace, projectId, id);
    if (!row) return null;
    this.run('DELETE FROM project_milestone WHERE workspace = ? AND project_id = ? AND id = ?', [
      workspace,
      projectId,
      id
    ]);
    return row;
  }
}
