import { databaseDate, parseDatabaseJson, type DatabaseRow } from '../../../db/rowMappers';

export type EntityChangeApprovalStatus = 'open' | 'approved' | 'rejected' | 'withdrawn';
export type EntityChangeApprovalRevisionStatus =
  | 'submitted'
  | 'changes_requested'
  | 'stale'
  | 'approved'
  | 'rejected'
  | 'withdrawn';

export type EntityChangeApprovalDbResult = {
  id: string;
  workspace: string;
  entity_id: string;
  status: EntityChangeApprovalStatus;
  initiator_user_id: string | null;
  created_at: Date;
  updated_at: Date;
  closed_at: Date | null;
};

export type EntityChangeApprovalRevisionDbResult = {
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
  status: EntityChangeApprovalRevisionStatus;
  created_at: Date;
  resolved_at: Date | null;
};

export type EntityChangeApprovalDbCreate = Omit<
  EntityChangeApprovalDbResult,
  'created_at' | 'updated_at' | 'closed_at'
> & { created_at: Date; updated_at: Date; closed_at?: Date | null };

export type EntityChangeApprovalRevisionDbCreate = Omit<
  EntityChangeApprovalRevisionDbResult,
  'created_at' | 'resolved_at'
> & { created_at: Date; resolved_at?: Date | null };

/**
 * A single member row (`entity_change_case_entity_version`) within a bulk revision. Bulk
 * revisions back the multi-entity propose-a-change flow (#2365), where one revision spans several
 * entities instead of the single-entity `EntityChangeRevisionDbCreate` shape above.
 */
export type EntityChangeApprovalRevisionMemberInput = {
  entity_id: string;
  base_version: number;
  base_state: Record<string, unknown>;
  proposed_state: Record<string, unknown>;
  diff: Record<string, unknown>;
};

export type EntityChangeBulkApprovalRevisionDbCreate = {
  id: string;
  proposal_id: string;
  workspace: string;
  revision_number: number;
  policy_version: string;
  resolved_policy: Record<string, unknown>;
  message: string | null;
  created_by: string | null;
  status: EntityChangeApprovalRevisionStatus;
  created_at: Date;
  resolved_at?: Date | null;
  members: EntityChangeApprovalRevisionMemberInput[];
};

/** A member row of a bulk revision, carrying its own `entity_change_case_entity_version.id`. */
export type EntityChangeApprovalRevisionMemberDbResult = EntityChangeApprovalRevisionDbResult & {
  member_id: string;
};

export const entityChangeMappers = {
  approval: (row: DatabaseRow): EntityChangeApprovalDbResult => ({
    id: String(row['id']),
    workspace: String(row['workspace']),
    entity_id: String(row['entity_id']),
    status: row['status'] as EntityChangeApprovalStatus,
    initiator_user_id: row['initiator_user_id'] == null ? null : String(row['initiator_user_id']),
    created_at: databaseDate(row['created_at']),
    updated_at: databaseDate(row['updated_at']),
    closed_at: row['closed_at'] == null ? null : databaseDate(row['closed_at'])
  }),
  approvalRevision: (row: DatabaseRow): EntityChangeApprovalRevisionDbResult => ({
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
    status: row['status'] as EntityChangeApprovalRevisionStatus,
    created_at: databaseDate(row['created_at']),
    resolved_at: row['resolved_at'] == null ? null : databaseDate(row['resolved_at'])
  }),
  approvalRevisionMember: (row: DatabaseRow): EntityChangeApprovalRevisionMemberDbResult => ({
    ...entityChangeMappers.approvalRevision(row),
    member_id: String(row['member_id'])
  })
};

export type EntityChangeDatabase = {
  createApproval(input: EntityChangeApprovalDbCreate): Promise<EntityChangeApprovalDbResult>;
  getApproval(workspace: string, id: string): Promise<EntityChangeApprovalDbResult | null>;
  getOpenApproval(
    workspace: string,
    entityId: string
  ): Promise<EntityChangeApprovalDbResult | null>;
  listApprovals(
    workspace: string,
    status?: EntityChangeApprovalStatus
  ): Promise<EntityChangeApprovalDbResult[]>;
  updateApprovalStatus(
    workspace: string,
    id: string,
    status: EntityChangeApprovalStatus,
    updatedAt: Date,
    closedAt?: Date | null
  ): Promise<EntityChangeApprovalDbResult | null>;
  createApprovalRevision(
    input: EntityChangeApprovalRevisionDbCreate
  ): Promise<EntityChangeApprovalRevisionDbResult>;
  getApprovalRevision(
    workspace: string,
    id: string
  ): Promise<EntityChangeApprovalRevisionDbResult | null>;
  getLatestApprovalRevision(
    workspace: string,
    approvalId: string
  ): Promise<EntityChangeApprovalRevisionDbResult | null>;
  listApprovalRevisions(
    workspace: string,
    approvalId: string
  ): Promise<EntityChangeApprovalRevisionDbResult[]>;
  updateApprovalRevisionStatus(
    workspace: string,
    id: string,
    status: EntityChangeApprovalRevisionStatus,
    resolvedAt?: Date | null
  ): Promise<EntityChangeApprovalRevisionDbResult | null>;
  createBulkApprovalRevision(
    input: EntityChangeBulkApprovalRevisionDbCreate
  ): Promise<EntityChangeApprovalRevisionMemberDbResult[]>;
  getApprovalRevisionMembers(
    workspace: string,
    revisionId: string
  ): Promise<EntityChangeApprovalRevisionMemberDbResult[]>;
};
