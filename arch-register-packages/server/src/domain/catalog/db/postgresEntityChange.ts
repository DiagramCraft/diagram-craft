import { randomUUID } from 'node:crypto';
import { mapDatabaseRows, type DatabaseRow } from '../../../db/rowMappers';
import { PostgresDatabaseBase, normalizePostgresError } from '../../../db/postgresBase';
import type {
  EntityChangeDatabase,
  EntityChangeProposalDbCreate,
  EntityChangeRevisionDbCreate,
  EntityChangeProposalStatus,
  EntityChangeRevisionStatus
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

  async createProposal(input: EntityChangeProposalDbCreate) {
    try {
      await this
        .sql`INSERT INTO entity_change_case (id, workspace, status, purpose, initiator_user_id, created_at, updated_at, closed_at) VALUES (${input.id}, ${input.workspace}, 'planned', 'requested_change', ${input.initiator_user_id}, ${input.created_at}, ${input.updated_at}, ${input.closed_at ?? null})`;
      return (await this.getProposal(input.workspace, input.id))!;
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async getProposal(workspace: string, id: string) {
    const rows = await this.sql.unsafe<DatabaseRow[]>(
      `${this.proposalSelect} WHERE c.purpose = 'requested_change' AND c.workspace = $1 AND c.id = $2 ORDER BY r.revision_number DESC LIMIT 1`,
      [workspace, id]
    );
    return rows[0] ? entityChangeMappers.proposal(rows[0]) : null;
  }

  async getOpenProposal(workspace: string, entityId: string) {
    const rows = await this.sql.unsafe<DatabaseRow[]>(
      `${this.proposalSelect} WHERE c.purpose = 'requested_change' AND c.workspace = $1 AND m.entity_id = $2 AND c.status IN ('planned', 'in_approval') ORDER BY r.revision_number DESC LIMIT 1`,
      [workspace, entityId]
    );
    return rows[0] ? entityChangeMappers.proposal(rows[0]) : null;
  }

  async listProposals(workspace: string, status?: EntityChangeProposalStatus) {
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
    return mapDatabaseRows(rows, entityChangeMappers.proposal);
  }

  async updateProposalStatus(
    workspace: string,
    id: string,
    status: EntityChangeProposalStatus,
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
    return rows[0] ? this.getProposal(workspace, id) : null;
  }

  async createRevision(input: EntityChangeRevisionDbCreate) {
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
      return (await this.getRevision(input.workspace, input.id))!;
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  private revisionSelect =
    `SELECT r.*, m.entity_id, m.base_version, m.base_state, m.proposed_state, m.diff, r.case_id AS proposal_id FROM entity_change_case_revision r JOIN entity_change_case_entity_version m ON m.revision_id = r.id`;

  async getRevision(workspace: string, id: string) {
    const rows = await this.sql.unsafe<DatabaseRow[]>(
      `${this.revisionSelect} WHERE r.workspace = $1 AND r.id = $2`,
      [workspace, id]
    );
    return rows[0] ? entityChangeMappers.revision(rows[0]) : null;
  }

  async getLatestRevision(workspace: string, proposalId: string) {
    const rows = await this.sql.unsafe<DatabaseRow[]>(
      `${this.revisionSelect} WHERE r.workspace = $1 AND r.case_id = $2 ORDER BY r.revision_number DESC LIMIT 1`,
      [workspace, proposalId]
    );
    return rows[0] ? entityChangeMappers.revision(rows[0]) : null;
  }

  async listRevisions(workspace: string, proposalId: string) {
    const rows = await this.sql.unsafe<DatabaseRow[]>(
      `${this.revisionSelect} WHERE r.workspace = $1 AND r.case_id = $2 ORDER BY r.revision_number DESC`,
      [workspace, proposalId]
    );
    return mapDatabaseRows(rows, entityChangeMappers.revision);
  }

  async updateRevisionStatus(
    workspace: string,
    id: string,
    status: EntityChangeRevisionStatus,
    resolvedAt: Date | null = null
  ) {
    const target = status === 'approved' ? 'applied' : status;
    const isActive = ['draft', 'submitted', 'changes_requested'].includes(target);
    const rows = (await this
      .sql`UPDATE entity_change_case_revision SET status = ${target}, is_active = ${isActive}, resolved_at = ${resolvedAt} WHERE workspace = ${workspace} AND id = ${id} RETURNING *`) as DatabaseRow[];
    return rows[0] ? this.getRevision(workspace, id) : null;
  }
}
