import { randomUUID } from 'node:crypto';
import { DatabaseError, type DatabaseAdapter } from '../../db/database';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { HTTPError } from 'h3';
import { requireWorkspaceCapability } from '../auth/authorization';
import { runAuthorizedOperation } from '../operation';
import { httpAssert } from '../../utils/httpAssert';
import type {
  AuthorizationContext,
  TeamRole,
  WorkspaceCapability,
  WorkspaceAuthorizationContext
} from '@arch-register/permissions';
import type {
  GovernanceAssignmentAction,
  GovernanceAssignmentDbCreate,
  GovernanceAssignmentDbResult,
  GovernanceCaseDbResult,
  GovernanceCaseListFilter,
  GovernanceEventDbResult,
  GovernanceEventType
} from './db/governanceDatabase';
import { isEligibleForAssignment, resolveAssignmentEligibility } from './governanceEligibility';
import {
  createGovernanceRegistry,
  type GovernanceRedactionMode,
  type GovernanceRegistry
} from './governanceRegistry';
import { createGovernanceInAppNotifications } from './governanceNotifications';
import { enqueueGovernanceWebhookDeliveries } from '../webhook/webhookDelivery';
import { resolveGovernanceWorkflowConfig } from './governanceWorkflowConfig';
import { resolveGovernanceInitiationFields } from './governanceInitiationFields';
import type {
  GovernanceAssignment,
  GovernanceCase,
  GovernanceDecisionAction,
  GovernanceEvent,
  GovernanceSubmission,
  GovernanceTask,
  ListGovernanceSubmissionsQuery,
  ListGovernanceTasksQuery,
  ListGovernanceCasesQuery
} from '@arch-register/api-types/governanceContract';

// One decision closes the whole case in this foundation. Group acknowledgement (multiple
// independent tasks per case) is deferred to whichever domain needs it (see #1718) rather than
// generalized here.
const CASE_COMPLETING_DECISIONS = new Set<GovernanceDecisionAction>([
  'approve',
  'reject',
  'request_changes',
  'acknowledge'
]);

const DECISION_EVENT_TYPES: Record<GovernanceDecisionAction, GovernanceEventType> = {
  approve: 'approved',
  reject: 'rejected',
  request_changes: 'changes_requested',
  acknowledge: 'acknowledged'
};

export type GovernanceAssignmentTarget =
  | { type: 'user'; userId: string }
  | { type: 'team'; teamId: string }
  | { type: 'team_role'; teamId: string; teamRole: TeamRole }
  | { type: 'capability'; capability: WorkspaceCapability };

/**
 * #2420's default escalation target: for a project-scoped case, the admins of the project's
 * owning team (there's no distinct "project admin" role — project-admin authority is the
 * `team_admin` TeamRole on the owning team); otherwise the workspace's `ws.settings` holders
 * (owner/admin roles), used as the "workspace admin" proxy since there's no single ws.admin
 * capability. Case kinds call this with whatever project id they know how to extract from their
 * own case row/payload — there's no generic way to derive it, since case subjects vary by kind.
 */
export const resolveScopeAwareEscalationTarget = async (
  db: DatabaseAdapter,
  workspace: string,
  projectId: string | null
): Promise<GovernanceAssignmentTarget> => {
  if (projectId) {
    const project = await db.project.projects.getProject(workspace, projectId);
    if (project?.owner) {
      return { type: 'team_role', teamId: project.owner, teamRole: 'team_admin' };
    }
  }
  return { type: 'capability', capability: 'ws.settings' };
};

export type GovernanceAssignmentSpec = {
  action: GovernanceAssignmentAction;
  target: GovernanceAssignmentTarget;
};

export type CreateGovernanceCaseInput = {
  caseKind: string;
  caseSubkind?: string | null;
  dedupeKey?: string | null;
  subjectType: string;
  subjectId: string;
  subjectVersion?: string | null;
  policyVersion?: string | null;
  selfApprovalAllowed?: boolean;
  dueAt?: Date | null;
  payload?: Record<string, unknown>;
  assignments: GovernanceAssignmentSpec[];
  allowEmptyAssignments?: boolean;
  createAssignmentsInExternalMode?: boolean;
  initiationFieldValues?: Record<string, unknown>;
  skipInitiationFields?: boolean;
  governanceRegistry?: GovernanceRegistry;
};

export type DecideGovernanceAssignmentInput = {
  decision: GovernanceDecisionAction;
  reason?: string | null;
  idempotencyKey: string;
};

export type GovernanceDecisionOptions = {
  externalIntegration?: boolean;
};

export const toApiCase = (
  row: GovernanceCaseDbResult,
  payload: Record<string, unknown> = row.payload
): GovernanceCase => ({
  id: row.id,
  workspace: row.workspace,
  caseKind: row.case_kind,
  subjectType: row.subject_type,
  subjectId: row.subject_id,
  subjectVersion: row.subject_version,
  status: row.status,
  outcome: row.outcome,
  policyVersion: row.policy_version,
  initiatorUserId: row.initiator_user_id,
  parentCaseId: row.parent_case_id,
  selfApprovalAllowed: row.self_approval_allowed,
  payload,
  createdAt: row.created_at.toISOString(),
  dueAt: row.due_at?.toISOString() ?? null,
  completedAt: row.completed_at?.toISOString() ?? null,
  cancelledAt: row.cancelled_at?.toISOString() ?? null,
  escalatedAt: row.escalated_at?.toISOString() ?? null,
  initiationFields: row.initiation_fields ?? []
});

