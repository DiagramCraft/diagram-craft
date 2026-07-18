import { SqliteDatabaseBase } from '../../../db/sqliteBase';
import type {
  EntityDeprecationAckDbCompletion,
  EntityDeprecationAckDbCreate,
  EntityDeprecationDatabase
} from './entityDeprecationDatabase';
import { entityDeprecationMappers } from './entityDeprecationDatabase';

export class SqliteEntityDeprecationDatabase
  extends SqliteDatabaseBase
  implements EntityDeprecationDatabase
{
  async createAck(input: EntityDeprecationAckDbCreate) {
    this.run(
      'INSERT INTO entity_deprecation_ack (id, case_id, workspace, owner_team_id, assignment_id, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [
        input.id,
        input.case_id,
        input.workspace,
        input.owner_team_id,
        input.assignment_id,
        'open',
        input.created_at.toISOString()
      ]
    );
    return (await this.getAckByAssignment(input.assignment_id))!;
  }

  async listAcksForCase(caseId: string) {
    return this.all(
      'SELECT * FROM entity_deprecation_ack WHERE case_id = ? ORDER BY created_at ASC',
      [caseId],
      entityDeprecationMappers.ack
    );
  }

  async getAckByAssignment(assignmentId: string) {
    return this.get(
      'SELECT * FROM entity_deprecation_ack WHERE assignment_id = ?',
      [assignmentId],
      entityDeprecationMappers.ack
    );
  }

  async completeAckIfOpen(assignmentId: string, completion: EntityDeprecationAckDbCompletion) {
    const result = this.run(
      `UPDATE entity_deprecation_ack
       SET status = 'completed', actor_user_id = ?, comment = ?, planned_remediation = ?,
           remediation_project_id = ?, target_remediation_date = ?, risk_accepted = ?, resolved_at = ?
       WHERE assignment_id = ? AND status = 'open'`,
      [
        completion.actor_user_id,
        completion.comment,
        completion.planned_remediation,
        completion.remediation_project_id,
        completion.target_remediation_date,
        completion.risk_accepted ? 1 : 0,
        completion.resolved_at.toISOString(),
        assignmentId
      ]
    );
    return result.changes === 0 ? null : await this.getAckByAssignment(assignmentId);
  }
}
