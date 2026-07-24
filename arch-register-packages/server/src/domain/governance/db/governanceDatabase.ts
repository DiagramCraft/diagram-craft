import {
  databaseBoolean,
  databaseDate,
  parseDatabaseJson,
  type DatabaseRow
} from '../../../db/rowMappers';

export type GovernanceCaseStatus = 'open' | 'completed' | 'cancelled';

export type GovernanceAssignmentAction = 'approve' | 'acknowledge' | 'review' | 'remediate';

export type GovernanceAssignmentTargetType = 'user' | 'team' | 'team_role' | 'capability';

export type GovernanceAssignmentStatus = 'open' | 'completed' | 'superseded';

export type GovernanceEventType =
  | 'submitted'
  | 'assigned'
  | 'reassigned'
  | 'changes_requested'
  | 'resubmitted'
  | 'approved'
  | 'rejected'
  | 'acknowledged'
  | 'cancelled'
  | 'admin_override'
  | 'proposal_stale'
  | 'domain_effect_applied'
  | 'domain_effect_failed'
  | 'scope_refreshed'
  | 'postponed'
  | 'finalized'
  | 'finalization_override';

export type GovernanceCaseDbResult = {
  id: string;
  workspace: string;
  case_kind: string;
  subject_type: string;
  subject_id: string;
  subject_version: string | null;
  status: GovernanceCaseStatus;
  outcome: string | null;
  policy_version: string | null;
  initiator_user_id: string | null;
  parent_case_id: string | null;
  self_approval_allowed: boolean;
  payload: Record<string, unknown>;
  created_at: Date;
  due_at: Date | null;
  completed_at: Date | null;
  cancelled_at: Date | null;
};

export type GovernanceCaseDbCreate = {
  id: string;
  workspace: string;
  case_kind: string;
  subject_type: string;
  subject_id: string;
  subject_version: string | null;
  policy_version: string | null;
  initiator_user_id: string | null;
  parent_case_id: string | null;
  self_approval_allowed: boolean;
  payload: Record<string, unknown>;
  created_at: Date;
  due_at: Date | null;
};

export type GovernanceCaseDbUpdate = {
  status: GovernanceCaseStatus;
  outcome: string | null;
  completed_at: Date | null;
  cancelled_at: Date | null;
};

export type GovernanceAssignmentDbResult = {
  id: string;
  case_id: string;
  workspace: string;
  action: GovernanceAssignmentAction;
  target_type: GovernanceAssignmentTargetType;
  target_user_id: string | null;
  target_team_id: string | null;
  target_team_role: string | null;
  target_capability: string | null;
  status: GovernanceAssignmentStatus;
  created_at: Date;
  resolved_at: Date | null;
};

export type GovernanceAssignmentDbCreate = {
  id: string;
  case_id: string;
  workspace: string;
  action: GovernanceAssignmentAction;
  target_type: GovernanceAssignmentTargetType;
  target_user_id: string | null;
  target_team_id: string | null;
  target_team_role: string | null;
  target_capability: string | null;
  created_at: Date;
};

export type GovernanceEventDbResult = {
  id: string;
  case_id: string;
  workspace: string;
  event_type: GovernanceEventType;
  actor_user_id: string | null;
  occurred_at: Date;
  previous_status: string | null;
  resulting_status: string | null;
  reason: string | null;
  metadata: Record<string, unknown>;
};

export type GovernanceEventDbCreate = {
  id: string;
  case_id: string;
  workspace: string;
  event_type: GovernanceEventType;
  actor_user_id: string | null;
  occurred_at: Date;
  previous_status: string | null;
  resulting_status: string | null;
  reason: string | null;
  metadata: Record<string, unknown>;
};

export type GovernanceCaseListFilter = {
  caseKind?: string;
  status?: GovernanceCaseStatus;
  subjectType?: string;
  subjectId?: string;
  initiatorUserId?: string;
};

