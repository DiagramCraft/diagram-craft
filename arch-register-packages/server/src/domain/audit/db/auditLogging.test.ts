import { describe, expect, it, vi } from 'vitest';
import type { DatabaseAdapter } from '../../../db/database';
import { computeChanges, flattenEntityAuditFields, logAudit } from './auditLogging';
import { EntityDbCreate } from '../../catalog/db/catalogDatabase';

const { loggerError } = vi.hoisted(() => ({ loggerError: vi.fn() }));

vi.mock('../../../utils/logger', () => ({
  createLogger: () => ({ error: loggerError })
}));

const now = new Date('2026-06-08T10:00:00.000Z');

const makeEntity = (overrides: Partial<EntityDbCreate> = {}): EntityDbCreate => ({
  id: 'e-1',
  workspace: 'ws-1',
  public_id: 'ENT-1',
  slug: 'entity-1',
  namespace: 'default',
  name: 'Entity 1',
  description: 'Original description',
  owner: 'team-a',
  lifecycle: 'active',
  target_lifecycle: null,
  target_lifecycle_date: null,
  tags: ['core'],
  links: [{ url: 'https://example.com', title: 'Example' }],
  schema_id: 'schema-1',
  data: {
    region: 'eu',
    criticality: 'high'
  },
  project_id: null,
  created_at: now,
  updated_at: now,
  completeness: 0,
  ...overrides
});

const makeTransactionalDatabase = (events: string[], enqueueError?: Error) => {
  const auditLog = {
    id: 'audit-1',
    workspace: 'ws-1',
    timestamp: now,
    user_id: 'user-1',
    user_display_name: 'User 1',
    operation: 'create' as const,
    entity_type: 'entity' as const,
    entity_id: 'entity-1',
    entity_name: 'Entity 1',
    entity_slug: 'entity-1',
    schema_id: 'schema-1',
    changes: { new: { _name: 'Entity 1' } },
    metadata: {}
  };
  const audit = {
    createAuditLog: async () => {
      events.push('audit');
      return auditLog;
    }
  };
  const webhook = {
    listWebhooks: async () => [
      {
        id: 'webhook-1',
        workspace: 'ws-1',
        url: 'https://example.com/webhook',
        event_filter: { operations: ['create' as const], schema_ids: [] },
        hmac_secret: 'whsec_test',
        enabled: true,
        created_at: now,
        updated_at: now
      }
    ]
  };
  const jobs = {
    enqueueOneOffRun: async () => {
      events.push('job');
      if (enqueueError) throw enqueueError;
      return {};
    }
  };
  const watch = {
    createNotificationsFromAudit: async () => {
      events.push('notification');
    }
  };
  const tx = {
    core: { driver: 'sqlite' as const, isTransaction: true },
    audit,
    webhook,
    jobs,
    watch
  } as unknown as DatabaseAdapter;
  const db = {
    ...tx,
    core: {
      driver: 'sqlite' as const,
      transaction: async (callback: (db: DatabaseAdapter) => Promise<void>) => {
        events.push('begin');
        try {
          await callback(tx);
          events.push('commit');
        } catch (error) {
          events.push('rollback');
          throw error;
        }
      }
    }
  } as unknown as DatabaseAdapter;
  return db;
};

const entityAudit = {
  workspace: 'ws-1',
  userId: 'user-1',
  operation: 'create' as const,
  entityType: 'entity' as const,
  entityId: 'entity-1',
  entityName: 'Entity 1',
  entitySlug: 'entity-1',
  schemaId: 'schema-1',
  changes: { new: { _name: 'Entity 1' } }
};

describe('entity audit delivery', () => {
  it('inserts the audit row, webhook jobs, and notifications in one transaction', async () => {
    const events: string[] = [];

    await logAudit(makeTransactionalDatabase(events), entityAudit);

    expect(events).toEqual(['begin', 'audit', 'job', 'notification', 'commit']);
  });

  it('surfaces webhook enqueue failures instead of committing a silent audit-only change', async () => {
    const events: string[] = [];

    await expect(
      logAudit(makeTransactionalDatabase(events, new Error('queue unavailable')), entityAudit)
    ).rejects.toThrow('queue unavailable');
    expect(events).toEqual(['begin', 'audit', 'job', 'rollback']);
    expect(loggerError).toHaveBeenCalledOnce();
  });
});

describe('flattenEntityAuditFields', () => {
  it('exposes metadata and custom fields as a flat object', () => {
    const entity = makeEntity();

    expect(flattenEntityAuditFields(entity)).toEqual({
      _schemaId: 'schema-1',
      _name: 'Entity 1',
      _slug: 'entity-1',
      _namespace: 'default',
      _description: 'Original description',
      _owner: 'team-a',
      _lifecycle: 'active',
      _targetLifecycle: null,
      _targetLifecycleDate: null,
      _tags: ['core'],
      _links: [{ url: 'https://example.com', title: 'Example' }],
      _projectId: null,
      region: 'eu',
      criticality: 'high'
    });
  });
});

describe('computeChanges with flattened entity audit fields', () => {
  it('records only the custom field that changed', () => {
    const oldEntity = makeEntity();
    const newEntity = makeEntity({
      data: {
        region: 'us',
        criticality: 'high'
      }
    });

    expect(
      computeChanges(flattenEntityAuditFields(oldEntity), flattenEntityAuditFields(newEntity))
    ).toEqual({
      old: { region: 'eu' },
      new: { region: 'us' }
    });
  });

  it('records only the standard field that changed', () => {
    const oldEntity = makeEntity();
    const newEntity = makeEntity({ owner: 'team-b' });

    expect(
      computeChanges(flattenEntityAuditFields(oldEntity), flattenEntityAuditFields(newEntity))
    ).toEqual({
      old: { _owner: 'team-a' },
      new: { _owner: 'team-b' }
    });
  });

  it('records array fields when they actually change', () => {
    const oldEntity = makeEntity();
    const newEntity = makeEntity({ tags: ['core', 'payments'] });

    expect(
      computeChanges(flattenEntityAuditFields(oldEntity), flattenEntityAuditFields(newEntity))
    ).toEqual({
      old: { _tags: ['core'] },
      new: { _tags: ['core', 'payments'] }
    });
  });
});
