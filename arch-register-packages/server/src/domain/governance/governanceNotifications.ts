import { randomUUID } from 'node:crypto';
import {
  buildWorkspaceAuthorizationContext,
  PermissionChecker,
  resolveWorkspaceRoleDefinitions,
  type WorkspaceCapability
} from '@arch-register/permissions';
import type { DatabaseAdapter } from '../../db/database';
import type {
  GovernanceCaseDbResult,
  GovernanceEventDbResult,
  GovernanceEventType
} from './db/governanceDatabase';
import { RetryableJobError } from '../jobs/jobRetry';
import { notificationTypeForGovernanceEvent } from '../notification/notificationPreferenceCatalog';
import { isChannelEnabled } from '../notification/notificationPreferences';

const checker = new PermissionChecker();
const NEVER_ABORTED_SIGNAL = new AbortController().signal;

const throwIfAborted = (signal: AbortSignal) => {
  if (signal.aborted) throw signal.reason ?? new Error('Job execution aborted');
};

type GovernanceNotificationJobPayload = {
  caseId: string;
  eventId: string;
  eventType: GovernanceEventType;
};

const isPayload = (payload: Record<string, unknown>): payload is GovernanceNotificationJobPayload =>
  typeof payload['caseId'] === 'string' &&
  typeof payload['eventId'] === 'string' &&
  typeof payload['eventType'] === 'string';

const humanize = (value: string) =>
  value.replace(/[._-]+/g, ' ').replace(/\b\w/g, character => character.toUpperCase());

const getPresentation = (eventType: GovernanceEventType, caseKind: string) => {
  const subject = humanize(caseKind);
  switch (eventType) {
    case 'submitted':
      return {
        title: `${subject} requires your review`,
        message: 'A governance task is waiting for you.'
      };
    case 'changes_requested':
      return {
        title: `${subject} changes requested`,
        message: 'Changes were requested on a governance case.'
      };
    case 'approved':
      return { title: `${subject} approved`, message: 'The governance case was approved.' };
    case 'rejected':
      return { title: `${subject} rejected`, message: 'The governance case was rejected.' };
    case 'acknowledged':
      return { title: `${subject} acknowledged`, message: 'The governance case was acknowledged.' };
    case 'cancelled':
      return { title: `${subject} withdrawn`, message: 'The governance case was withdrawn.' };
    case 'proposal_stale':
      return {
        title: `${subject} became stale`,
        message: 'The governed proposal needs attention.'
      };
    default:
      return {
        title: `${subject} updated`,
        message: `The governance case emitted ${humanize(eventType)}.`
      };
  }
};

const listAssignmentRecipients = async (
  db: DatabaseAdapter,
  workspace: string,
  assignment: Awaited<ReturnType<DatabaseAdapter['governance']['getAssignment']>>,
  signal: AbortSignal = NEVER_ABORTED_SIGNAL
) => {
  throwIfAborted(signal);
  if (!assignment) return [];

  if (assignment.target_type === 'user') {
    if (!assignment.target_user_id) return [];
    throwIfAborted(signal);
    const user = await db.auth.getUser(assignment.target_user_id);
    return user?.is_active ? [user] : [];
  }

  throwIfAborted(signal);
  const members = await db.workspace.listWorkspaceMembers(workspace);
  throwIfAborted(signal);
  const teamAssignments = await db.workspace.listTeamAssignments(workspace);
  const activeUsers = await Promise.all(
    members.map(async member => {
      throwIfAborted(signal);
      const user = await db.auth.getUser(member.user_id);
      return user?.is_active ? { member, user } : null;
    })
  );

  if (assignment.target_type === 'team_role') {
    return activeUsers
      .filter(
        item =>
          item != null &&
          teamAssignments.some(
            membership =>
              membership.user_id === item.member.user_id &&
              membership.team_id === assignment.target_team_id &&
              membership.role === assignment.target_team_role
          )
      )
      .map(item => item!.user);
  }

  throwIfAborted(signal);
  const roleDefinitions = resolveWorkspaceRoleDefinitions(
    await db.workspace.listCustomWorkspaceRoles(workspace)
  );
  const teams = (await db.workspace.listTeams(workspace)).map(team => ({
    id: team.id,
    name: team.name,
    type: 'team' as const
  }));
  const globalRoles = await Promise.all(
    activeUsers.map(async item => {
      throwIfAborted(signal);
      return item ? db.auth.listGlobalRoleAssignments(item.user.id) : [];
    })
  );

  return activeUsers
    .map((item, index) => {
      if (!item) return null;
      const context = buildWorkspaceAuthorizationContext({
        userId: item.user.id,
        globalRoles: globalRoles[index]!.map(role => role.role),
        workspaceRole: item.member.role,
        workspaceRoles: roleDefinitions,
        teamAssignments: teamAssignments
          .filter(membership => membership.user_id === item.user.id)
          .map(membership => ({ teamId: membership.team_id, role: membership.role })),
        teams
      });
      return checker.hasWorkspaceCapability(
        context,
        assignment.target_capability as WorkspaceCapability
      )
        ? item.user
        : null;
    })
    .filter(item => item != null);
};

