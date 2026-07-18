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
import { normalizePostgresError, PostgresDatabaseBase } from '../../../db/postgresBase';
import { mapDatabaseRows, type DatabaseRow } from '../../../db/rowMappers';

export class PostgresGovernanceDatabase extends PostgresDatabaseBase implements GovernanceDatabase {
  async createCase(input: GovernanceCaseDbCreate) {
    try {
      const [row] = await this.sql<DatabaseRow[]>`
        INSERT INTO governance_case (
          id, workspace, case_kind, subject_type, subject_id, subject_version, status,
          policy_version, initiator_user_id, parent_case_id, self_approval_allowed, payload,
          created_at, due_at
        ) VALUES (
          ${input.id}, ${input.workspace}, ${input.case_kind}, ${input.subject_type},
          ${input.subject_id}, ${input.subject_version}, 'open', ${input.policy_version},
          ${input.initiator_user_id}, ${input.parent_case_id}, ${input.self_approval_allowed},
          ${this.json(input.payload)}, ${input.created_at}, ${input.due_at}
        )
        RETURNING *
      `;
      return governanceMappers.case(row!);
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async getCase(workspace: string, id: string) {
    const [row] = await this.sql<DatabaseRow[]>`
      SELECT * FROM governance_case WHERE workspace = ${workspace} AND id = ${id}
    `;
    return row ? governanceMappers.case(row) : null;
  }

  async listCases(workspace: string, filter: GovernanceCaseListFilter = {}) {
    const rows = await this.sql<DatabaseRow[]>`
      SELECT * FROM governance_case
      WHERE workspace = ${workspace}
        AND (${filter.caseKind ?? null}::text IS NULL OR case_kind = ${filter.caseKind ?? null})
        AND (${filter.status ?? null}::text IS NULL OR status = ${filter.status ?? null})
        AND (${filter.subjectType ?? null}::text IS NULL OR subject_type = ${filter.subjectType ?? null})
        AND (${filter.subjectId ?? null}::text IS NULL OR subject_id = ${filter.subjectId ?? null})
        AND (${filter.initiatorUserId ?? null}::text IS NULL OR initiator_user_id = ${filter.initiatorUserId ?? null})
      ORDER BY created_at DESC
    `;
    return mapDatabaseRows(rows, governanceMappers.case);
  }

  async updateCase(id: string, patch: GovernanceCaseDbUpdate) {
    try {
      const [row] = await this.sql<DatabaseRow[]>`
        UPDATE governance_case
        SET status = ${patch.status}, outcome = ${patch.outcome},
            completed_at = ${patch.completed_at}, cancelled_at = ${patch.cancelled_at}
        WHERE id = ${id}
        RETURNING *
      `;
      return governanceMappers.case(row!);
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async completeCaseIfOpen(id: string, outcome: string | null, completedAt: Date) {
    const [row] = await this.sql<DatabaseRow[]>`
      UPDATE governance_case SET status = 'completed', outcome = ${outcome}, completed_at = ${completedAt}
      WHERE id = ${id} AND status = 'open'
      RETURNING *
    `;
    return row ? governanceMappers.case(row) : null;
  }

  async cancelCaseIfOpen(id: string, cancelledAt: Date) {
    const [row] = await this.sql<DatabaseRow[]>`
      UPDATE governance_case SET status = 'cancelled', cancelled_at = ${cancelledAt}
      WHERE id = ${id} AND status = 'open'
      RETURNING *
    `;
    return row ? governanceMappers.case(row) : null;
  }

  async createAssignment(input: GovernanceAssignmentDbCreate) {
    try {
      const [row] = await this.sql<DatabaseRow[]>`
        INSERT INTO governance_assignment (
          id, case_id, workspace, action, target_type, target_user_id, target_team_id,
          target_team_role, target_capability, status, created_at
        ) VALUES (
          ${input.id}, ${input.case_id}, ${input.workspace}, ${input.action}, ${input.target_type},
          ${input.target_user_id}, ${input.target_team_id}, ${input.target_team_role},
          ${input.target_capability}, 'open', ${input.created_at}
        )
        RETURNING *
      `;
      return governanceMappers.assignment(row!);
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async getAssignment(id: string) {
    const [row] = await this.sql<DatabaseRow[]>`
      SELECT * FROM governance_assignment WHERE id = ${id}
    `;
    return row ? governanceMappers.assignment(row) : null;
  }

  async listAssignmentsForCase(caseId: string) {
    const rows = await this.sql<DatabaseRow[]>`
      SELECT * FROM governance_assignment WHERE case_id = ${caseId} ORDER BY created_at ASC
    `;
    return mapDatabaseRows(rows, governanceMappers.assignment);
  }

  async listAssignments(workspace: string) {
    const rows = await this.sql<DatabaseRow[]>`
      SELECT * FROM governance_assignment WHERE workspace = ${workspace} ORDER BY created_at ASC
    `;
    return mapDatabaseRows(rows, governanceMappers.assignment);
  }

  async listOpenAssignments(workspace: string) {
    const rows = await this.sql<DatabaseRow[]>`
      SELECT * FROM governance_assignment
      WHERE workspace = ${workspace} AND status = 'open'
      ORDER BY created_at ASC
    `;
    return mapDatabaseRows(rows, governanceMappers.assignment);
  }

  async completeAssignmentIfOpen(id: string, resolvedAt: Date) {
    const [row] = await this.sql<DatabaseRow[]>`
      UPDATE governance_assignment SET status = 'completed', resolved_at = ${resolvedAt}
      WHERE id = ${id} AND status = 'open'
      RETURNING *
    `;
    return row ? governanceMappers.assignment(row) : null;
  }

  async supersedeOpenSiblingAssignments(
    caseId: string,
    action: GovernanceAssignmentAction,
    decidedAssignmentId: string,
    resolvedAt: Date
  ) {
    await this.sql`
      UPDATE governance_assignment SET status = 'superseded', resolved_at = ${resolvedAt}
      WHERE case_id = ${caseId} AND action = ${action} AND id != ${decidedAssignmentId} AND status = 'open'
    `;
  }

  async supersedeAllOpenAssignmentsForCase(caseId: string, resolvedAt: Date) {
    await this.sql`
      UPDATE governance_assignment SET status = 'superseded', resolved_at = ${resolvedAt}
      WHERE case_id = ${caseId} AND status = 'open'
    `;
  }

  async appendEvent(input: GovernanceEventDbCreate) {
    const [row] = await this.sql<DatabaseRow[]>`
      INSERT INTO governance_event (
        id, case_id, workspace, event_type, actor_user_id, occurred_at, previous_status,
        resulting_status, reason, metadata
      ) VALUES (
        ${input.id}, ${input.case_id}, ${input.workspace}, ${input.event_type},
        ${input.actor_user_id}, ${input.occurred_at}, ${input.previous_status},
        ${input.resulting_status}, ${input.reason}, ${this.json(input.metadata)}
      )
      RETURNING *
    `;
    return governanceMappers.event(row!);
  }

  async listEvents(caseId: string) {
    const rows = await this.sql<DatabaseRow[]>`
      SELECT * FROM governance_event WHERE case_id = ${caseId} ORDER BY occurred_at ASC
    `;
    return mapDatabaseRows(rows, governanceMappers.event);
  }

  async findDecisionRequest(assignmentId: string, idempotencyKey: string) {
    const [row] = await this.sql<{ event_id: string }[]>`
      SELECT event_id FROM governance_decision_request
      WHERE assignment_id = ${assignmentId} AND idempotency_key = ${idempotencyKey}
    `;
    return row ? { eventId: row.event_id } : null;
  }

  async recordDecisionRequest(
    assignmentId: string,
    idempotencyKey: string,
    eventId: string,
    createdAt: Date
  ) {
    try {
      await this.sql`
        INSERT INTO governance_decision_request (assignment_id, idempotency_key, event_id, created_at)
        VALUES (${assignmentId}, ${idempotencyKey}, ${eventId}, ${createdAt})
      `;
    } catch (error) {
      return normalizePostgresError(error);
    }
  }
}