export const governanceMappers = {
  case: (row: DatabaseRow): GovernanceCaseDbResult => ({
    id: String(row['id']),
    workspace: String(row['workspace']),
    case_kind: String(row['case_kind']),
    subject_type: String(row['subject_type']),
    subject_id: String(row['subject_id']),
    subject_version: row['subject_version'] == null ? null : String(row['subject_version']),
    status: row['status'] as GovernanceCaseStatus,
    outcome: row['outcome'] == null ? null : String(row['outcome']),
    policy_version: row['policy_version'] == null ? null : String(row['policy_version']),
    initiator_user_id: row['initiator_user_id'] == null ? null : String(row['initiator_user_id']),
    parent_case_id: row['parent_case_id'] == null ? null : String(row['parent_case_id']),
    self_approval_allowed: databaseBoolean(row['self_approval_allowed']),
    payload: parseDatabaseJson(row['payload'], {}, 'payload'),
    created_at: databaseDate(row['created_at']),
    due_at: row['due_at'] == null ? null : databaseDate(row['due_at']),
    completed_at: row['completed_at'] == null ? null : databaseDate(row['completed_at']),
    cancelled_at: row['cancelled_at'] == null ? null : databaseDate(row['cancelled_at'])
  }),
  assignment: (row: DatabaseRow): GovernanceAssignmentDbResult => ({
    id: String(row['id']),
    case_id: String(row['case_id']),
    workspace: String(row['workspace']),
    action: row['action'] as GovernanceAssignmentAction,
    target_type: row['target_type'] as GovernanceAssignmentTargetType,
    target_user_id: row['target_user_id'] == null ? null : String(row['target_user_id']),
    target_team_id: row['target_team_id'] == null ? null : String(row['target_team_id']),
    target_team_role: row['target_team_role'] == null ? null : String(row['target_team_role']),
    target_capability: row['target_capability'] == null ? null : String(row['target_capability']),
    status: row['status'] as GovernanceAssignmentStatus,
    created_at: databaseDate(row['created_at']),
    resolved_at: row['resolved_at'] == null ? null : databaseDate(row['resolved_at'])
  }),
  event: (row: DatabaseRow): GovernanceEventDbResult => ({
    id: String(row['id']),
    case_id: String(row['case_id']),
    workspace: String(row['workspace']),
    event_type: row['event_type'] as GovernanceEventType,
    actor_user_id: row['actor_user_id'] == null ? null : String(row['actor_user_id']),
    occurred_at: databaseDate(row['occurred_at']),
    previous_status: row['previous_status'] == null ? null : String(row['previous_status']),
    resulting_status: row['resulting_status'] == null ? null : String(row['resulting_status']),
    reason: row['reason'] == null ? null : String(row['reason']),
    metadata: parseDatabaseJson(row['metadata'], {}, 'metadata')
  })
};

/**
 * Repository interface for governance cases, assignments, and event history.
 *
 * Callers coordinate transactions and eligibility; this interface only offers the
 * conditional-update primitives (`completeAssignmentIfOpen`, `completeCaseIfOpen`,
 * `cancelCaseIfOpen`) needed to make a decision idempotent and concurrency-safe.
 */
export type GovernanceDatabase = {
  createCase(input: GovernanceCaseDbCreate): Promise<GovernanceCaseDbResult>;
  getCase(workspace: string, id: string): Promise<GovernanceCaseDbResult | null>;
  listCases(
    workspace: string,
    filter?: GovernanceCaseListFilter
  ): Promise<GovernanceCaseDbResult[]>;
  updateCase(id: string, patch: GovernanceCaseDbUpdate): Promise<GovernanceCaseDbResult>;
  /** Conditional transition case status to 'completed'; returns null if the case was not open. */
  completeCaseIfOpen(
    id: string,
    outcome: string | null,
    completedAt: Date
  ): Promise<GovernanceCaseDbResult | null>;
  /** Conditional transition case status to 'cancelled'; returns null if the case was not open. */
  cancelCaseIfOpen(id: string, cancelledAt: Date): Promise<GovernanceCaseDbResult | null>;

  createAssignment(input: GovernanceAssignmentDbCreate): Promise<GovernanceAssignmentDbResult>;
  getAssignment(id: string): Promise<GovernanceAssignmentDbResult | null>;
  listAssignmentsForCase(caseId: string): Promise<GovernanceAssignmentDbResult[]>;
  listAssignments(workspace: string): Promise<GovernanceAssignmentDbResult[]>;
  /** All open assignments in a workspace; filtered by eligibility in the operations layer. */
  listOpenAssignments(workspace: string): Promise<GovernanceAssignmentDbResult[]>;
  /** Conditional transition assignment status to 'completed'; returns null if not open. */
  completeAssignmentIfOpen(
    id: string,
    resolvedAt: Date
  ): Promise<GovernanceAssignmentDbResult | null>;
  /**
   * Marks sibling open assignments for the same case+action superseded once one is decided.
   * Returns the ids of the assignments that were superseded, so callers can also resolve any
   * notifications tied to them.
   */
  supersedeOpenSiblingAssignments(
    caseId: string,
    action: GovernanceAssignmentAction,
    decidedAssignmentId: string,
    resolvedAt: Date
  ): Promise<string[]>;
  /**
   * Marks every open assignment for a case superseded, e.g. on cancellation. Returns the ids of
   * the assignments that were superseded, so callers can also resolve any notifications tied to
   * them.
   */
  supersedeAllOpenAssignmentsForCase(caseId: string, resolvedAt: Date): Promise<string[]>;

  appendEvent(input: GovernanceEventDbCreate): Promise<GovernanceEventDbResult>;
  listEvents(caseId: string): Promise<GovernanceEventDbResult[]>;

  /**
   * Looks up a previously recorded decision request for (assignment, idempotencyKey), if any.
   * Callers check this before mutating so a retried/duplicate request can return the original
   * event instead of re-applying the decision.
   */
  findDecisionRequest(
    assignmentId: string,
    idempotencyKey: string
  ): Promise<{ eventId: string } | null>;
  /**
   * Records a decision request under an idempotency key. Only ever called after
   * `completeAssignmentIfOpen` succeeded in the same transaction, so the (assignment,
   * idempotencyKey) pair is guaranteed not to exist yet — this is a plain insert.
   */
  recordDecisionRequest(
    assignmentId: string,
    idempotencyKey: string,
    eventId: string,
    createdAt: Date
  ): Promise<void>;
};