export const toApiCaseForContext = async (
  db: DatabaseAdapter,
  row: GovernanceCaseDbResult,
  authCtx: WorkspaceAuthorizationContext | null,
  registry: GovernanceRegistry,
  mode: GovernanceRedactionMode = 'api'
): Promise<GovernanceCase> => {
  const config = registry.get(row.case_kind);
  const payload = config?.redactCasePayload
    ? await config.redactCasePayload({ db, authCtx, caseRow: row, mode })
    : row.payload;
  return toApiCase(row, payload);
};

export const toApiAssignment = (row: GovernanceAssignmentDbResult): GovernanceAssignment => ({
  id: row.id,
  caseId: row.case_id,
  action: row.action,
  targetType: row.target_type,
  targetUserId: row.target_user_id,
  targetTeamId: row.target_team_id,
  targetTeamRole: row.target_team_role,
  targetCapability: row.target_capability,
  status: row.status,
  createdAt: row.created_at.toISOString(),
  resolvedAt: row.resolved_at?.toISOString() ?? null
});

export const toApiEvent = (
  row: GovernanceEventDbResult,
  metadata: Record<string, unknown> = row.metadata
): GovernanceEvent => ({
  id: row.id,
  caseId: row.case_id,
  eventType: row.event_type,
  actorUserId: row.actor_user_id,
  occurredAt: row.occurred_at.toISOString(),
  previousStatus: row.previous_status,
  resultingStatus: row.resulting_status,
  reason: row.reason,
  metadata
});

export const toApiEventForContext = async (
  db: DatabaseAdapter,
  caseRow: GovernanceCaseDbResult,
  row: GovernanceEventDbResult,
  authCtx: WorkspaceAuthorizationContext | null,
  registry: GovernanceRegistry,
  mode: GovernanceRedactionMode = 'api'
): Promise<GovernanceEvent> => {
  const config = registry.get(caseRow.case_kind);
  const metadata = config?.redactEventMetadata
    ? await config.redactEventMetadata({ db, authCtx, caseRow, event: row, mode })
    : row.metadata;
  return toApiEvent(row, metadata);
};

const toAssignmentCreate = (
  caseId: string,
  workspace: string,
  now: Date,
  spec: GovernanceAssignmentSpec
): GovernanceAssignmentDbCreate => ({
  id: randomUUID(),
  case_id: caseId,
  workspace,
  action: spec.action,
  target_type: spec.target.type,
  target_user_id: spec.target.type === 'user' ? spec.target.userId : null,
  target_team_id:
    spec.target.type === 'team' || spec.target.type === 'team_role' ? spec.target.teamId : null,
  target_team_role: spec.target.type === 'team_role' ? spec.target.teamRole : null,
  target_capability: spec.target.type === 'capability' ? spec.target.capability : null,
  created_at: now
});

/**
 * Appends a governance event and creates its in-app notifications in the same transaction.
 * External notification channels are intentionally deferred to asynchronous delivery (#2211).
 */
export const recordGovernanceEvent = async (
  tx: DatabaseAdapter,
  caseRow: GovernanceCaseDbResult,
  input: {
    eventType: GovernanceEventType;
    actorUserId: string | null;
    previousStatus: string | null;
    resultingStatus: string | null;
    reason: string | null;
    metadata: Record<string, unknown>;
  },
  registry: GovernanceRegistry = createGovernanceRegistry()
): Promise<GovernanceEventDbResult> => {
  const event = await tx.governance.appendEvent({
    id: randomUUID(),
    case_id: caseRow.id,
    workspace: caseRow.workspace,
    event_type: input.eventType,
    actor_user_id: input.actorUserId,
    occurred_at: new Date(),
    previous_status: input.previousStatus,
    resulting_status: input.resultingStatus,
    reason: input.reason,
    metadata: input.metadata
  });

  const configAdapter = (
    tx as unknown as {
      governanceCaseConfig?: { listCaseConfigForKind?: unknown };
    }
  ).governanceCaseConfig;
  const configRows =
    typeof configAdapter?.listCaseConfigForKind === 'function'
      ? await tx.governanceCaseConfig.listCaseConfigForKind(caseRow.workspace, caseRow.case_kind)
      : [];
  const external =
    resolveGovernanceWorkflowConfig(configRows, caseRow.case_subkind, { extensions: {} }, true)
      .config.external === true;
  if (!external) await createGovernanceInAppNotifications(tx, caseRow, event);

  const webhookAdapter = (tx as unknown as { webhook?: { listWebhooks?: unknown } }).webhook;
  if (typeof webhookAdapter?.listWebhooks === 'function') {
    await enqueueGovernanceWebhookDeliveries(tx, caseRow, event, external, registry);
  }

  return event;
};

