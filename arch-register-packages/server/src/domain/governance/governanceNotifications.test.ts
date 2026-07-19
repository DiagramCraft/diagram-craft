import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import type { DatabaseAdapter } from '../../db/database';
import type {
  GovernanceAssignmentDbResult,
  GovernanceCaseDbResult,
  GovernanceEventDbResult
} from './db/governanceDatabase';
import { createGovernanceNotificationJobHandler } from './governanceNotifications';

const now = new Date('2026-07-18T10:00:00.000Z');

const makeCase = (): GovernanceCaseDbResult => ({
  id: 'case-1',
  workspace: 'workspace-1',
  case_kind: 'entity.change',
  subject_type: 'entity',
  subject_id: 'entity-1',
  subject_version: null,
  status: 'open',
  outcome: null,
  policy_version: 'v1',
  initiator_user_id: 'initiator-1',
  parent_case_id: null,
  self_approval_allowed: false,
  payload: {},
  created_at: now,
  due_at: null,
  completed_at: null,
  cancelled_at: null
});

const makeAssignment = (): GovernanceAssignmentDbResult => ({
  id: 'assignment-1',
  case_id: 'case-1',
  workspace: 'workspace-1',
  action: 'approve',
  target_type: 'user',
  target_user_id: 'approver-1',
  target_team_id: null,
  target_team_role: null,
  target_capability: null,
  status: 'open',
  created_at: now,
  resolved_at: null
});

const makeEvent = (): GovernanceEventDbResult => ({
  id: 'event-1',
  case_id: 'case-1',
  workspace: 'workspace-1',
  event_type: 'submitted',
  actor_user_id: 'initiator-1',
  occurred_at: now,
  previous_status: null,
  resulting_status: 'open',
  reason: null,
  metadata: {}
});

describe('governance notification delivery', () => {
  it('notifies the case initiator (proposer) when changes are requested', async () => {
    const changesRequestedEvent = {
      ...makeEvent(),
      event_type: 'changes_requested' as const,
      actor_user_id: 'approver-1',
      reason: 'Please fix the description'
    };
    const createNotification = vi.fn(async input => input);
    const db = {
      governance: {
        getCase: vi.fn(async () => makeCase()),
        listEvents: vi.fn(async () => [changesRequestedEvent]),
        listAssignmentsForCase: vi.fn(async () => [makeAssignment()])
      },
      auth: {
        getUser: vi.fn(async (id: string) => ({
          id,
          display_name: id === 'initiator-1' ? 'Initiator' : 'Approver',
          is_active: true
        }))
      },
      notification: { createNotification },
      notificationPreference: { listOverrides: vi.fn(async () => []) }
    } as unknown as DatabaseAdapter;

    const result = await createGovernanceNotificationJobHandler(db)({
      workspace: 'workspace-1',
      payload: { caseId: 'case-1', eventId: 'event-1', eventType: 'changes_requested' }
    });

    // The proposer (case initiator) must be notified, not just the other assignees.
    expect(result).toEqual({ recipients: 2 });
    expect(createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'initiator-1',
        category: 'information',
        case_id: 'case-1',
        actor_display_name: 'Approver'
      })
    );
  });


  it('creates an actionable notification for a directly assigned user', async () => {
    const createNotification = vi.fn(async input => input);
    const db = {
      governance: {
        getCase: vi.fn(async () => makeCase()),
        listEvents: vi.fn(async () => [makeEvent()]),
        listAssignmentsForCase: vi.fn(async () => [makeAssignment()])
      },
      auth: {
        getUser: vi.fn(async (id: string) => ({
          id,
          display_name: id === 'initiator-1' ? 'Initiator' : 'Approver',
          is_active: true
        }))
      },
      notification: { createNotification },
      notificationPreference: { listOverrides: vi.fn(async () => []) }
    } as unknown as DatabaseAdapter;

    const result = await createGovernanceNotificationJobHandler(db)({
      workspace: 'workspace-1',
      payload: { caseId: 'case-1', eventId: 'event-1', eventType: 'submitted' }
    });

    expect(result).toEqual({ recipients: 1 });
    expect(createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'approver-1',
        category: 'action',
        case_id: 'case-1',
        assignment_id: 'assignment-1',
        actor_display_name: 'Initiator',
        delivery_key: expect.stringContaining('event-1')
      })
    );
  });

  it('keeps distinct task notifications for distinct assignments', async () => {
    const first = makeAssignment();
    const second = { ...first, id: randomUUID() };
    const createNotification = vi.fn(async input => input);
    const db = {
      governance: {
        getCase: vi.fn(async () => makeCase()),
        listEvents: vi.fn(async () => [makeEvent()]),
        listAssignmentsForCase: vi.fn(async () => [first, second])
      },
      auth: { getUser: vi.fn(async (id: string) => ({ id, display_name: id, is_active: true })) },
      notification: { createNotification },
      notificationPreference: { listOverrides: vi.fn(async () => []) }
    } as unknown as DatabaseAdapter;

    await createGovernanceNotificationJobHandler(db)({
      workspace: 'workspace-1',
      payload: { caseId: 'case-1', eventId: 'event-1', eventType: 'submitted' }
    });

    expect(createNotification).toHaveBeenCalledTimes(2);
    expect(createNotification.mock.calls.map(([input]) => input.assignment_id)).toEqual(
      expect.arrayContaining(['assignment-1', second.id])
    );
  });

  it('skips in-app delivery for a notification type the recipient opted out of, without affecting other types', async () => {
    const approvedEvent = { ...makeEvent(), event_type: 'approved' as const };
    const createNotification = vi.fn(async input => input);
    const listOverrides = vi.fn(async () => [
      {
        user_id: 'approver-1',
        workspace: 'workspace-1',
        notification_type: 'governance-case-activity',
        channel: 'in_app',
        enabled: false,
        updated_at: now
      }
    ]);
    const db = {
      governance: {
        getCase: vi.fn(async () => makeCase()),
        listEvents: vi.fn(async () => [approvedEvent]),
        listAssignmentsForCase: vi.fn(async () => [makeAssignment()])
      },
      auth: {
        getUser: vi.fn(async (id: string) => ({
          id,
          display_name: id === 'initiator-1' ? 'Initiator' : 'Approver',
          is_active: true
        }))
      },
      notification: { createNotification },
      notificationPreference: { listOverrides }
    } as unknown as DatabaseAdapter;

    await createGovernanceNotificationJobHandler(db)({
      workspace: 'workspace-1',
      payload: { caseId: 'case-1', eventId: 'event-1', eventType: 'approved' }
    });

    // 'approved' is bucketed as governance-case-activity, which the recipient disabled.
    expect(createNotification).not.toHaveBeenCalled();

    // A 'submitted' event is a different bucket (governance-task-assigned) and is
    // unaffected by opting out of governance-case-activity.
    const submittedEvent = makeEvent();
    const db2 = {
      ...db,
      governance: {
        getCase: vi.fn(async () => makeCase()),
        listEvents: vi.fn(async () => [submittedEvent]),
        listAssignmentsForCase: vi.fn(async () => [makeAssignment()])
      }
    } as unknown as DatabaseAdapter;

    await createGovernanceNotificationJobHandler(db2)({
      workspace: 'workspace-1',
      payload: { caseId: 'case-1', eventId: 'event-1', eventType: 'submitted' }
    });

    expect(createNotification).toHaveBeenCalledTimes(1);
  });
});
