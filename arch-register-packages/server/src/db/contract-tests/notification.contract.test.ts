import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { runContractSuiteAgainstBothDrivers } from './harness';
import { createFixtureUser } from './authFixtures';
import { createFixtureWorkspace } from './projectFixtures';
import type { DatabaseAdapter } from '../database';

const createNotification = async (db: DatabaseAdapter, workspace: string, userId: string) =>
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
    delivery_key: 'event-1:user-1'
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
  });
});