/**
 * Marks any unread notifications tied to the given (now resolved) assignments as read, so a
 * user's notification clears the moment their action item is decided or superseded, rather than
 * only when they happen to open the bell and click it themselves.
 */
export const resolveAssignmentNotifications = async (
  tx: DatabaseAdapter,
  assignmentIds: string[],
  resolvedAt: Date
): Promise<void> => {
  if (assignmentIds.length === 0) return;
  await tx.notification.markReadByAssignmentIds(assignmentIds, resolvedAt);
};

/**
 * Marks any unread notifications tied to the given (now completed or cancelled) governance case
 * as read. Informational notifications (assigned, approved, rejected, etc.) carry a case_id but
 * no assignment_id, so `resolveAssignmentNotifications` never reaches them — without this, they
 * pile up unread for the life of the case even after every assignment is decided.
 */
export const resolveCaseNotifications = async (
  tx: DatabaseAdapter,
  caseId: string,
  resolvedAt: Date
): Promise<void> => {
  await tx.notification.markReadByCaseIds([caseId], resolvedAt);
};

/**
 * A case is visible if the current user opened it, is eligible for one of its assignments, or
 * the owning case kind explicitly says the subject is visible to them. Defaults to invisible so
 * a case never leaks the existence of a subject the user otherwise cannot see.
 */
export const isGovernanceCaseVisible = async (
  db: DatabaseAdapter,
  authCtx: AuthorizationContext,
  userId: string,
  caseRow: GovernanceCaseDbResult,
  assignments: GovernanceAssignmentDbResult[],
  registry: GovernanceRegistry
): Promise<boolean> => {
  const config = registry.get(caseRow.case_kind);
  if (config?.caseVisible && !(await config.caseVisible(db, authCtx, caseRow))) return false;
  if (caseRow.initiator_user_id === userId) return true;
  if (assignments.some(assignment => isEligibleForAssignment(authCtx, userId, assignment))) {
    return true;
  }
  if (config?.subjectVisible) {
    return config.subjectVisible(db, authCtx, caseRow.workspace, caseRow.subject_id);
  }
  return false;
};

export const createGovernanceCase = async (
  db: DatabaseAdapter,
  workspace: string,
  event: AuthenticatedEvent,
  input: CreateGovernanceCaseInput
): Promise<GovernanceCase> => {
  return runAuthorizedOperation({
    db,
    event,
    scope: { kind: 'workspace', workspace },
    operation: async ({ ws, authCtx }) => {
      requireWorkspaceCapability(authCtx, 'ws.view');
      httpAssert.true(input.assignments.length > 0 || input.allowEmptyAssignments === true, {
        status: 400,
        statusText: 'Bad Request',
        message: 'A governance case requires at least one assignment'
      });

      const userId = event.context.user.id;
      const now = new Date();
      const caseId = randomUUID();

      const created = await db.core.transaction(async tx =>
        createGovernanceCaseInTransaction(tx, ws, userId, input, now, caseId)
      );

      return toApiCaseForContext(
        db,
        created,
        authCtx,
        input.governanceRegistry ?? createGovernanceRegistry()
      );
    }
  });
};

export const createGovernanceCaseInTransaction = async (
  tx: DatabaseAdapter,
  workspace: string,
  initiatorUserId: string | null,
  input: CreateGovernanceCaseInput,
  now = new Date(),
  caseId = randomUUID()
): Promise<GovernanceCaseDbResult> => {
  httpAssert.true(input.assignments.length > 0 || input.allowEmptyAssignments === true, {
    status: 400,
    statusText: 'Bad Request',
    message: 'A governance case requires at least one assignment'
  });

  const configAdapter = (
    tx as unknown as {
      governanceCaseConfig?: { listCaseConfigForKind?: unknown };
    }
  ).governanceCaseConfig;
  const configRows =
    typeof configAdapter?.listCaseConfigForKind === 'function'
      ? await tx.governanceCaseConfig.listCaseConfigForKind(workspace, input.caseKind)
      : [];
  const external =
    resolveGovernanceWorkflowConfig(configRows, input.caseSubkind ?? null, { extensions: {} }, true)
      .config.external === true;
  const assignments =
    external && input.createAssignmentsInExternalMode !== true ? [] : input.assignments;
  const initiationFields = input.skipInitiationFields
    ? []
    : await resolveGovernanceInitiationFields(
        tx,
        workspace,
        resolveGovernanceWorkflowConfig(
          configRows,
          input.caseSubkind ?? null,
          { extensions: {} },
          true
        ).config,
        input.initiationFieldValues
      );

  const createdCase = await tx.governance.createCase({
    id: caseId,
    workspace,
    case_kind: input.caseKind,
    case_subkind: input.caseSubkind ?? null,
    subject_type: input.subjectType,
    subject_id: input.subjectId,
    subject_version: input.subjectVersion ?? null,
    dedupe_key: input.dedupeKey ?? null,
    policy_version: input.policyVersion ?? null,
    initiator_user_id: initiatorUserId,
    parent_case_id: null,
    self_approval_allowed: input.selfApprovalAllowed ?? false,
    payload: input.payload ?? {},
    initiation_fields: initiationFields,
    created_at: now,
    due_at: input.dueAt ?? null
  });

  for (const spec of assignments) {
    await tx.governance.createAssignment(toAssignmentCreate(caseId, workspace, now, spec));
  }

  await recordGovernanceEvent(
    tx,
    createdCase,
    {
      eventType: 'submitted',
      actorUserId: initiatorUserId,
      previousStatus: null,
      resultingStatus: 'open',
      reason: null,
      metadata: {}
    },
    input.governanceRegistry
  );

  return createdCase;
};

