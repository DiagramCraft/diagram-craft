import type { DatabaseAdapter } from '../../db/database';
import type { StorageAdapter, StorageReconciliationOperation } from '../../storage/storage.types';
import { createLogger } from '../../utils/logger';
import { createJobSchedule } from '../jobs/jobOperations';

export const CONTENT_RECONCILIATION_SCAN_JOB_TYPE = 'content-reconciliation.scan';
export const CONTENT_RECONCILIATION_SCAN_SYSTEM_IDENTITY = 'content-reconciliation';
export const CONTENT_RECONCILIATION_SCAN_INTERVAL_MINUTES = 1;

const logger = createLogger('content-reconciliation');

export const ensureContentReconciliationSchedule = async (
  db: DatabaseAdapter,
  workspace: string,
  now = new Date()
) => {
  const schedules = await db.jobs.listSchedules(workspace);
  const existing = schedules.find(
    schedule => schedule.job_type === CONTENT_RECONCILIATION_SCAN_JOB_TYPE
  );
  if (existing) return existing;
  return createJobSchedule(
    db,
    {
      workspace,
      jobType: CONTENT_RECONCILIATION_SCAN_JOB_TYPE,
      systemIdentity: CONTENT_RECONCILIATION_SCAN_SYSTEM_IDENTITY,
      payload: {},
      priority: 2,
      recurrence: {
        type: 'minutes',
        intervalMinutes: CONTENT_RECONCILIATION_SCAN_INTERVAL_MINUTES,
        startsAt: now
      }
    },
    now
  );
};

export const ensureAllContentReconciliationSchedules = async (
  db: DatabaseAdapter,
  now = new Date()
) => {
  for (const workspace of await db.workspace.listWorkspaces()) {
    await ensureContentReconciliationSchedule(db, workspace.id, now);
  }
};

const retryAt = (attempt: number) =>
  new Date(Date.now() + Math.min(60 * 60_000, Math.max(60_000, 2 ** attempt * 60_000)));

const reconcileOperation = async (
  db: DatabaseAdapter,
  storage: StorageAdapter,
  operation: Awaited<ReturnType<DatabaseAdapter['contentReconciliation']['getOperation']>>
) => {
  if (!operation) return 'missing';
  const payload = operation.payload as {
    storageChanges?: StorageReconciliationOperation[];
    stages?: string[];
    completedStages?: string[];
  };
  const changes = payload.storageChanges ?? [];

  try {
    if (operation.state === 'pending') {
      for (const change of [...changes].reverse()) await storage.reconcile!(change, 'rollback');
      await db.contentReconciliation.updateOperation(operation.id, {
        state: 'resolved',
        last_error: null,
        resolved_at: new Date(),
        updated_at: new Date()
      });
      return 'rolled_back';
    }

    for (const change of changes) await storage.reconcile!(change, 'finalize');
    const stages = payload.stages ?? [];
    const completedStages = payload.completedStages ?? [];
    if (completedStages.length === stages.length) {
      await db.contentReconciliation.updateOperation(operation.id, {
        state: 'resolved',
        last_error: null,
        resolved_at: new Date(),
        updated_at: new Date()
      });
      return 'resolved';
    }

    await db.contentReconciliation.updateOperation(operation.id, {
      state: 'failed',
      attempt_count: operation.attempt_count + 1,
      next_attempt_at: retryAt(operation.attempt_count),
      updated_at: new Date()
    });
    return 'stage_pending';
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await db.contentReconciliation.updateOperation(operation.id, {
      state: 'failed',
      attempt_count: operation.attempt_count + 1,
      next_attempt_at: retryAt(operation.attempt_count),
      last_error: message,
      updated_at: new Date()
    });
    logger.error('Content reconciliation failed', {
      operationId: operation.id,
      operation: operation.operation,
      state: operation.state,
      attempt: operation.attempt_count + 1,
      error: message
    });
    return 'failed';
  }
};

export const createContentReconciliationJobHandler =
  (db: DatabaseAdapter, storage: StorageAdapter) =>
  async (context: { workspace: string; signal?: AbortSignal }) => {
    const operations = await db.contentReconciliation.listDueOperations(
      context.workspace,
      new Date(),
      100
    );
    const counts = { scanned: operations.length, rolledBack: 0, resolved: 0, failed: 0 };
    for (const operation of operations) {
      if (context.signal?.aborted) break;
      const outcome = await reconcileOperation(db, storage, operation);
      if (outcome === 'rolled_back') counts.rolledBack++;
      else if (outcome === 'resolved') counts.resolved++;
      else if (outcome === 'failed') counts.failed++;
    }
    const summary = await db.contentReconciliation.summarize(context.workspace);
    logger.info('Content reconciliation scan', {
      workspace: context.workspace,
      ...counts,
      pending: summary.pending,
      databaseCommitted: summary.database_committed,
      resolving: summary.resolving,
      failedOperations: summary.failed,
      oldestUnresolvedAt: summary.oldest_unresolved_at?.toISOString() ?? null
    });
    return counts;
  };
