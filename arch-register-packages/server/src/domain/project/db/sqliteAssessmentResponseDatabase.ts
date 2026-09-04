import { newid } from '@diagram-craft/utils/id';
import { SqliteDatabaseBase } from '../../../db/sqliteBase';
import type {
  AssessmentResponseDatabase,
  AssessmentResponseDbUpsert
} from './assessmentResponseDatabase';
import {
  ASSESSMENT_RESPONSE_SELECT_SQL,
  assessmentResponseMapper
} from './assessmentResponseDatabase';

export class SqliteAssessmentResponseDatabase
  extends SqliteDatabaseBase
  implements AssessmentResponseDatabase
{
  async listAssessmentResponses(workspace: string, assessmentId: string, occurrence: number) {
    return this.all(
      `${ASSESSMENT_RESPONSE_SELECT_SQL}
       WHERE ar.workspace = ? AND ar.assessment_id = ? AND ar.occurrence = ?`,
      [workspace, assessmentId, occurrence],
      assessmentResponseMapper
    );
  }

  async listAllAssessmentResponses(workspace: string, assessmentId: string) {
    return this.all(
      `${ASSESSMENT_RESPONSE_SELECT_SQL}
       WHERE ar.workspace = ? AND ar.assessment_id = ?`,
      [workspace, assessmentId],
      assessmentResponseMapper
    );
  }

  async getAssessmentResponse(
    workspace: string,
    assessmentId: string,
    entityId: string,
    occurrence: number
  ) {
    return this.get(
      `${ASSESSMENT_RESPONSE_SELECT_SQL}
       WHERE ar.workspace = ? AND ar.assessment_id = ? AND ar.entity_id = ? AND ar.occurrence = ?`,
      [workspace, assessmentId, entityId, occurrence],
      assessmentResponseMapper
    );
  }

  async upsertAssessmentResponse(input: AssessmentResponseDbUpsert) {
    const now = new Date().toISOString();
    const existing = await this.getAssessmentResponse(
      input.workspace,
      input.assessment_id,
      input.entity_id,
      input.occurrence
    );
    const id = existing?.id ?? newid();
    this.run(
      `INSERT INTO assessment_response (id, workspace, assessment_id, entity_id, occurrence, "values", created_at, updated_at, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (workspace, assessment_id, entity_id, occurrence)
       DO UPDATE SET "values" = excluded."values", updated_at = excluded.updated_at, updated_by = excluded.updated_by`,
      [
        id,
        input.workspace,
        input.assessment_id,
        input.entity_id,
        input.occurrence,
        JSON.stringify(input.values),
        now,
        now,
        input.updated_by
      ]
    );
    return (await this.getAssessmentResponse(
      input.workspace,
      input.assessment_id,
      input.entity_id,
      input.occurrence
    ))!;
  }

  async updateAssessmentResponseDerivedFields(
    workspace: string,
    assessmentId: string,
    entityId: string,
    occurrence: number,
    values: Record<string, string | number | boolean>
  ) {
    this.run(
      'UPDATE assessment_response SET "values" = ? WHERE workspace = ? AND assessment_id = ? AND entity_id = ? AND occurrence = ?',
      [JSON.stringify(values), workspace, assessmentId, entityId, occurrence]
    );
  }

  async countAssessmentResponses(workspace: string, assessmentId: string) {
    return (
      this.get(
        'SELECT COUNT(*) AS count FROM assessment_response WHERE workspace = ? AND assessment_id = ?',
        [workspace, assessmentId],
        (r: Record<string, unknown>) => Number(r['count'] ?? 0)
      ) ?? 0
    );
  }
}
