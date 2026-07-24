import { randomUUID } from 'node:crypto';
import { expect, it } from 'vitest';
import { runContractSuiteAgainstBothDrivers } from './harness';
import { createFixtureUser } from './authFixtures';
import { createFixtureWorkspace } from './projectFixtures';
import type { DatabaseAdapter } from '../database';

const createNotification = async (db: DatabaseAdapter, workspace: string, userId: string) =>
  db.notification.createNotification({
    id: randomUUID(),
    user_id: userId,
    workspace,
    category: 'information',
    event_type: 'entity.update',
    resource_type: 'entity',
    resource_id: randomUUID(),
    case_id: null,
    assignment_id: null,
    actor_user_id: null,
    actor_display_name: 'System',
    title: 'Entity updated',
    message: 'An entity you watch changed.',
    action_route: null,
    presentation_metadata: {},
    occurred_at: new Date(),
    delivery_key: randomUUID(),
    in_app_enabled: false
  });

runContractSuiteAgainstBothDrivers('NotificationDeliveryDatabase', getDb => {
  it('claims, completes, and deduplicates email deliveries', async () => {
    const db = getDb();
    const workspace = await createFixtureWorkspace(db);
    const user = await createFixtureUser(db);
    const notification = await createNotification(db, workspace, user.id);
    const now = new Date('2026-07-18T10:00:00.000Z');

    const created = await db.notificationDelivery.createDelivery({
      id: randomUUID(),
      notification_id: notification.id,
      user_id: user.id,
      workspace,
      channel: 'email',
      recipient_email: user.email!,
      max_attempts: 5,
      next_attempt_at: now,
      created_at: now
    });
    const duplicate = await db.notificationDelivery.createDelivery({
      ...created,
      id: randomUUID(),
      created_at: now,
      updated_at: now
    });
    expect(duplicate.id).toBe(created.id);

    const [claim] = await db.notificationDelivery.claimPending(workspace, 10, now, 60_000);
    expect(claim).toMatchObject({ id: created.id, status: 'processing', attempt_count: 1 });
    expect(
      await db.notificationDelivery.markSent(
        claim!.id,
        claim!.lease_token,
        'fake',
        'provider-message-1',
        now
      )
    ).toBe(true);
    expect(await db.notificationDelivery.claimPending(workspace, 10, now, 60_000)).toEqual([]);
  });
});
