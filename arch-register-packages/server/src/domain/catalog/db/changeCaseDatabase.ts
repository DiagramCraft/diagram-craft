import {
  databaseDate,
  databaseDateOnly,
  parseDatabaseJson,
  type DatabaseRow
} from '../../../db/rowMappers';

export type ChangeCaseStatus =
  | 'planned'
  | 'in_approval'
  | 'applied'
  | 'rejected'
  | 'withdrawn'
  | 'cancelled'
  | 'superseded';

export type ChangeCaseRevisionStatus =
  | 'draft'
  | 'submitted'
  | 'changes_requested'
  | 'stale'
  | 'applied'
  | 'rejected'
  | 'withdrawn'
  | 'superseded';

export type ChangeCaseDbResult = {
  id: string;
  workspace: string;
  project_id: string | null;
  status: ChangeCaseStatus;
  purpose: 'planned_change' | 'requested_change';
  name: string | null;
  description: string | null;
  effective_date: string | null;
  milestone_id: string | null;
  initiator_user_id: string | null;
  created_at: Date;
  updated_at: Date;
  closed_at: Date | null;
};

export type ChangeCaseRevisionDbResult = {
  id: string;
  case_id: string;
  workspace: string;
  revision_number: number;
  message: string | null;
  created_by: string | null;
  status: ChangeCaseRevisionStatus;
  is_active: boolean;
  created_at: Date;
  resolved_at: Date | null;
};

export type ChangeCaseMemberDbResult = {
  id: string;
  revision_id: string;
  workspace: string;
  entity_id: string;
  base_version: number;
  base_state: Record<string, unknown>;
  proposed_state: Record<string, unknown>;
  diff: Record<string, unknown>;
  applied_version_id: string | null;
};

export type ChangeCaseMemberInput = {
  entity_id: string;
  base_version: number;
  base_state: Record<string, unknown>;
  proposed_state: Record<string, unknown>;
  diff: Record<string, unknown>;
};

export type ChangeCaseDbCreate = {
  id: string;
  workspace: string;
  project_id: string;
  name: string | null;
  description: string | null;
  effective_date: string | null;
  milestone_id: string | null;
  message: string | null;
  created_by: string | null;
  created_at: Date;
  members: ChangeCaseMemberInput[];
};

export const changeCaseMappers = {
  case: (row: DatabaseRow): ChangeCaseDbResult => ({
    id: String(row['id']),
    workspace: String(row['workspace']),
    project_id: row['project_id'] == null ? null : String(row['project_id']),
    status: row['status'] as ChangeCaseStatus,
    purpose: row['purpose'] as 'planned_change' | 'requested_change',
    name: row['name'] == null ? null : String(row['name']),
    description: row['description'] == null ? null : String(row['description']),
    effective_date: row['effective_date'] == null ? null : databaseDateOnly(row['effective_date']),
    milestone_id: row['milestone_id'] == null ? null : String(row['milestone_id']),
    initiator_user_id: row['initiator_user_id'] == null ? null : String(row['initiator_user_id']),
    created_at: databaseDate(row['created_at']),
    updated_at: databaseDate(row['updated_at']),
    closed_at: row['closed_at'] == null ? null : databaseDate(row['closed_at'])
  }),
  revision: (row: DatabaseRow): ChangeCaseRevisionDbResult => ({
    id: String(row['id']),
    case_id: String(row['case_id']),
    workspace: String(row['workspace']),
    revision_number: Number(row['revision_number']),
    message: row['message'] == null ? null : String(row['message']),
    created_by: row['created_by'] == null ? null : String(row['created_by']),
    status: row['status'] as ChangeCaseRevisionStatus,
    is_active: row['is_active'] === true || row['is_active'] === 1,
    created_at: databaseDate(row['created_at']),
    resolved_at: row['resolved_at'] == null ? null : databaseDate(row['resolved_at'])
  }),
  member: (row: DatabaseRow): ChangeCaseMemberDbResult => ({
    id: String(row['id']),
    revision_id: String(row['revision_id']),
    workspace: String(row['workspace']),
    entity_id: String(row['entity_id']),
    base_version: Number(row['base_version']),
    base_state: parseDatabaseJson(
      row['base_state'],
      {},
      'entity_change_case_entity_version.base_state'
    ),
    proposed_state: parseDatabaseJson(
      row['proposed_state'],
      {},
      'entity_change_case_entity_version.proposed_state'
    ),
    diff: parseDatabaseJson(row['diff'], {}, 'entity_change_case_entity_version.diff'),
    applied_version_id: row['applied_version_id'] == null ? null : String(row['applied_version_id'])
  })
};

export type ChangeCaseDatabase = {
  createCase(input: ChangeCaseDbCreate): Promise<ChangeCaseDbResult>;
  getCase(workspace: string, caseId: string): Promise<ChangeCaseDbResult | null>;
  listCasesByProject(workspace: string, projectId: string): Promise<ChangeCaseDbResult[]>;
  listCasesByEntity(workspace: string, entityId: string): Promise<ChangeCaseDbResult[]>;
  getActiveRevision(workspace: string, caseId: string): Promise<ChangeCaseRevisionDbResult | null>;
  getLatestRevision(workspace: string, caseId: string): Promise<ChangeCaseRevisionDbResult | null>;
  listMembers(workspace: string, revisionId: string): Promise<ChangeCaseMemberDbResult[]>;
  addMember(
    workspace: string,
    revisionId: string,
    member: ChangeCaseMemberInput
  ): Promise<ChangeCaseMemberDbResult>;
  removeMember(workspace: string, memberId: string): Promise<ChangeCaseMemberDbResult | null>;
  updateMemberProposedState(
    workspace: string,
    memberId: string,
    proposedState: Record<string, unknown>,
    diff: Record<string, unknown>
  ): Promise<ChangeCaseMemberDbResult | null>;
  updateCaseFields(
    workspace: string,
    caseId: string,
    updates: {
      name?: string;
      target_date?: string | null;
      milestone_id?: string | null;
      message?: string | null;
    }
  ): Promise<ChangeCaseDbResult | null>;
  markMemberApplied(workspace: string, memberId: string, appliedVersionId: string): Promise<void>;
  markRevisionApplied(workspace: string, revisionId: string, resolvedAt: Date): Promise<void>;
  markCaseApplied(workspace: string, caseId: string, closedAt: Date): Promise<void>;
  withdrawCase(workspace: string, caseId: string): Promise<ChangeCaseDbResult | null>;
  // Hard-deletes a still-planned case (and its revisions/members via cascade). Returns null if the
  // case doesn't exist or has already left the 'planned' status (use withdrawCase instead once a
  // case has moved past planning).
  deleteCase(workspace: string, caseId: string): Promise<ChangeCaseDbResult | null>;
};
