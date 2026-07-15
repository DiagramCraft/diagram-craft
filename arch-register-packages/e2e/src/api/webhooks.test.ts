import { createApiTest, expect } from '../helpers/fixtures';
import { logAudit } from '@arch-register/server/domain/audit/db/auditLogging';
import { seedIds, TEST_ADMIN } from '../helpers/seedHelper';

const test = createApiTest();

test.describe('workspace webhooks', () => {
  test('creates, lists, rotates, updates, and deletes without exposing stored secrets', async ({
    orpc
  }) => {
    const created = await orpc.webhooks.create({
      params: { workspace: 'default' },
      body: {
        url: 'http://localhost:3020/webhook',
        event_filter: { operations: ['create', 'update', 'delete'], schema_ids: [] },
        enabled: true
      }
    });
    expect(created.secret).toMatch(/^whsec_/);
    expect(created.webhook).not.toHaveProperty('hmac_secret');

    const listed = await orpc.webhooks.list({ params: { workspace: 'default' } });
    expect(listed).toHaveLength(1);
    expect(listed[0]).not.toHaveProperty('hmac_secret');

    const rotated = await orpc.webhooks.rotateSecret({
      params: { workspace: 'default', id: created.webhook.id }
    });
    expect(rotated.secret).not.toBe(created.secret);

    const updated = await orpc.webhooks.update({
      params: { workspace: 'default', id: created.webhook.id },
      body: {
        url: 'https://example.com/entity-events',
        event_filter: { operations: ['update'], schema_ids: [] },
        enabled: false
      }
    });
    expect(updated).toMatchObject({ enabled: false, url: 'https://example.com/entity-events' });

    await expect(
      orpc.webhooks.remove({ params: { workspace: 'default', id: created.webhook.id } })
    ).resolves.toEqual({ success: true });
  });

  test('queues matching entity audit events as retryable one-off jobs', async ({
    server,
    orpc
  }) => {
    const created = await orpc.webhooks.create({
      params: { workspace: 'default' },
      body: {
        url: 'http://localhost:3020/webhook',
        event_filter: { operations: ['create'], schema_ids: [] },
        enabled: true
      }
    });
    await logAudit(server.db, {
      workspace: seedIds.workspace.default,
      userId: TEST_ADMIN.id,
      userDisplayName: TEST_ADMIN.display_name,
      operation: 'create',
      entityType: 'entity',
      entityId: 'entity-webhook-test',
      entityName: 'Webhook test entity',
      schemaId: null,
      changes: { new: { _name: 'Webhook test entity' } }
    });
    const page = await server.db.jobs.listRuns(seedIds.workspace.default, {
      limit: 20,
      offset: 0
    });
    expect(page.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          schedule_id: null,
          job_type: 'webhook.delivery',
          max_attempts: 5,
          payload: expect.objectContaining({ webhookId: created.webhook.id })
        })
      ])
    );
  });
});
