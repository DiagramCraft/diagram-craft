import { randomUUID } from 'node:crypto';
import { normalizePostgresError, PostgresDatabaseBase } from '../../../db/postgresBase';
import { mapDatabaseRows, type DatabaseRow } from '../../../db/rowMappers';
import type {
  AssessmentResponseDatabase,
  AssessmentResponseDbUpsert
} from './assessmentResponseDatabase';
import {
  ASSESSMENT_RESPONSE_SELECT_SQL,
  assessmentResponseMapper
} from './assessmentResponseDatabase';

export class PostgresAssessmentResponseDatabase
  extends PostgresDatabaseBase
  implements AssessmentResponseDatabase
{
  async listAssessmentResponses(workspace: string, assessmentId: string, occurrence: number) {
    const rows = await this.sql.unsafe<DatabaseRow[]>(
      `${ASSESSMENT_RESPONSE_SELECT_SQL}
       WHERE ar.workspace = $1 AND ar.assessment_id = $2 AND ar.occurrence = $3`,
      [workspace, assessmentId, occurrence]
    );
    return mapDatabaseRows(rows, assessmentResponseMapper);
  }

  async listAllAssessmentResponses(workspace: string, assessmentId: string) {
    const rows = await this.sql.unsafe<DatabaseRow[]>(
      `${ASSESSMENT_RESPONSE_SELECT_SQL}
       WHERE ar.workspace = $1 AND ar.assessment_id = $2`,
      [workspace, assessmentId]
    );
    return mapDatabaseRows(rows, assessmentResponseMapper);
  }

  async getAssessmentResponse(
    workspace: string,
    assessmentId: string,
    entityId: string,
    occurrence: number
  ) {
    const [row] = await this.sql.unsafe<DatabaseRow[]>(
      `${ASSESSMENT_RESPONSE_SELECT_SQL}
       WHERE ar.workspace = $1 AND ar.assessment_id = $2 AND ar.entity_id = $3 AND ar.occurrence = $4`,
      [workspace, assessmentId, entityId, occurrence]
    );
    return row ? assessmentResponseMapper(row) : null;
  }

  async upsertAssessmentResponse(input: AssessmentResponseDbUpsert) {
    try {
      await this.sql`
        INSERT INTO assessment_response (id, workspace, assessment_id, entity_id, occurrence, "values", created_at, updated_at, updated_by)
        VALUES (${randomUUID()}, ${input.workspace}, ${input.assessment_id}, ${input.entity_id}, ${input.occurrence}, ${this.json(input.values)}, now(), now(), ${input.updated_by})
        ON CONFLICT (workspace, assessment_id, entity_id, occurrence)
        DO UPDATE SET "values" = ${this.json(input.values)}, updated_at = now(), updated_by = ${input.updated_by}
      `;
      return (await this.getAssessmentResponse(
        input.workspace,
        input.assessment_id,
        input.entity_id,
        input.occurrence
      ))!;
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async updateAssessmentResponseDerivedFields(
    workspace: string,
    assessmentId: string,
    entityId: string,
    occurrence: number,
    values: Record<string, string | number | boolean>
  ) {
    await this.sql`
      UPDATE assessment_response
      SET "values" = ${this.json(values)}
      WHERE workspace = ${workspace}
        AND assessment_id = ${assessmentId}
        AND entity_id = ${entityId}
        AND occurrence = ${occurrence}
    `;
  }

  async countAssessmentResponses(workspace: string, assessmentId: string) {
    const [row] = await this.sql<{ count: string }[]>`
      SELECT COUNT(*) AS count FROM assessment_response
      WHERE workspace = ${workspace} AND assessment_id = ${assessmentId}
    `;
    return Number(row?.count ?? 0);
  }
}
