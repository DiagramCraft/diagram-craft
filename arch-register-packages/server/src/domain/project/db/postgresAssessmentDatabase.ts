import { normalizePostgresError, PostgresDatabaseBase } from '../../../db/postgresBase';
import { mapDatabaseRows, type DatabaseRow } from '../../../db/rowMappers';
import type {
  AssessmentDatabase,
  AssessmentDbCreate,
  AssessmentDbUpdate
} from './assessmentDatabase';
import { assessmentMapper } from './assessmentDatabase';

export class PostgresAssessmentDatabase extends PostgresDatabaseBase implements AssessmentDatabase {
  async listAssessments(workspace: string) {
    const rows = await this.sql<DatabaseRow[]>`
      SELECT * FROM assessment WHERE workspace = ${workspace} ORDER BY name
    `;
    return mapDatabaseRows(rows, assessmentMapper);
  }

  async getAssessment(workspace: string, projectId: string, id: string) {
    const [row] = await this.sql<DatabaseRow[]>`
      SELECT * FROM assessment WHERE workspace = ${workspace} AND project_id = ${projectId} AND id = ${id}
    `;
    return row ? assessmentMapper(row) : null;
  }

  async getAssessmentById(workspace: string, id: string) {
    const [row] = await this.sql<DatabaseRow[]>`
      SELECT * FROM assessment WHERE workspace = ${workspace} AND id = ${id}
    `;
    return row ? assessmentMapper(row) : null;
  }

  async createAssessment(input: AssessmentDbCreate) {
    try {
      const [row] = await this.sql<DatabaseRow[]>`
        INSERT INTO assessment (id, workspace, project_id, name, description, status, mode, assessment_type_id, scope, scope_conditions, fields, groups, assigned_team_ids, due_at, recurrence, response_window_days, current_occurrence, pending_occurrence_job_run_id, next_occurrence_at, created_at, updated_at)
        VALUES (${input.id}, ${input.workspace}, ${input.project_id}, ${input.name}, ${input.description}, ${input.status}, ${input.mode}, ${input.assessment_type_id ?? null}, ${this.json(input.scope)}, ${this.json(input.scope_conditions)}, ${this.json(input.fields)}, ${this.json(input.groups)}, ${this.json(input.assigned_team_ids)}, ${input.due_at}, ${this.json(input.recurrence)}, ${input.response_window_days}, ${input.current_occurrence}, ${input.pending_occurrence_job_run_id}, ${input.next_occurrence_at}, ${input.created_at}, ${input.updated_at})
        RETURNING *
      `;
      return assessmentMapper(row!);
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async updateAssessment(
    workspace: string,
    projectId: string,
    id: string,
    input: AssessmentDbUpdate
  ) {
    try {
      const [row] = await this.sql<DatabaseRow[]>`
        UPDATE assessment
        SET name = ${input.name},
            description = ${input.description},
            status = ${input.status},
            mode = ${input.mode},
            assessment_type_id = ${input.assessment_type_id ?? null},
            scope = ${this.json(input.scope)},
            scope_conditions = ${this.json(input.scope_conditions)},
            fields = ${this.json(input.fields)},
            groups = ${this.json(input.groups)},
            assigned_team_ids = ${this.json(input.assigned_team_ids)},
            due_at = ${input.due_at},
            recurrence = ${this.json(input.recurrence)},
            response_window_days = ${input.response_window_days},
            current_occurrence = ${input.current_occurrence},
            pending_occurrence_job_run_id = ${input.pending_occurrence_job_run_id},
            next_occurrence_at = ${input.next_occurrence_at},
            updated_at = ${input.updated_at}
        WHERE workspace = ${workspace} AND project_id = ${projectId} AND id = ${id}
        RETURNING *
      `;
      return row ? assessmentMapper(row) : null;
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async deleteAssessment(workspace: string, projectId: string, id: string) {
    const row = await this.getAssessment(workspace, projectId, id);
    if (!row) return null;
    await this.sql`
      DELETE FROM assessment WHERE workspace = ${workspace} AND project_id = ${projectId} AND id = ${id}
    `;
    return row;
  }
}
