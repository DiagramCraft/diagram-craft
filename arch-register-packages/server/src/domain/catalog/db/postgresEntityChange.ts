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
  async createProposal(input: EntityChangeProposalDbCreate) {
    try {
      const [row] = (await this.sql`
        INSERT INTO entity_change_proposal (id, workspace, entity_id, status, initiator_user_id, created_at, updated_at, closed_at)
        VALUES (${input.id}, ${input.workspace}, ${input.entity_id}, ${input.status}, ${input.initiator_user_id}, ${input.created_at}, ${input.updated_at}, ${input.closed_at ?? null})
        RETURNING *
      `) as DatabaseRow[];
      return entityChangeMappers.proposal(row!);
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async getProposal(workspace: string, id: string) {
    const [row] = await this.sql<DatabaseRow[]>`
      SELECT * FROM entity_change_proposal WHERE workspace = ${workspace} AND id = ${id}
    `;
    return row ? entityChangeMappers.proposal(row) : null;
  }

  async getOpenProposal(workspace: string, entityId: string) {
    const [row] = await this.sql<DatabaseRow[]>`
      SELECT * FROM entity_change_proposal WHERE workspace = ${workspace} AND entity_id = ${entityId} AND status = 'open'
    `;
    return row ? entityChangeMappers.proposal(row) : null;
  }

  async listProposals(workspace: string, status?: EntityChangeProposalStatus) {
    const rows = status
      ? await this.sql<DatabaseRow[]>`
          SELECT * FROM entity_change_proposal WHERE workspace = ${workspace} AND status = ${status} ORDER BY updated_at DESC
        `
      : await this.sql<DatabaseRow[]>`
          SELECT * FROM entity_change_proposal WHERE workspace = ${workspace} ORDER BY updated_at DESC
        `;
    return mapDatabaseRows(rows, entityChangeMappers.proposal);
  }

  async updateProposalStatus(
    workspace: string,
    id: string,
    status: EntityChangeProposalStatus,
    updatedAt: Date,
    closedAt: Date | null = null
  ) {
    const rows = (await this.sql`
      UPDATE entity_change_proposal
      SET status = ${status}, updated_at = ${updatedAt}, closed_at = ${closedAt}
      WHERE workspace = ${workspace} AND id = ${id}
      RETURNING *
    `) as DatabaseRow[];
    return rows[0] ? entityChangeMappers.proposal(rows[0]) : null;
  }

  async createRevision(input: EntityChangeRevisionDbCreate) {
    try {
      const [row] = (await this.sql`
        INSERT INTO entity_change_proposal_revision
          (id, proposal_id, workspace, entity_id, revision_number, base_version, base_state, proposed_state, diff, policy_version, resolved_policy, message, created_by, status, created_at, resolved_at)
        VALUES
          (${input.id}, ${input.proposal_id}, ${input.workspace}, ${input.entity_id}, ${input.revision_number}, ${input.base_version}, ${this.json(input.base_state)}, ${this.json(input.proposed_state)}, ${this.json(input.diff)}, ${input.policy_version}, ${this.json(input.resolved_policy)}, ${input.message}, ${input.created_by}, ${input.status}, ${input.created_at}, ${input.resolved_at ?? null})
        RETURNING *
      `) as DatabaseRow[];
      return entityChangeMappers.revision(row!);
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async getRevision(workspace: string, id: string) {
    const [row] = await this.sql<DatabaseRow[]>`
      SELECT * FROM entity_change_proposal_revision WHERE workspace = ${workspace} AND id = ${id}
    `;
    return row ? entityChangeMappers.revision(row) : null;
  }

  async getLatestRevision(workspace: string, proposalId: string) {
    const [row] = await this.sql<DatabaseRow[]>`
      SELECT * FROM entity_change_proposal_revision WHERE workspace = ${workspace} AND proposal_id = ${proposalId} ORDER BY revision_number DESC LIMIT 1
    `;
    return row ? entityChangeMappers.revision(row) : null;
  }

  async listRevisions(workspace: string, proposalId: string) {
    const rows = await this.sql<DatabaseRow[]>`
      SELECT * FROM entity_change_proposal_revision WHERE workspace = ${workspace} AND proposal_id = ${proposalId} ORDER BY revision_number DESC
    `;
    return mapDatabaseRows(rows, entityChangeMappers.revision);
  }

  async updateRevisionStatus(
    workspace: string,
    id: string,
    status: EntityChangeRevisionStatus,
    resolvedAt: Date | null = null
  ) {
    const rows = (await this.sql`
      UPDATE entity_change_proposal_revision
      SET status = ${status}, resolved_at = ${resolvedAt}
      WHERE workspace = ${workspace} AND id = ${id}
      RETURNING *
    `) as DatabaseRow[];
    return rows[0] ? entityChangeMappers.revision(rows[0]) : null;
  }
}
