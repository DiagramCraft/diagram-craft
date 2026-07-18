import { mapDatabaseRows, type DatabaseRow } from '../../../db/rowMappers';
import { PostgresDatabaseBase, normalizePostgresError } from '../../../db/postgresBase';
import type {
  EntityDeprecationAckDbCompletion,
  EntityDeprecationAckDbCreate,
  EntityDeprecationDatabase
} from './entityDeprecationDatabase';
import { entityDeprecationMappers } from './entityDeprecationDatabase';

export class PostgresEntityDeprecationDatabase
  extends PostgresDatabaseBase
  implements EntityDeprecationDatabase
{
  async createAck(input: EntityDeprecationAckDbCreate) {
    try {
      const [row] = (await this.sql`
        INSERT INTO entity_deprecation_ack (id, case_id, workspace, owner_team_id, assignment_id, status, created_at)
        VALUES (${input.id}, ${input.case_id}, ${input.workspace}, ${input.owner_team_id}, ${input.assignment_id}, 'open', ${input.created_at})
        RETURNING *
      `) as DatabaseRow[];
      return entityDeprecationMappers.ack(row!);
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async listAcksForCase(caseId: string) {
    const rows = await this.sql<DatabaseRow[]>`
      SELECT * FROM entity_deprecation_ack WHERE case_id = ${caseId} ORDER BY created_at ASC
    `;
    return mapDatabaseRows(rows, entityDeprecationMappers.ack);
  }

  async getAckByAssignment(assignmentId: string) {
    const [row] = await this.sql<DatabaseRow[]>`
      SELECT * FROM entity_deprecation_ack WHERE assignment_id = ${assignmentId}
    `;
    return row ? entityDeprecationMappers.ack(row) : null;
  }

  async completeAckIfOpen(assignmentId: string, completion: EntityDeprecationAckDbCompletion) {
    const [row] = await this.sql<DatabaseRow[]>`
      UPDATE entity_deprecation_ack
      SET status = 'completed', actor_user_id = ${completion.actor_user_id},
          comment = ${completion.comment}, planned_remediation = ${completion.planned_remediation},
          remediation_project_id = ${completion.remediation_project_id},
          target_remediation_date = ${completion.target_remediation_date},
          risk_accepted = ${completion.risk_accepted}, resolved_at = ${completion.resolved_at}
      WHERE assignment_id = ${assignmentId} AND status = 'open'
      RETURNING *
    `;
    return row ? entityDeprecationMappers.ack(row) : null;
  }
}