const getGovernanceCaseForContext = async (
  db: DatabaseAdapter,
  ws: string,
  caseId: string,
  event: AuthenticatedEvent,
  authCtx: AuthorizationContext,
  registry: GovernanceRegistry = createGovernanceRegistry()
): Promise<GovernanceCase> => {
  requireWorkspaceCapability(authCtx, 'ws.view');

  const notFound = { status: 404, message: `Governance case '${caseId}' not found` };
  const caseRow = await db.governance.getCase(ws, caseId);
  httpAssert.present(caseRow, notFound);

  const assignments = await db.governance.listAssignmentsForCase(caseRow.id);
  const userId = event.context.user.id;
  const visible = await isGovernanceCaseVisible(
    db,
    authCtx,
    userId,
    caseRow,
    assignments,
    registry
  );
  httpAssert.true(visible, notFound);

  return toApiCaseForContext(db, caseRow, authCtx, registry);
};

export const getGovernanceCase = async (
  db: DatabaseAdapter,
  workspace: string,
  caseId: string,
  event: AuthenticatedEvent,
  registry: GovernanceRegistry = createGovernanceRegistry()
): Promise<GovernanceCase> =>
  runAuthorizedOperation({
    db,
    event,
    scope: { kind: 'entity', workspace },
    operation: ({ ws, authCtx }) =>
      getGovernanceCaseForContext(db, ws, caseId, event, authCtx, registry)
  });

const listGovernanceCasesForContext = async (
  db: DatabaseAdapter,
  ws: string,
  event: AuthenticatedEvent,
  authCtx: AuthorizationContext,
  query: ListGovernanceCasesQuery,
  registry: GovernanceRegistry = createGovernanceRegistry()
): Promise<GovernanceCase[]> => {
  requireWorkspaceCapability(authCtx, 'ws.view');

  const filter: GovernanceCaseListFilter = {
    caseKind: query.caseKind,
    status: query.status,
    subjectType: query.subjectType,
    subjectId: query.subjectId
  };
  const cases = await db.governance.listCases(ws, filter);
  const userId = event.context.user.id;

  const visible = await Promise.all(
    cases.map(async caseRow => {
      const assignments = await db.governance.listAssignmentsForCase(caseRow.id);
      const ok = await isGovernanceCaseVisible(db, authCtx, userId, caseRow, assignments, registry);
      return ok ? caseRow : null;
    })
  );

  return Promise.all(
    visible
      .filter((row): row is GovernanceCaseDbResult => row != null)
      .map(row => toApiCaseForContext(db, row, authCtx, registry))
  );
};

export const listGovernanceCases = async (
  db: DatabaseAdapter,
  workspace: string,
  event: AuthenticatedEvent,
  query: ListGovernanceCasesQuery,
  registry: GovernanceRegistry = createGovernanceRegistry()
): Promise<GovernanceCase[]> =>
  runAuthorizedOperation({
    db,
    event,
    scope: { kind: 'entity', workspace },
    operation: ({ ws, authCtx }) =>
      listGovernanceCasesForContext(db, ws, event, authCtx, query, registry)
  });

/**
 * Lists governance cases the current user initiated, along with each case's still-open
 * assignments — i.e. what the case is currently waiting on. Unlike `listGovernanceCases`,
 * this is scoped to the initiator regardless of `selfApprovalAllowed`, so a requestor can
 * always find their own submissions without needing approval rights.
 */
const listMySubmittedGovernanceCasesForContext = async (
  db: DatabaseAdapter,
  ws: string,
  event: AuthenticatedEvent,
  authCtx: WorkspaceAuthorizationContext,
  query: ListGovernanceSubmissionsQuery,
  registry: GovernanceRegistry = createGovernanceRegistry()
): Promise<GovernanceSubmission[]> => {
  requireWorkspaceCapability(authCtx, 'ws.view');

  const userId = event.context.user.id;
  const filter: GovernanceCaseListFilter = {
    caseKind: query.caseKind,
    status: query.status,
    initiatorUserId: userId
  };
  const cases = await db.governance.listCases(ws, filter);

  const submissions = await Promise.all(
    cases.map(async caseRow => {
      const assignments = await db.governance.listAssignmentsForCase(caseRow.id);
      return {
        case: await toApiCaseForContext(db, caseRow, authCtx, registry),
        openAssignments: assignments
          .filter(assignment => assignment.status === 'open')
          .map(toApiAssignment)
      };
    })
  );

  return submissions;
};

