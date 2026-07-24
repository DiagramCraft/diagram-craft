import { randomUUID } from 'node:crypto';
import { SqliteDatabaseBase } from '../../../db/sqliteBase';
import type {
  EntityChangeDatabase,
  EntityChangeApprovalDbCreate,
  EntityChangeApprovalRevisionDbCreate,
  EntityChangeBulkApprovalRevisionDbCreate,
  EntityChangeApprovalStatus,
  EntityChangeApprovalRevisionStatus
} from './entityChangeDatabase';
import { entityChangeMappers } from './entityChangeDatabase';

/**
 * The public repository names are retained for the existing approval handlers, but all
 * persistence is now backed by the target case/revision/member model.
 */
export class SqliteEntityChangeDatabase extends SqliteDatabaseBase implements EntityChangeDatabase {
  private proposalSelect = `
    SELECT c.*, m.entity_id,
      CASE c.status WHEN 'planned' THEN 'open' WHEN 'in_approval' THEN 'open'
        WHEN 'applied' THEN 'approved' ELSE c.status END AS status
    FROM entity_change_case c
    LEFT JOIN entity_change_case_revision r ON r.case_id = c.id
    LEFT JOIN entity_change_case_entity_version m ON m.revision_id = r.id`;

  async createApproval(input: EntityChangeApprovalDbCreate) {
    this.run(
      `INSERT INTO entity_change_case
       (id, workspace, status, purpose, initiator_user_id, created_at, updated_at, closed_at)
       VALUES (?, ?, 'planned', 'requested_change', ?, ?, ?, ?)`,
      [
        input.id,
        input.workspace,
        input.initiator_user_id,
        input.created_at.toISOString(),
        input.updated_at.toISOString(),
        input.closed_at?.toISOString() ?? null
      ]
    );
    return (await this.getApproval(input.workspace, input.id))!;
  }

  async getApproval(workspace: string, id: string) {
    return this.get(
      `${this.proposalSelect} WHERE c.purpose = 'requested_change' AND c.workspace = ? AND c.id = ? ORDER BY r.revision_number DESC LIMIT 1`,
      [workspace, id],
      entityChangeMappers.approval
    );
  }

  async getOpenApproval(workspace: string, entityId: string) {
    return this.get(
      `${this.proposalSelect} WHERE c.purpose = 'requested_change' AND c.workspace = ? AND m.entity_id = ? AND c.status IN ('planned', 'in_approval') ORDER BY r.revision_number DESC LIMIT 1`,
      [workspace, entityId],
      entityChangeMappers.approval
    );
  }

