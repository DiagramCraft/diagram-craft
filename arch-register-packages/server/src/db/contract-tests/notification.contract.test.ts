import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { runContractSuiteAgainstBothDrivers } from './harness';
import { createFixtureUser } from './authFixtures';
import { createFixtureWorkspace } from './projectFixtures';
import type { DatabaseAdapter } from '../database';

const createFixtureCase = async (db: DatabaseAdapter, workspace: string, userId: string) =>
  db.governance.createCase({
    id: randomUUID(),
    workspace,
    case_kind: 'test.echo',
    subject_type: 'entity',
    subject_id: randomUUID(),
    subject_version: null,
    policy_version: null,
    initiator_user_id: userId,
    parent_case_id: null,
    self_approval_allowed: false,
    payload: {},
    created_at: new Date(),
    due_at: null
  });

const createFixtureAssignment = async (db: DatabaseAdapter, workspace: string, userId: string) => {
  const caseRow = await createFixtureCase(db, workspace, userId);
  return db.governance.createAssignment({
    id: randomUUID(),
    case_id: caseRow.id,
    workspace,
    action: 'approve',
    target_type: 'user',
    target_user_id: userId,
    target_team_id: null,
    target_team_role: null,
    target_capability: null,
    created_at: new Date()
  });
};

const createNotification = async (
  db: DatabaseAdapter,
  workspace: string,
  userId: string,
  overrides: Partial<Parameters<DatabaseAdapter['notification']['createNotification']>[0]> = {}
) =>
  db.notification.createNotification({
    id: randomUUID(),
    user_id: userId,
    workspace,
    category: 'action',
    event_type: 'submitted',
    resource_type: 'entity',
    resource_id: randomUUID(),
    case_id: null,
    assignment_id: null,
    actor_user_id: null,
    actor_display_name: 'System',
    title: 'Review required',
    message: 'A governance task is waiting.',
    action_route: '/governance',
    presentation_metadata: { caseKind: 'test.echo' },
    occurred_at: new Date('2026-07-18T10:00:00.000Z'),
    delivery_key: randomUUID(),
    ...overrides
  });

runContractSuiteAgainstBothDrivers('NotificationDatabase', getDb => {
  describe('inbox notifications', () => {
    it('creates idempotently and counts unread notifications', async () => {
      const db = getDb();
      const workspace = await createFixtureWorkspace(db);
      const user = await createFixtureUser(db);

      const created = await createNotification(db, workspace, user.id);
      const duplicate = await db.notification.createNotification({
        ...created,
        id: randomUUID(),
        created_at: new Date(),
        read_at: null
      });

      expect(duplicate.id).toBe(created.id);
      expect(await db.notification.countUnread(user.id, workspace)).toBe(1);
    });

    it('marks individual and bulk notifications read without deleting history', async () => {
      const db = getDb();
      const workspace = await createFixtureWorkspace(db);
      const user = await createFixtureUser(db);
      const first = await createNotification(db, workspace, user.id);
      const second = await db.notification.createNotification({
        ...first,
        id: randomUUID(),
        delivery_key: 'event-2:user-1'
      });

      expect(await db.notification.markRead(user.id, workspace, first.id, new Date())).toBe(true);
      expect(await db.notification.countUnread(user.id, workspace)).toBe(1);
      expect(await db.notification.markAllRead(user.id, workspace, new Date())).toBe(1);
      expect(await db.notification.countUnread(user.id, workspace)).toBe(0);
      expect(await db.notification.listNotifications(user.id, workspace)).toHaveLength(2);
      expect(
        (await db.notification.listNotifications(user.id, workspace)).map(item => item.id)
      ).toEqual(expect.arrayContaining([first.id, second.id]));
    });

    it('marks notifications read by assignment id, leaving unrelated ones untouched', async () => {
      const db = getDb();
      const workspace = await createFixtureWorkspace(db);
      const user = await createFixtureUser(db);
      const resolvedAssignment = await createFixtureAssignment(db, workspace, user.id);
      const otherAssignment = await createFixtureAssignment(db, workspace, user.id);

      const resolvedNotification = await createNotification(db, workspace, user.id, {
        assignment_id: resolvedAssignment.id
      });
      const otherNotification = await createNotification(db, workspace, user.id, {
        assignment_id: otherAssignment.id
      });

      const count = await db.notification.markReadByAssignmentIds(
        [resolvedAssignment.id],
        new Date()
      );

      expect(count).toBe(1);
      const notifications = await db.notification.listNotifications(user.id, workspace);
      expect(notifications.find(n => n.id === resolvedNotification.id)?.read_at).not.toBeNull();
      expect(notifications.find(n => n.id === otherNotification.id)?.read_at).toBeNull();
    });

    it('marks notifications read by case id, leaving unrelated ones untouched', async () => {
      const db = getDb();
      const workspace = await createFixtureWorkspace(db);
      const user = await createFixtureUser(db);
      const resolvedCase = await createFixtureCase(db, workspace, user.id);
      const otherCase = await createFixtureCase(db, workspace, user.id);

      // No assignment_id: mirrors informational notifications (assigned, approved, rejected, ...)
      // which are only tied to the case, not to a specific assignment.
      const resolvedNotification = await createNotification(db, workspace, user.id, {
        case_id: resolvedCase.id
      });
      const otherNotification = await createNotification(db, workspace, user.id, {
        case_id: otherCase.id
      });

      const count = await db.notification.markReadByCaseIds([resolvedCase.id], new Date());

      expect(count).toBe(1);
      const notifications = await db.notification.listNotifications(user.id, workspace);
      expect(notifications.find(n => n.id === resolvedNotification.id)?.read_at).not.toBeNull();
      expect(notifications.find(n => n.id === otherNotification.id)?.read_at).toBeNull();
    });
  });
});