export const listMySubmittedGovernanceCases = async (
  db: DatabaseAdapter,
  workspace: string,
  event: AuthenticatedEvent,
  query: ListGovernanceSubmissionsQuery,
  registry: GovernanceRegistry = createGovernanceRegistry()
): Promise<GovernanceSubmission[]> =>
  runAuthorizedOperation({
    db,
    event,
    scope: { kind: 'workspace', workspace },
    operation: ({ ws, authCtx }) =>
      listMySubmittedGovernanceCasesForContext(db, ws, event, authCtx, query, registry)
  });

const listGovernanceCaseEventsForContext = async (
  db: DatabaseAdapter,
  ws: string,
  caseId: string,
  event: AuthenticatedEvent,
  authCtx: AuthorizationContext,
  registry: GovernanceRegistry = createGovernanceRegistry()
): Promise<GovernanceEvent[]> => {
  requireWorkspaceCapability(authCtx, 'ws.view');

  const notFound = { status: 404, message: `Governance case '${caseId}' not found` };
  const caseRow = await db.governance.getCase(ws, caseId);
  httpAssert.present(caseRow, notFound);

  const assignments = await db.governance.listAssignmentsForCase(caseRow.id);
  const userId = event.context.user.id;
  const visible = await isGovernanceCaseVisible(
    db,
    authCtx,
    userId,
    caseRow,
    assignments,
    registry
  );
  httpAssert.true(visible, notFound);

  const events = await db.governance.listEvents(caseRow.id);
  return Promise.all(
    events.map(eventRow => toApiEventForContext(db, caseRow, eventRow, authCtx, registry))
  );
};

export const listGovernanceCaseEvents = async (
  db: DatabaseAdapter,
  workspace: string,
  caseId: string,
  event: AuthenticatedEvent,
  registry: GovernanceRegistry = createGovernanceRegistry()
): Promise<GovernanceEvent[]> =>
  runAuthorizedOperation({
    db,
    event,
    scope: { kind: 'entity', workspace },
    operation: ({ ws, authCtx }) =>
      listGovernanceCaseEventsForContext(db, ws, caseId, event, authCtx, registry)
  });

const listMyGovernanceAssignmentsForContext = async (
  db: DatabaseAdapter,
  ws: string,
  event: AuthenticatedEvent,
  authCtx: AuthorizationContext,
  query: ListGovernanceTasksQuery = {},
  registry: GovernanceRegistry = createGovernanceRegistry()
): Promise<GovernanceTask[]> => {
  requireWorkspaceCapability(authCtx, 'ws.view');

  const userId = event.context.user.id;
  const assignments = await db.governance.listAssignments(ws);
  const dueBefore = query.dueBefore ? Date.parse(query.dueBefore) : null;
  const dueAfter = query.dueAfter ? Date.parse(query.dueAfter) : null;
  const tasks = await Promise.all(
    assignments.map(async assignment => {
      const caseRow = await db.governance.getCase(ws, assignment.case_id);
      if (!caseRow) return null;
      if (query.caseKind && caseRow.case_kind !== query.caseKind) return null;
      if (query.taskKind && assignment.action !== query.taskKind) return null;
      if (dueBefore != null && (caseRow.due_at == null || caseRow.due_at.getTime() > dueBefore)) {
        return null;
      }
      if (dueAfter != null && (caseRow.due_at == null || caseRow.due_at.getTime() < dueAfter)) {
        return null;
      }

      const state =
        caseRow.status === 'cancelled'
          ? 'cancelled'
          : caseRow.status === 'completed' &&
              (assignment.status === 'completed' || assignment.status === 'superseded')
            ? 'completed'
            : assignment.status;
      if (query.state && state !== query.state) return null;
      if (!query.state && state !== 'open') return null;
      if (caseRow.initiator_user_id === userId && !caseRow.self_approval_allowed) return null;

      const currentlyEligible = isEligibleForAssignment(authCtx, userId, assignment);
      const caseEvents = state === 'open' ? [] : await db.governance.listEvents(caseRow.id);
      const actedOnAssignment = caseEvents.some(
        candidate =>
          candidate.actor_user_id === userId && candidate.metadata['assignmentId'] === assignment.id
      );
      if (!currentlyEligible && !actedOnAssignment) return null;

      const visible = await isGovernanceCaseVisible(
        db,
        authCtx,
        userId,
        caseRow,
        [assignment],
        registry
      );
      if (!visible) return null;

      const config = registry.get(caseRow.case_kind);
      const isIndependentAssignment =
        config?.independentAssignmentActions?.has(assignment.action) ?? false;

      return {
        assignment: toApiAssignment(assignment),
        case: await toApiCaseForContext(db, caseRow, authCtx, registry),
        requiresAction: state === 'open' && currentlyEligible,
        dedupeKey: isIndependentAssignment
          ? `assignment:${assignment.id}`
          : `case:${caseRow.id}:${assignment.action}`
      };
    })
  );

  // A case can carry multiple non-independent assignments for the same action (e.g. one
  // targeting the owning team's admins, another targeting a workspace-wide capability) so that
  // either path can decide it. A user eligible via more than one of those sees the same case
  // only once here; deciding it still resolves all sibling assignments (see
  // `supersedeOpenSiblingAssignments` in `decideGovernanceAssignment`).
  const deduped = new Map<string, GovernanceTask>();
  for (const task of tasks) {
    if (task == null) continue;
    const existing = deduped.get(task.dedupeKey);
    if (!existing || (task.requiresAction && !existing.requiresAction)) {
      deduped.set(task.dedupeKey, task);
    }
  }

  return [...deduped.values()].sort(
    (a, b) => Date.parse(a.case.createdAt) - Date.parse(b.case.createdAt)
  );
};

