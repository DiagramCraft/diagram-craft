import type {
  GovernanceAssignmentAction,
  GovernanceAssignmentDbCreate,
  GovernanceCaseDbCreate,
  GovernanceCaseDbUpdate,
  GovernanceCaseListFilter,
  GovernanceDatabase,
  GovernanceEventDbCreate
} from './governanceDatabase';
import { governanceMappers } from './governanceDatabase';
import { SqliteDatabaseBase } from '../../../db/sqliteBase';

export class SqliteGovernanceDatabase extends SqliteDatabaseBase implements GovernanceDatabase {
  async createCase(input: GovernanceCaseDbCreate) {
    this.run(
      `INSERT INTO governance_case (
        id, workspace, case_kind, subject_type, subject_id, subject_version, status,
        policy_version, initiator_user_id, parent_case_id, self_approval_allowed, payload,
        created_at, due_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'open', ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.id,
        input.workspace,
        input.case_kind,
        input.subject_type,
        input.subject_id,
        input.subject_version,
        input.policy_version,
        input.initiator_user_id,
        input.parent_case_id,
        input.self_approval_allowed ? 1 : 0,
        JSON.stringify(input.payload),
        input.created_at.toISOString(),
        input.due_at?.toISOString() ?? null
      ]
    );
    return (await this.getCase(input.workspace, input.id))!;
  }

  async getCase(workspace: string, id: string) {
    return await this.get(
      'SELECT * FROM governance_case WHERE workspace = ? AND id = ?',
      [workspace, id],
      governanceMappers.case
    );
  }

  async listCases(workspace: string, filter: GovernanceCaseListFilter = {}) {
    const clauses = ['workspace = ?'];
    const params: unknown[] = [workspace];
    if (filter.caseKind) {
      clauses.push('case_kind = ?');
      params.push(filter.caseKind);
    }
    if (filter.status) {
      clauses.push('status = ?');
      params.push(filter.status);
    }
    if (filter.subjectType) {
      clauses.push('subject_type = ?');
      params.push(filter.subjectType);
    }
    if (filter.subjectId) {
      clauses.push('subject_id = ?');
      params.push(filter.subjectId);
    }
    return this.all(
      `SELECT * FROM governance_case WHERE ${clauses.join(' AND ')} ORDER BY created_at DESC`,
      params,
      governanceMappers.case
    );
  }

  async updateCase(id: string, patch: GovernanceCaseDbUpdate) {
    this.run(
      `UPDATE governance_case
       SET status = ?, outcome = ?, completed_at = ?, cancelled_at = ?
       WHERE id = ?`,
      [
        patch.status,
        patch.outcome,
        patch.completed_at?.toISOString() ?? null,
        patch.cancelled_at?.toISOString() ?? null,
        id
      ]
    );
    const row = await this.get(
      'SELECT * FROM governance_case WHERE id = ?',
      [id],
      governanceMappers.case
    );
    return row!;
  }

  async completeCaseIfOpen(id: string, outcome: string | null, completedAt: Date) {
    const result = this.run(
      `UPDATE governance_case SET status = 'completed', outcome = ?, completed_at = ?
       WHERE id = ? AND status = 'open'`,
      [outcome, completedAt.toISOString(), id]
    );
    if (result.changes === 0) return null;
    return await this.get(
      'SELECT * FROM governance_case WHERE id = ?',
      [id],
      governanceMappers.case
    );
  }

  async cancelCaseIfOpen(id: string, cancelledAt: Date) {
    const result = this.run(
      `UPDATE governance_case SET status = 'cancelled', cancelled_at = ?
       WHERE id = ? AND status = 'open'`,
      [cancelledAt.toISOString(), id]
    );
    if (result.changes === 0) return null;
    return await this.get(
      'SELECT * FROM governance_case WHERE id = ?',
      [id],
      governanceMappers.case
    );
  }

  async createAssignment(input: GovernanceAssignmentDbCreate) {
    this.run(
      `INSERT INTO governance_assignment (
        id, case_id, workspace, action, target_type, target_user_id, target_team_id,
        target_team_role, target_capability, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?)`,
      [
        input.id,
        input.case_id,
        input.workspace,
        input.action,
        input.target_type,
        input.target_user_id,
        input.target_team_id,
        input.target_team_role,
        input.target_capability,
        input.created_at.toISOString()
      ]
    );
    return (await this.getAssignment(input.id))!;
  }

  async getAssignment(id: string) {
    return await this.get(
      'SELECT * FROM governance_assignment WHERE id = ?',
      [id],
      governanceMappers.assignment
    );
  }

  async listAssignmentsForCase(caseId: string) {
    return this.all(
      'SELECT * FROM governance_assignment WHERE case_id = ? ORDER BY created_at ASC',
      [caseId],
      governanceMappers.assignment
    );
  }

  async listAssignments(workspace: string) {
    return this.all(
      `SELECT * FROM governance_assignment WHERE workspace = ? ORDER BY created_at ASC`,
      [workspace],
      governanceMappers.assignment
    );
  }

  async listOpenAssignments(workspace: string) {
    return this.all(
      `SELECT * FROM governance_assignment WHERE workspace = ? AND status = 'open' ORDER BY created_at ASC`,
      [workspace],
      governanceMappers.assignment
    );
  }

  async completeAssignmentIfOpen(id: string, resolvedAt: Date) {
    const result = this.run(
      `UPDATE governance_assignment SET status = 'completed', resolved_at = ?
       WHERE id = ? AND status = 'open'`,
      [resolvedAt.toISOString(), id]
    );
    if (result.changes === 0) return null;
    return await this.getAssignment(id);
  }

  async supersedeOpenSiblingAssignments(
    caseId: string,
    action: GovernanceAssignmentAction,
    decidedAssignmentId: string,
    resolvedAt: Date
  ) {
    this.run(
      `UPDATE governance_assignment SET status = 'superseded', resolved_at = ?
       WHERE case_id = ? AND action = ? AND id != ? AND status = 'open'`,
      [resolvedAt.toISOString(), caseId, action, decidedAssignmentId]
    );
  }

  async supersedeAllOpenAssignmentsForCase(caseId: string, resolvedAt: Date) {
    this.run(
      `UPDATE governance_assignment SET status = 'superseded', resolved_at = ?
       WHERE case_id = ? AND status = 'open'`,
      [resolvedAt.toISOString(), caseId]
    );
  }

  async appendEvent(input: GovernanceEventDbCreate) {
    this.run(
      `INSERT INTO governance_event (
        id, case_id, workspace, event_type, actor_user_id, occurred_at, previous_status,
        resulting_status, reason, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.id,
        input.case_id,
        input.workspace,
        input.event_type,
        input.actor_user_id,
        input.occurred_at.toISOString(),
        input.previous_status,
        input.resulting_status,
        input.reason,
        JSON.stringify(input.metadata)
      ]
    );
    return (await this.get(
      'SELECT * FROM governance_event WHERE id = ?',
      [input.id],
      governanceMappers.event
    ))!;
  }

  async listEvents(caseId: string) {
    return this.all(
      'SELECT * FROM governance_event WHERE case_id = ? ORDER BY occurred_at ASC',
      [caseId],
      governanceMappers.event
    );
  }

  async findDecisionRequest(assignmentId: string, idempotencyKey: string) {
    const row = this.get<{ event_id: string }>(
      'SELECT event_id FROM governance_decision_request WHERE assignment_id = ? AND idempotency_key = ?',
      [assignmentId, idempotencyKey]
    );
    return row ? { eventId: row.event_id } : null;
  }

  async recordDecisionRequest(
    assignmentId: string,
    idempotencyKey: string,
    eventId: string,
    createdAt: Date
  ) {
    this.run(
      `INSERT INTO governance_decision_request (assignment_id, idempotency_key, event_id, created_at)
       VALUES (?, ?, ?, ?)`,
      [assignmentId, idempotencyKey, eventId, createdAt.toISOString()]
    );
  }
}