const createGovernanceNotification = async (
  db: DatabaseAdapter,
  input: {
    workspace: string;
    eventId: string;
    eventType: GovernanceEventType;
    caseId: string;
    subjectType: string;
    subjectId: string;
    caseKind: string;
    assignmentId: string | null;
    recipientUserId: string;
    actorUserId: string | null;
    actorDisplayName: string | null;
    occurredAt: Date;
    signal?: AbortSignal;
  }
) => {
  const signal = input.signal ?? NEVER_ABORTED_SIGNAL;
  throwIfAborted(signal);
  const notificationType = notificationTypeForGovernanceEvent(input.eventType);
  const inAppEnabled = await isChannelEnabled(
    db,
    input.recipientUserId,
    input.workspace,
    notificationType,
    'in_app'
  );
  if (!inAppEnabled) return;

  const presentation = getPresentation(input.eventType, input.caseKind);
  await db.notification.createNotification({
    id: randomUUID(),
    user_id: input.recipientUserId,
    workspace: input.workspace,
    category: input.eventType === 'submitted' ? 'action' : 'information',
    event_type: input.eventType,
    resource_type: input.subjectType,
    resource_id: input.subjectId,
    case_id: input.caseId,
    assignment_id: input.assignmentId,
    actor_user_id: input.actorUserId,
    actor_display_name: input.actorDisplayName,
    title: presentation.title,
    message: presentation.message,
    action_route: `/governance?caseId=${encodeURIComponent(input.caseId)}`,
    presentation_metadata: { caseKind: input.caseKind },
    occurred_at: input.occurredAt,
    delivery_key: `governance:${input.eventId}:user:${input.recipientUserId}:assignment:${input.assignmentId ?? 'none'}`
  });
};

const resolveGovernanceNotificationRecipients = async (
  db: DatabaseAdapter,
  workspace: string,
  caseRow: GovernanceCaseDbResult,
  event: GovernanceEventDbResult,
  signal: AbortSignal = NEVER_ABORTED_SIGNAL
) => {
  throwIfAborted(signal);
  const assignments = await db.governance.listAssignmentsForCase(caseRow.id);
  const recipients = new Map<string, string | null>();

  if (event.event_type === 'submitted') {
    for (const assignment of assignments) {
      for (const recipient of await listAssignmentRecipients(db, workspace, assignment, signal)) {
        recipients.set(`${recipient.id}:${assignment.id}`, assignment.id);
      }
    }
  } else {
    for (const assignment of assignments) {
      for (const recipient of await listAssignmentRecipients(db, workspace, assignment, signal)) {
        recipients.set(`${recipient.id}:none`, null);
      }
    }
    if (caseRow.initiator_user_id) recipients.set(`${caseRow.initiator_user_id}:none`, null);
  }

  return recipients;
};

/**
 * Creates the in-app notifications for a governance event in the caller's transaction.
 * External channels intentionally remain outside this path and will be handled by the
 * asynchronous notification delivery work tracked in #2211.
 */
export const createGovernanceInAppNotifications = async (
  db: DatabaseAdapter,
  caseRow: GovernanceCaseDbResult,
  event: GovernanceEventDbResult,
  signal: AbortSignal = NEVER_ABORTED_SIGNAL
) => {
  throwIfAborted(signal);
  const actor = event.actor_user_id ? await db.auth.getUser(event.actor_user_id) : null;
  const recipients = await resolveGovernanceNotificationRecipients(
    db,
    caseRow.workspace,
    caseRow,
    event,
    signal
  );

  for (const [recipientKey, assignmentId] of recipients) {
    throwIfAborted(signal);
    const recipientUserId = recipientKey.split(':')[0]!;
    await createGovernanceNotification(db, {
      workspace: caseRow.workspace,
      eventId: event.id,
      eventType: event.event_type,
      caseId: caseRow.id,
      subjectType: caseRow.subject_type,
      subjectId: caseRow.subject_id,
      caseKind: caseRow.case_kind,
      assignmentId,
      recipientUserId,
      actorUserId: event.actor_user_id,
      actorDisplayName: actor?.display_name ?? null,
      occurredAt: event.occurred_at,
      signal
    });
  }

  return { recipients: recipients.size };
};

export const createGovernanceNotificationJobHandler =
  (db: DatabaseAdapter) =>
  async (context: {
    workspace: string;
    payload: Record<string, unknown>;
    signal?: AbortSignal;
  }) => {
    const signal = context.signal ?? NEVER_ABORTED_SIGNAL;
    if (!isPayload(context.payload))
      throw new Error('Governance notification job has an invalid payload');

    try {
      throwIfAborted(signal);
      const caseRow = await db.governance.getCase(context.workspace, context.payload.caseId);
      if (!caseRow) return { skipped: true, reason: 'case-not-found' };
      const event = (await db.governance.listEvents(caseRow.id)).find(
        candidate => candidate.id === context.payload.eventId
      );
      if (!event) return { skipped: true, reason: 'event-not-found' };
      return await createGovernanceInAppNotifications(db, caseRow, event, signal);
    } catch (error) {
      throw new RetryableJobError(
        `Governance notification delivery failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  };