export const listMyGovernanceAssignments = async (
  db: DatabaseAdapter,
  workspace: string,
  event: AuthenticatedEvent,
  query: ListGovernanceTasksQuery = {},
  registry: GovernanceRegistry = createGovernanceRegistry()
): Promise<GovernanceTask[]> =>
  runAuthorizedOperation({
    db,
    event,
    scope: { kind: 'entity', workspace },
    operation: ({ ws, authCtx }) =>
      listMyGovernanceAssignmentsForContext(db, ws, event, authCtx, query, registry)
  });

export const countMyGovernanceAssignments = async (
  db: DatabaseAdapter,
  workspace: string,
  event: AuthenticatedEvent,
  registry: GovernanceRegistry = createGovernanceRegistry()
) => {
  const tasks = await listMyGovernanceAssignments(
    db,
    workspace,
    event,
    { state: 'open' },
    registry
  );
  return { count: tasks.length };
};

const cancelGovernanceCaseForContext = async (
  db: DatabaseAdapter,
  ws: string,
  caseId: string,
  event: AuthenticatedEvent,
  authCtx: AuthorizationContext,
  input: { reason?: string | null },
  registry: GovernanceRegistry = createGovernanceRegistry()
): Promise<GovernanceCase> => {
  requireWorkspaceCapability(authCtx, 'ws.view');

  const notFound = { status: 404, message: `Governance case '${caseId}' not found` };
  const caseRow = await db.governance.getCase(ws, caseId);
  httpAssert.present(caseRow, notFound);

  const assignments = await db.governance.listAssignmentsForCase(caseRow.id);
  const userId = event.context.user.id;
  const visible = await isGovernanceCaseVisible(
    db,
    authCtx,
    userId,
    caseRow,
    assignments,
    registry
  );
  httpAssert.true(visible, notFound);

  httpAssert.true(caseRow.initiator_user_id === userId, {
    status: 403,
    statusText: 'Forbidden',
    message: 'Only the case initiator can withdraw a governance case'
  });

  const now = new Date();
  const cancelled = await db.core.transaction(async tx => {
    const updated = await tx.governance.cancelCaseIfOpen(caseRow.id, now);
    httpAssert.present(updated, {
      status: 409,
      statusText: 'Conflict',
      message: 'Only open cases can be cancelled'
    });
    const supersededIds = await tx.governance.supersedeAllOpenAssignmentsForCase(caseRow.id, now);
    await resolveAssignmentNotifications(tx, supersededIds, now);
    await resolveCaseNotifications(tx, updated.id, now);
    await recordGovernanceEvent(
      tx,
      updated,
      {
        eventType: 'cancelled',
        actorUserId: userId,
        previousStatus: 'open',
        resultingStatus: 'cancelled',
        reason: input.reason ?? null,
        metadata: {}
      },
      registry
    );
    return updated;
  });

  return toApiCaseForContext(db, cancelled, authCtx, registry);
};

export const cancelGovernanceCase = async (
  db: DatabaseAdapter,
  workspace: string,
  caseId: string,
  event: AuthenticatedEvent,
  input: { reason?: string | null },
  registry: GovernanceRegistry = createGovernanceRegistry()
): Promise<GovernanceCase> =>
  runAuthorizedOperation({
    db,
    event,
    scope: { kind: 'entity', workspace },
    operation: ({ ws, authCtx }) =>
      cancelGovernanceCaseForContext(db, ws, caseId, event, authCtx, input, registry)
  });

// Basic anti-spam guard on manual reminders; #2418's scheduled scan is not subject to this since
// it already tracks per-window "already reminded" state independently.
const REMINDER_COOLDOWN_MS = 4 * 60 * 60 * 1000;

