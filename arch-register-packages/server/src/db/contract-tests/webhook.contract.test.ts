import { randomUUID } from 'node:crypto';
import { expect, it } from 'vitest';
import { runContractSuiteAgainstBothDrivers } from './harness';
import { createFixtureWorkspace } from './projectFixtures';

runContractSuiteAgainstBothDrivers('WebhookDatabase', getDb => {
  it('creates, updates, lists, and deletes workspace webhooks', async () => {
    const db = getDb();
    const workspace = await createFixtureWorkspace(db);
    const now = new Date('2026-07-15T10:00:00.000Z');
    const created = await db.webhook.createWebhook({
      id: randomUUID(),
      workspace,
      url: 'https://example.com/hook',
      event_filter: { operations: ['create', 'delete'], schema_ids: [] },
      hmac_secret: 'whsec_test',
      enabled: true,
      created_at: now,
      updated_at: now
    });

    expect(await db.webhook.listWebhooks(workspace)).toEqual([created]);
    const updated = await db.webhook.updateWebhook(workspace, created.id, {
      url: 'https://example.com/updated',
      event_filter: { operations: ['update'], schema_ids: ['schema-1'] },
      hmac_secret: 'whsec_rotated',
      enabled: false,
      updated_at: new Date('2026-07-15T11:00:00.000Z')
    });
    expect(updated).toMatchObject({ enabled: false, hmac_secret: 'whsec_rotated' });
    expect(await db.webhook.deleteWebhook(workspace, created.id)).toBe(true);
    expect(await db.webhook.getWebhook(workspace, created.id)).toBeNull();
  });
});
