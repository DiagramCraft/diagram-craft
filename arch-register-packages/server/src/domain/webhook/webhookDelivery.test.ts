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
      catalog: {
        getEntity: vi.fn(async (_workspace: string, id: string) => ({
          id,
          schema_id: id === 'entity-1' ? 'entity-schema-in' : 'entity-schema-out'
        })),
        getSchema: vi.fn(async () => ({
          fields: [],
          groups: [],
          created_at: new Date('2026-01-01')
        })),
        listSchemaVersions: vi.fn(async () => [])
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

  it('omits relation endpoint context when historical owner fields are inaccessible', async () => {
    const enqueueOneOffRun = vi.fn(async input => ({ ...input }));
    const relationSchema: FieldGroupSchemaShape = {
      fields: [{ id: 'status', name: 'Status' }],
      groups: []
    };
    const historicalOwnerSchema: FieldGroupSchemaShape = {
      fields: [
        {
          id: 'dependsOnIn',
          name: 'Depends on (in)',
          type: 'typedRelation',
          relationSchemaId: 'relation-schema-1',
          direction: 'in',
          groupId: 'restricted'
        } as never,
        {
          id: 'dependsOnOut',
          name: 'Depends on (out)',
          type: 'typedRelation',
          relationSchemaId: 'relation-schema-1',
          direction: 'out',
          groupId: 'restricted'
        } as never
      ],
      groups: [{ id: 'restricted', accessControl: { teamIds: ['team-1'] } } as never]
    };
    const ownerSchemaVersion = {
      ...historicalOwnerSchema,
      created_at: new Date('2026-01-01T00:00:00.000Z')
    };
    const enqueueDb = {
      webhook: {
        listWebhooks: vi.fn(async () => [
          {
            ...webhook,
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
      catalog: {
        getEntity: vi.fn(async (_workspace: string, id: string) => ({
          id,
          schema_id: id === 'entity-1' ? 'entity-schema-in' : 'entity-schema-out'
        })),
        getSchema: vi.fn(async () => ({
          ...historicalOwnerSchema,
          fields: historicalOwnerSchema.fields.map(field => ({ ...field, groupId: undefined })),
          groups: [],
          created_at: new Date('2026-08-01T00:00:00.000Z')
        })),
        listSchemaVersions: vi.fn(async () => [ownerSchemaVersion])
      },
      jobs: { enqueueOneOffRun }
    } as unknown as DatabaseAdapter;

    await enqueueWebhookDeliveries(enqueueDb, {
      id: 'relation-audit-hidden-endpoints',
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
        old: { status: 'draft' },
        new: { status: 'active' }
      },
      metadata: {
        source: 'test',
        relation: {
          id: 'relation-1',
          schema: { id: 'relation-schema-1', name: 'Depends on' },
          in: { id: 'entity-1', name: 'Payments' },
          out: { id: 'entity-2', name: 'Ledger' }
        }
      }
    });

    const payload = enqueueOneOffRun.mock.calls[0]![0].payload as {
      event: { relation?: unknown; metadata: Record<string, unknown>; changes: unknown };
    };
    expect(payload.event.relation).toBeUndefined();
    expect(payload.event.metadata).toEqual({ source: 'test' });
    expect(payload.event.changes).toEqual({
      old: { status: 'draft' },
      new: { status: 'active' }
    });
  });

  it('fails closed when one relation endpoint schema is missing', () => {
    const relationAudit = {
      id: 'relation-audit-missing-endpoint-schema',
      workspace: 'ws-1',
      timestamp: new Date('2026-07-15T10:00:00.000Z'),
      user_id: 'user-1',
      user_display_name: 'Ada',
      operation: 'update' as const,
      entity_type: 'relation' as const,
      entity_id: 'relation-1',
      entity_name: 'Payments → Ledger',
      entity_slug: null,
      schema_id: 'relation-schema-1',
      changes: { new: { status: 'active' } },
      metadata: {
        relation: {
          id: 'relation-1',
          schema: { id: 'relation-schema-1', name: 'Depends on' },
          in: { id: 'entity-1', name: 'Payments' },
          out: { id: 'entity-2', name: 'Ledger' }
        }
      }
    };
    const unboundEndpointSchema: FieldGroupSchemaShape = { fields: [], groups: [] };

    const event = auditLogToWebhookEvent(relationAudit, null, null, {
      in: null,
      out: unboundEndpointSchema
    });

    expect(event).not.toHaveProperty('relation');
    expect(event.metadata).not.toHaveProperty('relation');
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

  it('strips field values whose group reference is dangling', async () => {
    const enqueueOneOffRun = vi.fn(async input => ({ ...input }));
    const legacySchema: FieldGroupSchemaShape = {
      fields: [
        { id: '_name', name: 'Name' } as never,
        { id: 'secret', name: 'Secret', groupId: 'deleted-group' } as never
      ]
    };
    const restrictedDb = {
      webhook: { listWebhooks: vi.fn(async () => [webhook]) },
      catalog: {
        getSchema: vi.fn(async () => ({ ...legacySchema, created_at: new Date('2026-01-01') })),
        listSchemaVersions: vi.fn(async () => [])
      },
      jobs: { enqueueOneOffRun }
    } as unknown as DatabaseAdapter;

    await enqueueWebhookDeliveries(restrictedDb, {
      id: 'audit-dangling-group',
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
      changes: { new: { _name: 'Payments', secret: 'must-not-escape' } },
      metadata: {}
    });

    const payload = enqueueOneOffRun.mock.calls[0]![0].payload as { event: { changes: unknown } };
    expect(payload.event.changes).toEqual({ new: { _name: 'Payments' } });
  });

  it('hides relation context when its owner field has a dangling group reference', () => {
    const ownerSchema: FieldGroupSchemaShape = {
      fields: [
        {
          id: 'dependsOn',
          name: 'Depends on',
          type: 'typedRelation',
          relationSchemaId: 'relation-schema-1',
          direction: 'in',
          groupId: 'deleted-group'
        } as never
      ],
      groups: []
    };
    const relationEvent = auditLogToWebhookEvent(
      {
        id: 'relation-audit-dangling-group',
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
        changes: { new: { status: 'active' } },
        metadata: {
          relation: {
            id: 'relation-1',
            schema: { id: 'relation-schema-1', name: 'Depends on' },
            in: { id: 'entity-1', name: 'Payments' },
            out: { id: 'entity-2', name: 'Ledger' }
          }
        }
      },
      { fields: [{ id: 'status', name: 'Status' }], groups: [] },
      null,
      { in: ownerSchema, out: null }
    );

    expect(relationEvent.relation).toBeUndefined();
    expect(relationEvent.metadata).toEqual({});
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
