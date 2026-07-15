import { createHmac } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DatabaseAdapter } from '../../db/database';
import { RetryableJobError } from '../jobs/jobRetry';
import {
  auditLogToWebhookEvent,
  createWebhookDeliveryHandler,
  enqueueWebhookDeliveries
} from './webhookDelivery';

const webhook = {
  id: 'hook-1',
  workspace: 'ws-1',
  url: 'https://example.com/hook',
  event_filter: { operations: ['create' as const], schema_ids: [] },
  hmac_secret: 'whsec_test',
  enabled: true,
  created_at: new Date(),
  updated_at: new Date()
};

const event = auditLogToWebhookEvent({
  id: 'audit-1',
  workspace: 'ws-1',
  timestamp: new Date('2026-07-15T10:00:00.000Z'),
  user_id: 'user-1',
  user_display_name: 'Ada',
  operation: 'create',
  entity_type: 'entity',
  entity_id: 'entity-1',
  entity_name: 'Payments',
  entity_slug: 'payments',
  schema_id: 'schema-1',
  changes: { new: { _name: 'Payments' } },
  metadata: { source: 'test' }
});

const db = { webhook: { getWebhook: vi.fn(async () => webhook) } } as unknown as DatabaseAdapter;

afterEach(() => vi.unstubAllGlobals());

describe('webhook delivery', () => {
  it('queues only enabled webhooks whose operation and schema filters match', async () => {
    const enqueueOneOffRun = vi.fn(async input => ({ ...input }));
    const filteredDb = {
      webhook: {
        listWebhooks: vi.fn(async () => [
          webhook,
          {
            ...webhook,
            id: 'hook-wrong-schema',
            event_filter: { operations: ['create'], schema_ids: ['schema-2'] }
          },
          { ...webhook, id: 'hook-disabled', enabled: false }
        ])
      },
      jobs: { enqueueOneOffRun }
    } as unknown as DatabaseAdapter;

    expect(
      await enqueueWebhookDeliveries(filteredDb, {
        id: event.id,
        workspace: event.workspace_id,
        timestamp: new Date(event.occurred_at),
        user_id: event.actor.id,
        user_display_name: event.actor.display_name,
        operation: 'create',
        entity_type: 'entity',
        entity_id: event.entity.id,
        entity_name: event.entity.name,
        entity_slug: event.entity.slug,
        schema_id: event.entity.schema_id,
        changes: event.changes,
        metadata: event.metadata
      })
    ).toBe(1);
    expect(enqueueOneOffRun).toHaveBeenCalledOnce();
    expect(enqueueOneOffRun).toHaveBeenCalledWith(
      expect.objectContaining({
        job_type: 'webhook.delivery',
        max_attempts: 5,
        payload: expect.objectContaining({ webhookId: 'hook-1' })
      })
    );
  });

  it('sends the exact signed payload and delivery headers', async () => {
    const fetchMock = vi.fn(
      async (_input: string | URL | Request, _init?: RequestInit) =>
        new Response(null, { status: 204 })
    );
    vi.stubGlobal('fetch', fetchMock);
    await createWebhookDeliveryHandler(db)({
      jobId: 'delivery-1',
      workspace: 'ws-1',
      payload: { webhookId: 'hook-1', event }
    });
    const [, init] = fetchMock.mock.calls[0]!;
    const body = String(init?.body);
    const headers = init?.headers as Record<string, string>;
    expect(JSON.parse(body)).toEqual(event);
    expect(headers['x-arch-register-delivery-id']).toBe('delivery-1');
    expect(headers['x-arch-register-signature-256']).toBe(
      `sha256=${createHmac('sha256', 'whsec_test').update(body).digest('hex')}`
    );
  });

  it('classifies temporary and permanent HTTP responses', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(null, { status: 503 }))
    );
    await expect(
      createWebhookDeliveryHandler(db)({
        jobId: 'delivery-1',
        workspace: 'ws-1',
        payload: { webhookId: 'hook-1', event }
      })
    ).rejects.toBeInstanceOf(RetryableJobError);

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(null, { status: 400 }))
    );
    await expect(
      createWebhookDeliveryHandler(db)({
        jobId: 'delivery-1',
        workspace: 'ws-1',
        payload: { webhookId: 'hook-1', event }
      })
    ).rejects.toThrow('Webhook returned HTTP 400');
  });
});