const sendGovernanceCaseReminderForContext = async (
  db: DatabaseAdapter,
  ws: string,
  caseId: string,
  event: AuthenticatedEvent,
  authCtx: AuthorizationContext,
  registry: GovernanceRegistry = createGovernanceRegistry()
): Promise<{ case: GovernanceCase; event: GovernanceEvent }> => {
  requireWorkspaceCapability(authCtx, 'ws.view');

  const notFound = { status: 404, message: `Governance case '${caseId}' not found` };
  const caseRow = await db.governance.getCase(ws, caseId);
  httpAssert.present(caseRow, notFound);

  const assignments = await db.governance.listAssignmentsForCase(caseRow.id);
  const userId = event.context.user.id;
  const visible = await isGovernanceCaseVisible(
    db,
    authCtx,
    userId,
    caseRow,
    assignments,
    registry
  );
  httpAssert.true(visible, notFound);

  httpAssert.true(caseRow.initiator_user_id === userId, {
    status: 403,
    statusText: 'Forbidden',
    message: 'Only the case initiator can send a reminder for this case'
  });

  httpAssert.true(caseRow.status === 'open', {
    status: 409,
    statusText: 'Conflict',
    message: 'Only open cases can be reminded'
  });

  const openAssignments = assignments.filter(assignment => assignment.status === 'open');
  httpAssert.true(openAssignments.length > 0, {
    status: 409,
    statusText: 'Conflict',
    message: 'Nothing is outstanding on this case'
  });

  const events = await db.governance.listEvents(caseRow.id);
  const lastReminder = events
    .filter(candidate => candidate.event_type === 'reminder_sent')
    .sort((a, b) => b.occurred_at.getTime() - a.occurred_at.getTime())[0];
  if (lastReminder) {
    const nextAllowedAt = new Date(lastReminder.occurred_at.getTime() + REMINDER_COOLDOWN_MS);
    httpAssert.true(nextAllowedAt.getTime() <= Date.now(), {
      status: 429,
      statusText: 'Too Many Requests',
      message: `A reminder was already sent recently; try again after ${nextAllowedAt.toISOString()}`
    });
  }

  const reminderEvent = await db.core.transaction(async tx =>
    recordGovernanceEvent(
      tx,
      caseRow,
      {
        eventType: 'reminder_sent',
        actorUserId: userId,
        previousStatus: caseRow.status,
        resultingStatus: caseRow.status,
        reason: null,
        metadata: { trigger: 'manual', actor_user_id: userId }
      },
      registry
    )
  );

  return {
    case: await toApiCaseForContext(db, caseRow, authCtx, registry),
    event: await toApiEventForContext(db, caseRow, reminderEvent, authCtx, registry)
  };
};

export const sendGovernanceCaseReminder = async (
  db: DatabaseAdapter,
  workspace: string,
  caseId: string,
  event: AuthenticatedEvent,
  registry: GovernanceRegistry = createGovernanceRegistry()
): Promise<{ case: GovernanceCase; event: GovernanceEvent }> =>
  runAuthorizedOperation({
    db,
    event,
    scope: { kind: 'entity', workspace },
    operation: ({ ws, authCtx }) =>
      sendGovernanceCaseReminderForContext(db, ws, caseId, event, authCtx, registry)
  });

