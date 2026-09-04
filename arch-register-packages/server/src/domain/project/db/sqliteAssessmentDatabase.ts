import { SqliteDatabaseBase } from '../../../db/sqliteBase';
import type {
  AssessmentDatabase,
  AssessmentDbCreate,
  AssessmentDbUpdate
} from './assessmentDatabase';
import { assessmentMapper } from './assessmentDatabase';

export class SqliteAssessmentDatabase extends SqliteDatabaseBase implements AssessmentDatabase {
  async listAssessments(workspace: string) {
    return this.all(
      'SELECT * FROM assessment WHERE workspace = ? ORDER BY name',
      [workspace],
      assessmentMapper
    );
  }

  async getAssessment(workspace: string, projectId: string, id: string) {
    return this.get(
      'SELECT * FROM assessment WHERE workspace = ? AND project_id = ? AND id = ?',
      [workspace, projectId, id],
      assessmentMapper
    );
  }

  async getAssessmentById(workspace: string, id: string) {
    return this.get(
      'SELECT * FROM assessment WHERE workspace = ? AND id = ?',
      [workspace, id],
      assessmentMapper
    );
  }

  async createAssessment(input: AssessmentDbCreate) {
    this.run(
      `INSERT INTO assessment (id, workspace, project_id, name, description, status, mode, assessment_type_id, scope, scope_conditions, fields, groups, assigned_team_ids, due_at, recurrence, response_window_days, current_occurrence, pending_occurrence_job_run_id, next_occurrence_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.id,
        input.workspace,
        input.project_id,
        input.name,
        input.description,
        input.status,
        input.mode,
        input.assessment_type_id,
        JSON.stringify(input.scope),
        JSON.stringify(input.scope_conditions),
        JSON.stringify(input.fields),
        JSON.stringify(input.groups),
        JSON.stringify(input.assigned_team_ids),
        input.due_at ? input.due_at.toISOString() : null,
        JSON.stringify(input.recurrence),
        input.response_window_days,
        input.current_occurrence,
        input.pending_occurrence_job_run_id,
        input.next_occurrence_at ? input.next_occurrence_at.toISOString() : null,
        input.created_at.toISOString(),
        input.updated_at.toISOString()
      ]
    );
    return (await this.getAssessment(input.workspace, input.project_id, input.id))!;
  }

  async updateAssessment(
    workspace: string,
    projectId: string,
    id: string,
    input: AssessmentDbUpdate
  ) {
    this.run(
      `UPDATE assessment
       SET name = ?, description = ?, status = ?, mode = ?, assessment_type_id = ?, scope = ?, scope_conditions = ?, fields = ?, groups = ?, assigned_team_ids = ?, due_at = ?, recurrence = ?, response_window_days = ?, current_occurrence = ?, pending_occurrence_job_run_id = ?, next_occurrence_at = ?, updated_at = ?
       WHERE workspace = ? AND project_id = ? AND id = ?`,
      [
        input.name,
        input.description,
        input.status,
        input.mode,
        input.assessment_type_id,
        JSON.stringify(input.scope),
        JSON.stringify(input.scope_conditions),
        JSON.stringify(input.fields),
        JSON.stringify(input.groups),
        JSON.stringify(input.assigned_team_ids),
        input.due_at ? input.due_at.toISOString() : null,
        JSON.stringify(input.recurrence),
        input.response_window_days,
        input.current_occurrence,
        input.pending_occurrence_job_run_id,
        input.next_occurrence_at ? input.next_occurrence_at.toISOString() : null,
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
