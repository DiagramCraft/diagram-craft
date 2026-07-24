import { createHmac } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DatabaseAdapter } from '../../db/database';
import { RetryableJobError } from '../jobs/jobRetry';
import {
  auditLogToWebhookEvent,
  createWebhookDeliveryHandler,
  enqueueWebhookDeliveries
} from './webhookDelivery';
import { sendWebhookRequest } from './webhookRequest';

vi.mock('./webhookRequest', async importOriginal => {
  const actual = await importOriginal<typeof import('./webhookRequest')>();
  return { ...actual, sendWebhookRequest: vi.fn() };
});

const sendWebhookRequestMock = vi.mocked(sendWebhookRequest);

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

afterEach(() => {
  vi.unstubAllGlobals();
  sendWebhookRequestMock.mockReset();
});

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
    sendWebhookRequestMock.mockResolvedValue({ status: 204, retryAfter: null });
    await createWebhookDeliveryHandler(db)({
      jobId: 'delivery-1',
      workspace: 'ws-1',
      payload: { webhookId: 'hook-1', event }
    });
    const [url, request] = sendWebhookRequestMock.mock.calls[0]!;
    const body = request.body;
    const headers = request.headers;
    expect(url).toEqual(new URL(webhook.url));
    expect(JSON.parse(body)).toEqual(event);
    expect(headers['x-arch-register-delivery-id']).toBe('delivery-1');
    expect(headers['x-arch-register-signature-256']).toBe(
      `sha256=${createHmac('sha256', 'whsec_test').update(body).digest('hex')}`
    );
  });

  it('classifies temporary and permanent HTTP responses', async () => {
    sendWebhookRequestMock.mockResolvedValueOnce({ status: 503, retryAfter: null });
    await expect(
      createWebhookDeliveryHandler(db)({
        jobId: 'delivery-1',
        workspace: 'ws-1',
        payload: { webhookId: 'hook-1', event }
      })
    ).rejects.toBeInstanceOf(RetryableJobError);

    sendWebhookRequestMock.mockResolvedValueOnce({ status: 400, retryAfter: null });
    await expect(
      createWebhookDeliveryHandler(db)({
        jobId: 'delivery-1',
        workspace: 'ws-1',
        payload: { webhookId: 'hook-1', event }
      })
    ).rejects.toThrow('Webhook returned HTTP 400');
  });

  it('cancels an in-flight request when the job signal is aborted', async () => {
    const controller = new AbortController();
    sendWebhookRequestMock.mockImplementation(
      async (_url, request) =>
        new Promise((_resolve, reject) => {
          request.signal.addEventListener('abort', () => reject(request.signal.reason));
        })
    );

    const execution = createWebhookDeliveryHandler(db)({
      jobId: 'delivery-1',
      workspace: 'ws-1',
      payload: { webhookId: 'hook-1', event },
      signal: controller.signal
    });
    await vi.waitFor(() => expect(sendWebhookRequestMock).toHaveBeenCalled());
    controller.abort(new Error('lease lost'));

    await expect(execution).rejects.toBeInstanceOf(RetryableJobError);
  });

  it('does not follow redirects', async () => {
    sendWebhookRequestMock.mockResolvedValue({ status: 302, retryAfter: null });

    await expect(
      createWebhookDeliveryHandler(db)({
        jobId: 'delivery-1',
        workspace: 'ws-1',
        payload: { webhookId: 'hook-1', event }
      })
    ).rejects.toThrow('Webhook returned HTTP 302');
    expect(sendWebhookRequestMock).toHaveBeenCalledTimes(1);
  });
});