  async listApprovals(workspace: string, status?: EntityChangeApprovalStatus) {
    const target =
      status === 'open'
        ? "c.status IN ('planned', 'in_approval')"
        : status === 'approved'
          ? "c.status = 'applied'"
          : status
            ? 'c.status = ?'
            : null;
    const params =
      status && target && !target.includes('IN ') && !target.includes("'applied'")
        ? [workspace, status]
        : [workspace];
    return this.all(
      `${this.proposalSelect} WHERE c.purpose = 'requested_change' AND c.workspace = ? ${target ? `AND ${target}` : ''} ORDER BY c.updated_at DESC`,
      params,
      entityChangeMappers.approval
    );
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
      this.run('UPDATE entity_change_case_revision SET is_active = 0 WHERE case_id = ?', [id]);
    }
    const result = this.run(
      'UPDATE entity_change_case SET status = ?, updated_at = ?, closed_at = ? WHERE workspace = ? AND id = ?',
      [target, updatedAt.toISOString(), closedAt?.toISOString() ?? null, workspace, id]
    );
    return result.changes === 0 ? null : await this.getApproval(workspace, id);
  }

  async createApprovalRevision(input: EntityChangeApprovalRevisionDbCreate) {
    const targetStatus = input.status === 'approved' ? 'applied' : input.status;
    const isActive = ['draft', 'submitted', 'changes_requested'].includes(targetStatus) ? 1 : 0;
    this.run('UPDATE entity_change_case_revision SET is_active = 0 WHERE case_id = ?', [
      input.proposal_id
    ]);
    this.run(
      `INSERT INTO entity_change_case_revision
       (id, case_id, workspace, revision_number, policy_version, resolved_policy, message, created_by, status, is_active, created_at, resolved_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.id,
        input.proposal_id,
        input.workspace,
        input.revision_number,
        input.policy_version,
        JSON.stringify(input.resolved_policy),
        input.message,
        input.created_by,
        targetStatus,
        isActive,
        input.created_at.toISOString(),
        input.resolved_at?.toISOString() ?? null
      ]
    );
    this.run(
      `INSERT INTO entity_change_case_entity_version
       (id, revision_id, workspace, entity_id, base_version, base_state, proposed_state, diff)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        randomUUID(),
        input.id,
        input.workspace,
        input.entity_id,
        input.base_version,
        JSON.stringify(input.base_state),
        JSON.stringify(input.proposed_state),
        JSON.stringify(input.diff)
      ]
    );
    this.run("UPDATE entity_change_case SET status = 'in_approval', updated_at = ? WHERE id = ?", [
      input.created_at.toISOString(),
      input.proposal_id
    ]);
    return (await this.getApprovalRevision(input.workspace, input.id))!;
  }

  private revisionSelect = `
    SELECT r.*, m.entity_id, m.base_version, m.base_state, m.proposed_state, m.diff,
      r.case_id AS proposal_id
    FROM entity_change_case_revision r
    JOIN entity_change_case_entity_version m ON m.revision_id = r.id`;

  private revisionMemberSelect = `
    SELECT r.*, m.id AS member_id, m.entity_id, m.base_version, m.base_state, m.proposed_state, m.diff,
      r.case_id AS proposal_id
    FROM entity_change_case_revision r
    JOIN entity_change_case_entity_version m ON m.revision_id = r.id`;

  async createBulkApprovalRevision(input: EntityChangeBulkApprovalRevisionDbCreate) {
    const targetStatus = input.status === 'approved' ? 'applied' : input.status;
    const isActive = ['draft', 'submitted', 'changes_requested'].includes(targetStatus) ? 1 : 0;
    this.run('UPDATE entity_change_case_revision SET is_active = 0 WHERE case_id = ?', [
      input.proposal_id
    ]);
    this.run(
      `INSERT INTO entity_change_case_revision
       (id, case_id, workspace, revision_number, policy_version, resolved_policy, message, created_by, status, is_active, created_at, resolved_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.id,
        input.proposal_id,
        input.workspace,
        input.revision_number,
        input.policy_version,
        JSON.stringify(input.resolved_policy),
        input.message,
        input.created_by,
        targetStatus,
        isActive,
        input.created_at.toISOString(),
        input.resolved_at?.toISOString() ?? null
      ]
    );
    for (const member of input.members) {
      this.run(
        `INSERT INTO entity_change_case_entity_version
         (id, revision_id, workspace, entity_id, base_version, base_state, proposed_state, diff)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          randomUUID(),
          input.id,
          input.workspace,
          member.entity_id,
          member.base_version,
          JSON.stringify(member.base_state),
          JSON.stringify(member.proposed_state),
          JSON.stringify(member.diff)
        ]
      );
    }
    this.run("UPDATE entity_change_case SET status = 'in_approval', updated_at = ? WHERE id = ?", [
      input.created_at.toISOString(),
      input.proposal_id
    ]);
    return await this.getApprovalRevisionMembers(input.workspace, input.id);
  }

  async getApprovalRevisionMembers(workspace: string, revisionId: string) {
    return this.all(
      `${this.revisionMemberSelect} WHERE r.workspace = ? AND r.id = ? ORDER BY m.entity_id`,
      [workspace, revisionId],
      entityChangeMappers.approvalRevisionMember
    );
  }

  async getApprovalRevision(workspace: string, id: string) {
    return this.get(
      `${this.revisionSelect} WHERE r.workspace = ? AND r.id = ?`,
      [workspace, id],
      entityChangeMappers.approvalRevision
    );
  }

  async getLatestApprovalRevision(workspace: string, approvalId: string) {
    return this.get(
      `${this.revisionSelect} WHERE r.workspace = ? AND r.case_id = ? ORDER BY r.revision_number DESC LIMIT 1`,
      [workspace, approvalId],
      entityChangeMappers.approvalRevision
    );
  }

  async listApprovalRevisions(workspace: string, approvalId: string) {
    return this.all(
      `${this.revisionSelect} WHERE r.workspace = ? AND r.case_id = ? ORDER BY r.revision_number DESC`,
      [workspace, approvalId],
      entityChangeMappers.approvalRevision
    );
  }

  async updateApprovalRevisionStatus(
    workspace: string,
    id: string,
    status: EntityChangeApprovalRevisionStatus,
    resolvedAt: Date | null = null
  ) {
    const target = status === 'approved' ? 'applied' : status;
    const isActive = ['draft', 'submitted', 'changes_requested'].includes(target) ? 1 : 0;
    const result = this.run(
      'UPDATE entity_change_case_revision SET status = ?, is_active = ?, resolved_at = ? WHERE workspace = ? AND id = ?',
      [target, isActive, resolvedAt?.toISOString() ?? null, workspace, id]
    );
    return result.changes === 0 ? null : await this.getApprovalRevision(workspace, id);
  }
}
