import { randomUUID } from 'node:crypto';
import { mapDatabaseRows, type DatabaseRow } from '../../../db/rowMappers';
import { PostgresDatabaseBase, normalizePostgresError } from '../../../db/postgresBase';
import type {
  EntityChangeDatabase,
  EntityChangeApprovalDbCreate,
  EntityChangeApprovalRevisionDbCreate,
  EntityChangeBulkApprovalRevisionDbCreate,
  EntityChangeApprovalStatus,
  EntityChangeApprovalRevisionStatus
} from './entityChangeDatabase';
import { entityChangeMappers } from './entityChangeDatabase';

export class PostgresEntityChangeDatabase
  extends PostgresDatabaseBase
  implements EntityChangeDatabase
{
  private proposalSelect = `
    SELECT c.*, m.entity_id,
      CASE c.status WHEN 'planned' THEN 'open' WHEN 'in_approval' THEN 'open'
        WHEN 'applied' THEN 'approved' ELSE c.status END AS status
    FROM entity_change_case c
    LEFT JOIN entity_change_case_revision r ON r.case_id = c.id
    LEFT JOIN entity_change_case_entity_version m ON m.revision_id = r.id`;

  async createApproval(input: EntityChangeApprovalDbCreate) {
    try {
      await this
        .sql`INSERT INTO entity_change_case (id, workspace, status, purpose, initiator_user_id, created_at, updated_at, closed_at) VALUES (${input.id}, ${input.workspace}, 'planned', 'requested_change', ${input.initiator_user_id}, ${input.created_at}, ${input.updated_at}, ${input.closed_at ?? null})`;
      return (await this.getApproval(input.workspace, input.id))!;
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async getApproval(workspace: string, id: string) {
    const rows = await this.sql.unsafe<DatabaseRow[]>(
      `${this.proposalSelect} WHERE c.purpose = 'requested_change' AND c.workspace = $1 AND c.id = $2 ORDER BY r.revision_number DESC LIMIT 1`,
      [workspace, id]
    );
    return rows[0] ? entityChangeMappers.approval(rows[0]) : null;
  }

  async getOpenApproval(workspace: string, entityId: string) {
    const rows = await this.sql.unsafe<DatabaseRow[]>(
      `${this.proposalSelect} WHERE c.purpose = 'requested_change' AND c.workspace = $1 AND m.entity_id = $2 AND c.status IN ('planned', 'in_approval') ORDER BY r.revision_number DESC LIMIT 1`,
      [workspace, entityId]
    );
    return rows[0] ? entityChangeMappers.approval(rows[0]) : null;
  }

  async listApprovals(workspace: string, status?: EntityChangeApprovalStatus) {
    const target =
      status === 'open'
        ? "c.status IN ('planned', 'in_approval')"
        : status === 'approved'
          ? "c.status = 'applied'"
          : status
            ? 'c.status = $2'
            : '';
    const rows = await this.sql.unsafe<DatabaseRow[]>(
      `${this.proposalSelect} WHERE c.purpose = 'requested_change' AND c.workspace = $1 ${target ? `AND ${target}` : ''} ORDER BY c.updated_at DESC`,
      status && target === 'c.status = $2' ? [workspace, status] : [workspace]
    );
    return mapDatabaseRows(rows, entityChangeMappers.approval);
  }

  async updateApprovalStatus(
    workspace: string,
    id: string,
    status: EntityChangeApprovalStatus,
    updatedAt: Date,
    closedAt: Date | null = null
  ) {
    const target = status === 'open' ? 'in_approval' : status === 'approved' ? 'applied' : status;
    if (target !== 'in_approval') {
      await this.sql`
        UPDATE entity_change_case_revision
        SET is_active = FALSE
        WHERE case_id = ${id}
      `;
    }
    const rows = (await this
      .sql`UPDATE entity_change_case SET status = ${target}, updated_at = ${updatedAt}, closed_at = ${closedAt} WHERE workspace = ${workspace} AND id = ${id} RETURNING *`) as DatabaseRow[];
    return rows[0] ? this.getApproval(workspace, id) : null;
  }

  async createApprovalRevision(input: EntityChangeApprovalRevisionDbCreate) {
    try {
      const targetStatus = input.status === 'approved' ? 'applied' : input.status;
      const isActive = ['draft', 'submitted', 'changes_requested'].includes(targetStatus);
      await this.sql`
        UPDATE entity_change_case_revision
        SET is_active = FALSE
        WHERE case_id = ${input.proposal_id}
      `;
      await this
        .sql`INSERT INTO entity_change_case_revision (id, case_id, workspace, revision_number, policy_version, resolved_policy, message, created_by, status, is_active, created_at, resolved_at) VALUES (${input.id}, ${input.proposal_id}, ${input.workspace}, ${input.revision_number}, ${input.policy_version}, ${this.json(input.resolved_policy)}, ${input.message}, ${input.created_by}, ${targetStatus}, ${isActive}, ${input.created_at}, ${input.resolved_at ?? null})`;
      await this
        .sql`INSERT INTO entity_change_case_entity_version (id, revision_id, workspace, entity_id, base_version, base_state, proposed_state, diff) VALUES (${randomUUID()}, ${input.id}, ${input.workspace}, ${input.entity_id}, ${input.base_version}, ${this.json(input.base_state)}, ${this.json(input.proposed_state)}, ${this.json(input.diff)})`;
      await this
        .sql`UPDATE entity_change_case SET status = 'in_approval', updated_at = ${input.created_at} WHERE id = ${input.proposal_id}`;
      return (await this.getApprovalRevision(input.workspace, input.id))!;
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  private revisionSelect =
    `SELECT r.*, m.entity_id, m.base_version, m.base_state, m.proposed_state, m.diff, r.case_id AS proposal_id FROM entity_change_case_revision r JOIN entity_change_case_entity_version m ON m.revision_id = r.id`;

  private revisionMemberSelect =
    `SELECT r.*, m.id AS member_id, m.entity_id, m.base_version, m.base_state, m.proposed_state, m.diff, r.case_id AS proposal_id FROM entity_change_case_revision r JOIN entity_change_case_entity_version m ON m.revision_id = r.id`;

  async createBulkApprovalRevision(input: EntityChangeBulkApprovalRevisionDbCreate) {
    try {
      const targetStatus = input.status === 'approved' ? 'applied' : input.status;
      const isActive = ['draft', 'submitted', 'changes_requested'].includes(targetStatus);
      await this.sql`
        UPDATE entity_change_case_revision
        SET is_active = FALSE
        WHERE case_id = ${input.proposal_id}
      `;
      await this
        .sql`INSERT INTO entity_change_case_revision (id, case_id, workspace, revision_number, policy_version, resolved_policy, message, created_by, status, is_active, created_at, resolved_at) VALUES (${input.id}, ${input.proposal_id}, ${input.workspace}, ${input.revision_number}, ${input.policy_version}, ${this.json(input.resolved_policy)}, ${input.message}, ${input.created_by}, ${targetStatus}, ${isActive}, ${input.created_at}, ${input.resolved_at ?? null})`;
      for (const member of input.members) {
        await this
          .sql`INSERT INTO entity_change_case_entity_version (id, revision_id, workspace, entity_id, base_version, base_state, proposed_state, diff) VALUES (${randomUUID()}, ${input.id}, ${input.workspace}, ${member.entity_id}, ${member.base_version}, ${this.json(member.base_state)}, ${this.json(member.proposed_state)}, ${this.json(member.diff)})`;
      }
      await this
        .sql`UPDATE entity_change_case SET status = 'in_approval', updated_at = ${input.created_at} WHERE id = ${input.proposal_id}`;
      return await this.getApprovalRevisionMembers(input.workspace, input.id);
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async getApprovalRevisionMembers(workspace: string, revisionId: string) {
    const rows = await this.sql.unsafe<DatabaseRow[]>(
      `${this.revisionMemberSelect} WHERE r.workspace = $1 AND r.id = $2 ORDER BY m.entity_id`,
      [workspace, revisionId]
    );
    return mapDatabaseRows(rows, entityChangeMappers.approvalRevisionMember);
  }

  async getApprovalRevision(workspace: string, id: string) {
    const rows = await this.sql.unsafe<DatabaseRow[]>(
      `${this.revisionSelect} WHERE r.workspace = $1 AND r.id = $2`,
      [workspace, id]
    );
    return rows[0] ? entityChangeMappers.approvalRevision(rows[0]) : null;
  }

  async getLatestApprovalRevision(workspace: string, approvalId: string) {
    const rows = await this.sql.unsafe<DatabaseRow[]>(
      `${this.revisionSelect} WHERE r.workspace = $1 AND r.case_id = $2 ORDER BY r.revision_number DESC LIMIT 1`,
      [workspace, approvalId]
    );
    return rows[0] ? entityChangeMappers.approvalRevision(rows[0]) : null;
  }

  async listApprovalRevisions(workspace: string, approvalId: string) {
    const rows = await this.sql.unsafe<DatabaseRow[]>(
      `${this.revisionSelect} WHERE r.workspace = $1 AND r.case_id = $2 ORDER BY r.revision_number DESC`,
      [workspace, approvalId]
    );
    return mapDatabaseRows(rows, entityChangeMappers.approvalRevision);
  }

  async updateApprovalRevisionStatus(
    workspace: string,
    id: string,
    status: EntityChangeApprovalRevisionStatus,
    resolvedAt: Date | null = null
  ) {
    const target = status === 'approved' ? 'applied' : status;
    const isActive = ['draft', 'submitted', 'changes_requested'].includes(target);
    const rows = (await this
      .sql`UPDATE entity_change_case_revision SET status = ${target}, is_active = ${isActive}, resolved_at = ${resolvedAt} WHERE workspace = ${workspace} AND id = ${id} RETURNING *`) as DatabaseRow[];
    return rows[0] ? this.getApprovalRevision(workspace, id) : null;
  }
}