export const decideGovernanceAssignmentWithContext = async (
  db: DatabaseAdapter,
  ws: string,
  assignmentId: string,
  event: AuthenticatedEvent,
  authCtx: WorkspaceAuthorizationContext,
  input: DecideGovernanceAssignmentInput,
  registry: GovernanceRegistry = createGovernanceRegistry(),
  options: GovernanceDecisionOptions = {}
): Promise<{ case: GovernanceCase; event: GovernanceEvent }> => {
  requireWorkspaceCapability(authCtx, 'ws.view');
  httpAssert.string(input.idempotencyKey, {
    status: 400,
    statusText: 'Bad Request',
    message: 'idempotencyKey is required'
  });

  const notFound = { status: 404, message: `Assignment '${assignmentId}' not found` };
  const assignment = await db.governance.getAssignment(assignmentId);
  httpAssert.present(assignment, notFound);
  httpAssert.true(assignment.workspace === ws, notFound);

  const caseRow = await db.governance.getCase(ws, assignment.case_id);
  httpAssert.present(caseRow, notFound);

  const userId = event.context.user.id;
  const eligibility = options.externalIntegration
    ? { eligible: true as const, authorizationPath: 'external_integration' }
    : resolveAssignmentEligibility(authCtx, userId, assignment);
  httpAssert.true(eligibility.eligible, {
    status: 403,
    statusText: 'Forbidden',
    message: 'You are not eligible to decide this assignment'
  });

  // Self-approval is denied by default; only the policy captured on the case at submission time
  // (not the actor's role) can allow it.
  httpAssert.true(
    options.externalIntegration ||
      caseRow.initiator_user_id !== userId ||
      caseRow.self_approval_allowed,
    {
      status: 403,
      statusText: 'Forbidden',
      message: 'Self-approval is not allowed for this case'
    }
  );

  httpAssert.true(input.decision !== 'request_changes' || !!input.reason?.trim(), {
    status: 400,
    statusText: 'Bad Request',
    message: 'A reason is required when requesting changes'
  });

  const now = new Date();

  const result = await db.core.transaction(async tx => {
    const existingRequest = await tx.governance.findDecisionRequest(
      assignment.id,
      input.idempotencyKey
    );
    if (existingRequest) {
      const events = await tx.governance.listEvents(caseRow.id);
      const existingEvent = events.find(candidate => candidate.id === existingRequest.eventId);
      httpAssert.present(existingEvent, {
        status: 500,
        message: 'Recorded decision event is missing'
      });
      const currentCase = await tx.governance.getCase(ws, caseRow.id);
      httpAssert.present(currentCase, notFound);
      return { case: currentCase, event: existingEvent };
    }

    const config = registry.get(caseRow.case_kind);
    if (config?.beforeDecision) {
      const validation = await config.beforeDecision(tx, {
        case: caseRow,
        assignmentId: assignment.id,
        actorUserId: userId,
        decision: input.decision
      });
      if (validation === 'stale') {
        const cancelledCase = await tx.governance.cancelCaseIfOpen(caseRow.id, now);
        httpAssert.present(cancelledCase, {
          status: 409,
          statusText: 'Conflict',
          message: 'This governance case is no longer open'
        });
        const staleSupersededIds = await tx.governance.supersedeAllOpenAssignmentsForCase(
          caseRow.id,
          now
        );
        await resolveAssignmentNotifications(tx, staleSupersededIds, now);
        await resolveCaseNotifications(tx, cancelledCase.id, now);
        const staleEvent = await recordGovernanceEvent(
          tx,
          cancelledCase,
          {
            eventType: 'proposal_stale',
            actorUserId: userId,
            previousStatus: 'open',
            resultingStatus: 'cancelled',
            reason: input.reason ?? null,
            metadata: { assignmentId: assignment.id }
          },
          registry
        );
        await tx.governance.recordDecisionRequest(
          assignment.id,
          input.idempotencyKey,
          staleEvent.id,
          now
        );
        return { case: cancelledCase, event: staleEvent };
      }
    }

    const completedAssignment = await tx.governance.completeAssignmentIfOpen(assignment.id, now);
    httpAssert.present(completedAssignment, {
      status: 409,
      statusText: 'Conflict',
      message: 'This assignment has already been decided'
    });

    await resolveAssignmentNotifications(tx, [completedAssignment.id], now);

    const isIndependentAssignment =
      config?.independentAssignmentActions?.has(assignment.action) ?? false;
    const completesCase =
      CASE_COMPLETING_DECISIONS.has(input.decision) &&
      (config?.shouldCompleteCase
        ? await config.shouldCompleteCase({
            tx,
            case: caseRow,
            assignmentId: assignment.id,
            actorUserId: userId,
            decision: input.decision
          })
        : !isIndependentAssignment);
    if (completesCase) {
      const siblingSupersededIds = await tx.governance.supersedeOpenSiblingAssignments(
        caseRow.id,
        assignment.action,
        assignment.id,
        now
      );
      await resolveAssignmentNotifications(tx, siblingSupersededIds, now);
    }

    let resultingCase = caseRow;
    if (completesCase) {
      const completedCase = await tx.governance.completeCaseIfOpen(caseRow.id, input.decision, now);
      httpAssert.present(completedCase, {
        status: 409,
        statusText: 'Conflict',
        message: 'This case has already been completed or cancelled'
      });
      const caseSupersededIds = await tx.governance.supersedeAllOpenAssignmentsForCase(
        caseRow.id,
        now
      );
      await resolveAssignmentNotifications(tx, caseSupersededIds, now);
      await resolveCaseNotifications(tx, completedCase.id, now);
      resultingCase = completedCase;
    }

    const decisionEvent = await recordGovernanceEvent(
      tx,
      resultingCase,
      {
        eventType: DECISION_EVENT_TYPES[input.decision],
        actorUserId: userId,
        previousStatus: caseRow.status,
        resultingStatus: resultingCase.status,
        reason: input.reason ?? null,
        metadata: { assignmentId: assignment.id, authorizationPath: eligibility.authorizationPath }
      },
      registry
    );

    await tx.governance.recordDecisionRequest(
      assignment.id,
      input.idempotencyKey,
      decisionEvent.id,
      now
    );

    // Synchronous domain effects run inside this same transaction: a failure rolls back the
    // whole decision instead of leaving a case marked "approved" whose effect never applied.
    if (config?.handleDecision) {
      await config.handleDecision(tx, {
        case: resultingCase,
        event: decisionEvent,
        decision: input.decision
      });
    }

    if (
      resultingCase.status === 'completed' &&
      (input.decision === 'approve' || input.decision === 'acknowledge')
    ) {
      if (config?.applyDomainEffect) {
        await config.applyDomainEffect(tx, { case: resultingCase, event: decisionEvent });
      }
    }

    return { case: resultingCase, event: decisionEvent };
  });

  return {
    case: await toApiCaseForContext(db, result.case, authCtx, registry),
    event: await toApiEventForContext(db, result.case, result.event, authCtx, registry)
  };
};

export const decideGovernanceAssignment = async (
  db: DatabaseAdapter,
  workspace: string,
  assignmentId: string,
  event: AuthenticatedEvent,
  input: DecideGovernanceAssignmentInput,
  registry: GovernanceRegistry = createGovernanceRegistry(),
  options: GovernanceDecisionOptions = {}
): Promise<{ case: GovernanceCase; event: GovernanceEvent }> =>
  runAuthorizedOperation({
    db,
    event,
    scope: { kind: 'workspace', workspace },
    operation: ({ ws, authCtx }) =>
      decideGovernanceAssignmentWithContext(
        db,
        ws,
        assignmentId,
        event,
        authCtx,
        input,
        registry,
        options
      ),
    // Synchronous governance effects historically propagated their domain errors to callers;
    // keep that behavior while retaining the shared HTTP/database mapping.
    onError: error => {
      if (!HTTPError.isError(error) && !(error instanceof DatabaseError)) throw error;
    }
  });
