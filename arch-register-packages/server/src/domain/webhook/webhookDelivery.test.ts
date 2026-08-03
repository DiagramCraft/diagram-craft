import { createHmac } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DatabaseAdapter } from '../../db/database';
import { RetryableJobError } from '../jobs/jobRetry';
import type { FieldGroupSchemaShape } from '../auth/fieldGroupAccessControl';
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

const event = auditLogToWebhookEvent(
  {
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
  },
  null
);

const db = { webhook: { getWebhook: vi.fn(async () => webhook) } } as unknown as DatabaseAdapter;

afterEach(() => {
  vi.unstubAllGlobals();
  sendWebhookRequestMock.mockReset();
});

describe('webhook delivery', () => {
  it('queues relation events only for explicitly enabled relation filters and redacts relation fields', async () => {
    const enqueueOneOffRun = vi.fn(async input => ({ ...input }));
    const relationSchema: FieldGroupSchemaShape = {
      fields: [
        { id: 'status', name: 'Status' },
        { id: 'secret', name: 'Secret', groupId: 'restricted' }
      ],
      groups: [{ id: 'restricted', accessControl: { teamIds: ['team-1'] } }]
    };
    const relationAudit: Parameters<typeof enqueueWebhookDeliveries>[1] = {
      id: 'relation-audit-1',
      workspace: 'ws-1',
      timestamp: new Date('2026-07-15T10:00:00.000Z'),
      user_id: 'user-1',
      user_display_name: 'Ada',
      operation: 'update',
      entity_type: 'relation',
      entity_id: 'relation-1',
      entity_name: 'Payments → Ledger',
      entity_slug: null,
      schema_id: 'relation-schema-1',
      changes: {
        old: { status: 'draft', secret: 'old' },
        new: { status: 'active', secret: 'new' }
      },
      metadata: {
        relation: {
          id: 'relation-1',
          schema: { id: 'relation-schema-1', name: 'Depends on' },
          in: { id: 'entity-1', name: 'Payments' },
          out: { id: 'entity-2', name: 'Ledger' }
        }
      }
    };
    const filteredDb = {
      webhook: {
        listWebhooks: vi.fn(async () => [
          {
            ...webhook,
            event_filter: { operations: ['update'], schema_ids: [] }
          },
          {
            ...webhook,
            id: 'relation-hook',
            event_filter: { operations: ['update'], schema_ids: [], relation_schema_ids: [] }
          }
        ])
      },
      relation: {
        getRelationSchema: vi.fn(async () => ({
          ...relationSchema,
          created_at: new Date('2026-01-01')
        })),
        listRelationSchemaVersions: vi.fn(async () => [])
      },
      jobs: { enqueueOneOffRun }
    } as unknown as DatabaseAdapter;

    expect(await enqueueWebhookDeliveries(filteredDb, relationAudit)).toBe(1);
    const payload = enqueueOneOffRun.mock.calls[0]![0].payload as {
      event: { type: string; operation: string; relation: unknown; changes: unknown };
    };
    expect(payload.event).toMatchObject({
      type: 'relation.updated',
      operation: 'update',
      relation: {
        id: 'relation-1',
        schema: { name: 'Depends on' },
        in: { id: 'entity-1' },
        out: { id: 'entity-2' }
      }
    });
    expect(payload.event.changes).toEqual({
      old: { status: 'draft' },
      new: { status: 'active' }
    });
  });

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
      catalog: {
        getSchema: vi.fn(async () => null),
        listSchemaVersions: vi.fn(async () => [])
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
        entity_id: event.entity!.id,
        entity_name: event.entity!.name,
        entity_slug: event.entity!.slug,
        schema_id: event.entity!.schema_id,
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

  it('strips restricted field-group values from the delivered event unconditionally', async () => {
    const enqueueOneOffRun = vi.fn(async input => ({ ...input }));
    const schema: FieldGroupSchemaShape = {
      fields: [
        { id: '_name', name: 'Name' } as never,
        { id: 'secret', name: 'Secret', groupId: 'restricted' } as never
      ],
      groups: [{ id: 'restricted', accessControl: { teamIds: ['team-1'] } } as never]
    };
    const restrictedDb = {
      webhook: { listWebhooks: vi.fn(async () => [webhook]) },
      catalog: {
        getSchema: vi.fn(async () => ({ ...schema, created_at: new Date('2026-01-01') })),
        listSchemaVersions: vi.fn(async () => [])
      },
      jobs: { enqueueOneOffRun }
    } as unknown as DatabaseAdapter;

    await enqueueWebhookDeliveries(restrictedDb, {
      id: 'audit-2',
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
      changes: {
        old: { _name: 'Payments', secret: 'old-secret' },
        new: { _name: 'Payments Inc', secret: 'new-secret' }
      },
      metadata: {}
    });

    const payload = enqueueOneOffRun.mock.calls[0]![0].payload as { event: { changes: unknown } };
    expect(payload.event.changes).toEqual({
      old: { _name: 'Payments' },
      new: { _name: 'Payments Inc' }
    });
  });

  it('uses the historical schema when current field-group access changed', async () => {
    const enqueueOneOffRun = vi.fn(async input => ({ ...input }));
    const currentSchema: FieldGroupSchemaShape = {
      fields: [{ id: 'secret', name: 'Secret' } as never],
      groups: []
    };
    const historicalSchema: FieldGroupSchemaShape = {
      fields: [{ id: 'secret', name: 'Secret', groupId: 'restricted' } as never],
      groups: [{ id: 'restricted', accessControl: { teamIds: ['team-1'] } } as never]
    };
    const historicalVersion = {
      ...historicalSchema,
      created_at: new Date('2026-01-01T00:00:00.000Z')
    };
    const restrictedDb = {
      webhook: { listWebhooks: vi.fn(async () => [webhook]) },
      catalog: {
        getSchema: vi.fn(async () => ({
          ...currentSchema,
          created_at: new Date('2026-08-01T00:00:00.000Z')
        })),
        listSchemaVersions: vi.fn(async () => [historicalVersion])
      },
      jobs: { enqueueOneOffRun }
    } as unknown as DatabaseAdapter;

    await enqueueWebhookDeliveries(restrictedDb, {
      id: 'audit-historical-1',
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
      changes: { new: { secret: 'historical-secret' } },
      metadata: {}
    });

    const payload = enqueueOneOffRun.mock.calls[0]![0].payload as { event: { changes: unknown } };
    expect(payload.event.changes).toEqual({ new: {} });
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
