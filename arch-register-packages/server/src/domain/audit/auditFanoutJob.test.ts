import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DatabaseAdapter } from '../../db/database';
import { RetryableJobError } from '../jobs/jobRetry';
import { createAuditFanoutJobHandler } from './auditFanoutJob';

const mocks = vi.hoisted(() => ({
  enqueueWebhookDeliveries: vi.fn(),
  enqueueAutomationRuleRuns: vi.fn(),
  createAuditWatcherNotifications: vi.fn()
}));

const { enqueueWebhookDeliveries, enqueueAutomationRuleRuns, createAuditWatcherNotifications } =
  mocks;

vi.mock('../webhook/webhookDelivery', () => ({
  enqueueWebhookDeliveries: mocks.enqueueWebhookDeliveries
}));
vi.mock('../automation/automationRuleEvaluation', () => ({
  enqueueAutomationRuleRuns: mocks.enqueueAutomationRuleRuns
}));
vi.mock('./auditWatcherNotifications', () => ({
  createAuditWatcherNotifications: mocks.createAuditWatcherNotifications
}));

const auditLog = {
  id: 'audit-1',
  workspace: 'ws-1',
  timestamp: new Date('2026-01-01T00:00:00.000Z'),
  user_id: 'user-1',
  user_display_name: 'User 1',
  operation: 'update' as const,
  entity_type: 'entity' as const,
  entity_id: 'entity-1',
  entity_name: 'Entity 1',
  entity_slug: 'entity-1',
  schema_id: 'schema-1',
  changes: { new: { name: 'updated' } },
  metadata: {}
};

const makeDb = (overrides: Partial<DatabaseAdapter> = {}) => {
  const tx = {
    core: { driver: 'sqlite' as const, isTransaction: true },
    ...overrides
  } as unknown as DatabaseAdapter;
  return {
    ...tx,
    core: {
      driver: 'sqlite' as const,
      transaction: vi.fn(async (callback: (db: DatabaseAdapter) => Promise<unknown>) =>
        callback(tx)
      )
    }
  } as unknown as DatabaseAdapter;
};

describe('audit fan-out job', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    enqueueWebhookDeliveries.mockResolvedValue(2);
    enqueueAutomationRuleRuns.mockResolvedValue(3);
    createAuditWatcherNotifications.mockResolvedValue(undefined);
  });

  it('loads the immutable audit row and fans out all downstream effects in one transaction', async () => {
    const db = makeDb({
      audit: { getAuditLog: vi.fn(async () => auditLog) } as never
    });
    const handler = createAuditFanoutJobHandler(db);

    await expect(
      handler({
        workspace: 'ws-1',
        payload: { auditLogId: 'audit-1', watcherUserIds: ['watcher-1'] }
      })
    ).resolves.toEqual({ webhookCount: 2, automationCount: 3 });

    expect(enqueueWebhookDeliveries).toHaveBeenCalledWith(expect.anything(), auditLog);
    expect(enqueueAutomationRuleRuns).toHaveBeenCalledWith(
      expect.anything(),
      auditLog,
      auditLog.metadata
    );
    expect(createAuditWatcherNotifications).toHaveBeenCalledWith(expect.anything(), auditLog, [
      'watcher-1'
    ]);
  });

  it('skips invalid and missing audit payloads', async () => {
    const getAuditLog = vi.fn(async () => null);
    const db = makeDb({ audit: { getAuditLog } as never });
    const handler = createAuditFanoutJobHandler(db);

    await expect(handler({ workspace: 'ws-1', payload: {} })).resolves.toEqual({
      skipped: true,
      reason: 'invalid-payload'
    });
    await expect(
      handler({ workspace: 'ws-1', payload: { auditLogId: 'missing' } })
    ).resolves.toEqual({ skipped: true, reason: 'audit-log-not-found' });
  });

  it('converts downstream failures into retryable job errors', async () => {
    const db = makeDb({
      audit: { getAuditLog: vi.fn(async () => auditLog) } as never
    });
    enqueueWebhookDeliveries.mockRejectedValueOnce(new Error('database unavailable'));
    const handler = createAuditFanoutJobHandler(db);

    await expect(
      handler({ workspace: 'ws-1', payload: { auditLogId: 'audit-1' } })
    ).rejects.toBeInstanceOf(RetryableJobError);
  });
});
