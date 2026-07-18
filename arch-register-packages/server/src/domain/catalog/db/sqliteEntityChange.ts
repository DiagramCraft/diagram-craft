import { SqliteDatabaseBase } from '../../../db/sqliteBase';
import type {
  EntityChangeDatabase,
  EntityChangeProposalDbCreate,
  EntityChangeRevisionDbCreate,
  EntityChangeProposalStatus,
  EntityChangeRevisionStatus
} from './entityChangeDatabase';
import { entityChangeMappers } from './entityChangeDatabase';

export class SqliteEntityChangeDatabase extends SqliteDatabaseBase implements EntityChangeDatabase {
  async createProposal(input: EntityChangeProposalDbCreate) {
    this.run(
      'INSERT INTO entity_change_proposal (id, workspace, entity_id, status, initiator_user_id, created_at, updated_at, closed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [
        input.id,
        input.workspace,
        input.entity_id,
        input.status,
        input.initiator_user_id,
        input.created_at.toISOString(),
        input.updated_at.toISOString(),
        input.closed_at?.toISOString() ?? null
      ]
    );
    return (await this.getProposal(input.workspace, input.id))!;
  }

  async getProposal(workspace: string, id: string) {
    return this.get(
      'SELECT * FROM entity_change_proposal WHERE workspace = ? AND id = ?',
      [workspace, id],
      entityChangeMappers.proposal
    );
  }

  async getOpenProposal(workspace: string, entityId: string) {
    return this.get(
      "SELECT * FROM entity_change_proposal WHERE workspace = ? AND entity_id = ? AND status = 'open'",
      [workspace, entityId],
      entityChangeMappers.proposal
    );
  }

  async listProposals(workspace: string, status?: EntityChangeProposalStatus) {
    return this.all(
      `SELECT * FROM entity_change_proposal WHERE workspace = ? ${status ? 'AND status = ?' : ''} ORDER BY updated_at DESC`,
      status ? [workspace, status] : [workspace],
      entityChangeMappers.proposal
    );
  }

  async updateProposalStatus(
    workspace: string,
    id: string,
    status: EntityChangeProposalStatus,
    updatedAt: Date,
    closedAt: Date | null = null
  ) {
    const result = this.run(
      'UPDATE entity_change_proposal SET status = ?, updated_at = ?, closed_at = ? WHERE workspace = ? AND id = ?',
      [status, updatedAt.toISOString(), closedAt?.toISOString() ?? null, workspace, id]
    );
    return result.changes === 0 ? null : await this.getProposal(workspace, id);
  }

  async createRevision(input: EntityChangeRevisionDbCreate) {
    this.run(
      'INSERT INTO entity_change_proposal_revision (id, proposal_id, workspace, entity_id, revision_number, base_version, base_state, proposed_state, diff, policy_version, resolved_policy, message, created_by, status, created_at, resolved_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        input.id,
        input.proposal_id,
        input.workspace,
        input.entity_id,
        input.revision_number,
        input.base_version,
        JSON.stringify(input.base_state),
        JSON.stringify(input.proposed_state),
        JSON.stringify(input.diff),
        input.policy_version,
        JSON.stringify(input.resolved_policy),
        input.message,
        input.created_by,
        input.status,
        input.created_at.toISOString(),
        input.resolved_at?.toISOString() ?? null
      ]
    );
    return (await this.getRevision(input.workspace, input.id))!;
  }

  async getRevision(workspace: string, id: string) {
    return this.get(
      'SELECT * FROM entity_change_proposal_revision WHERE workspace = ? AND id = ?',
      [workspace, id],
      entityChangeMappers.revision
    );
  }

  async getLatestRevision(workspace: string, proposalId: string) {
    return this.get(
      'SELECT * FROM entity_change_proposal_revision WHERE workspace = ? AND proposal_id = ? ORDER BY revision_number DESC LIMIT 1',
      [workspace, proposalId],
      entityChangeMappers.revision
    );
  }

  async listRevisions(workspace: string, proposalId: string) {
    return this.all(
      'SELECT * FROM entity_change_proposal_revision WHERE workspace = ? AND proposal_id = ? ORDER BY revision_number DESC',
      [workspace, proposalId],
      entityChangeMappers.revision
    );
  }

  async updateRevisionStatus(
    workspace: string,
    id: string,
    status: EntityChangeRevisionStatus,
    resolvedAt: Date | null = null
  ) {
    const result = this.run(
      'UPDATE entity_change_proposal_revision SET status = ?, resolved_at = ? WHERE workspace = ? AND id = ?',
      [status, resolvedAt?.toISOString() ?? null, workspace, id]
    );
    return result.changes === 0 ? null : await this.getRevision(workspace, id);
  }
}
