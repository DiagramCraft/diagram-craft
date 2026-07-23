import { databaseDate, parseDatabaseJson, type DatabaseRow } from '../../../db/rowMappers';

export type EntityChangeProposalStatus = 'open' | 'approved' | 'rejected' | 'withdrawn';
export type EntityChangeRevisionStatus =
  | 'submitted'
  | 'changes_requested'
  | 'stale'
  | 'approved'
  | 'rejected'
  | 'withdrawn';

export type EntityChangeProposalDbResult = {
  id: string;
  workspace: string;
  entity_id: string;
  status: EntityChangeProposalStatus;
  initiator_user_id: string | null;
  created_at: Date;
  updated_at: Date;
  closed_at: Date | null;
};

export type EntityChangeRevisionDbResult = {
  id: string;
  proposal_id: string;
  workspace: string;
  entity_id: string;
  revision_number: number;
  base_version: number;
  base_state: Record<string, unknown>;
  proposed_state: Record<string, unknown>;
  diff: Record<string, unknown>;
  policy_version: string;
  resolved_policy: Record<string, unknown>;
  message: string | null;
  created_by: string | null;
  status: EntityChangeRevisionStatus;
  created_at: Date;
  resolved_at: Date | null;
};

export type EntityChangeProposalDbCreate = Omit<
  EntityChangeProposalDbResult,
  'created_at' | 'updated_at' | 'closed_at'
> & { created_at: Date; updated_at: Date; closed_at?: Date | null };

export type EntityChangeRevisionDbCreate = Omit<
  EntityChangeRevisionDbResult,
  'created_at' | 'resolved_at'
> & { created_at: Date; resolved_at?: Date | null };

/**
 * A single member row (`entity_change_case_entity_version`) within a bulk revision. Bulk
 * revisions back the multi-entity propose-a-change flow (#2365), where one revision spans several
 * entities instead of the single-entity `EntityChangeRevisionDbCreate` shape above.
 */
export type EntityChangeRevisionMemberInput = {
  entity_id: string;
  base_version: number;
  base_state: Record<string, unknown>;
  proposed_state: Record<string, unknown>;
  diff: Record<string, unknown>;
};

export type EntityChangeBulkRevisionDbCreate = {
  id: string;
  proposal_id: string;
  workspace: string;
  revision_number: number;
  policy_version: string;
  resolved_policy: Record<string, unknown>;
  message: string | null;
  created_by: string | null;
  status: EntityChangeRevisionStatus;
  created_at: Date;
  resolved_at?: Date | null;
  members: EntityChangeRevisionMemberInput[];
};

/** A member row of a bulk revision, carrying its own `entity_change_case_entity_version.id`. */
export type EntityChangeRevisionMemberDbResult = EntityChangeRevisionDbResult & {
  member_id: string;
};

export const entityChangeMappers = {
  proposal: (row: DatabaseRow): EntityChangeProposalDbResult => ({
    id: String(row['id']),
    workspace: String(row['workspace']),
    entity_id: String(row['entity_id']),
    status: row['status'] as EntityChangeProposalStatus,
    initiator_user_id: row['initiator_user_id'] == null ? null : String(row['initiator_user_id']),
    created_at: databaseDate(row['created_at']),
    updated_at: databaseDate(row['updated_at']),
    closed_at: row['closed_at'] == null ? null : databaseDate(row['closed_at'])
  }),
  revision: (row: DatabaseRow): EntityChangeRevisionDbResult => ({
    id: String(row['id']),
    proposal_id: String(row['proposal_id']),
    workspace: String(row['workspace']),
    entity_id: String(row['entity_id']),
    revision_number: Number(row['revision_number']),
    base_version: Number(row['base_version']),
    base_state: parseDatabaseJson(row['base_state'], {}, 'entity_change_revision.base_state'),
    proposed_state: parseDatabaseJson(
      row['proposed_state'],
      {},
      'entity_change_revision.proposed_state'
    ),
    diff: parseDatabaseJson(row['diff'], {}, 'entity_change_revision.diff'),
    policy_version: String(row['policy_version']),
    resolved_policy: parseDatabaseJson(
      row['resolved_policy'],
      {},
      'entity_change_revision.resolved_policy'
    ),
    message: row['message'] == null ? null : String(row['message']),
    created_by: row['created_by'] == null ? null : String(row['created_by']),
    status: row['status'] as EntityChangeRevisionStatus,
    created_at: databaseDate(row['created_at']),
    resolved_at: row['resolved_at'] == null ? null : databaseDate(row['resolved_at'])
  }),
  revisionMember: (row: DatabaseRow): EntityChangeRevisionMemberDbResult => ({
    ...entityChangeMappers.revision(row),
    member_id: String(row['member_id'])
  })
};

export type EntityChangeDatabase = {
  createProposal(input: EntityChangeProposalDbCreate): Promise<EntityChangeProposalDbResult>;
  getProposal(workspace: string, id: string): Promise<EntityChangeProposalDbResult | null>;
  getOpenProposal(
    workspace: string,
    entityId: string
  ): Promise<EntityChangeProposalDbResult | null>;
  listProposals(
    workspace: string,
    status?: EntityChangeProposalStatus
  ): Promise<EntityChangeProposalDbResult[]>;
  updateProposalStatus(
    workspace: string,
    id: string,
    status: EntityChangeProposalStatus,
    updatedAt: Date,
    closedAt?: Date | null
  ): Promise<EntityChangeProposalDbResult | null>;
  createRevision(input: EntityChangeRevisionDbCreate): Promise<EntityChangeRevisionDbResult>;
  getRevision(workspace: string, id: string): Promise<EntityChangeRevisionDbResult | null>;
  getLatestRevision(
    workspace: string,
    proposalId: string
  ): Promise<EntityChangeRevisionDbResult | null>;
  listRevisions(workspace: string, proposalId: string): Promise<EntityChangeRevisionDbResult[]>;
  updateRevisionStatus(
    workspace: string,
    id: string,
    status: EntityChangeRevisionStatus,
    resolvedAt?: Date | null
  ): Promise<EntityChangeRevisionDbResult | null>;
  createBulkRevision(
    input: EntityChangeBulkRevisionDbCreate
  ): Promise<EntityChangeRevisionMemberDbResult[]>;
  getRevisionMembers(
    workspace: string,
    revisionId: string
  ): Promise<EntityChangeRevisionMemberDbResult[]>;
};
