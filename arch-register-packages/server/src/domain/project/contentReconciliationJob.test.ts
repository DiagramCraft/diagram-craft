import { describe, expect, it, vi } from 'vitest';
import type { DatabaseAdapter } from '../../db/database';
import type { RecoverableStorageAdapter } from '../../storage/storage.types';
import type {
  ContentReconciliationOperation,
  ContentReconciliationState
} from './db/contentReconciliationDatabase';
import { createContentReconciliationJobHandler } from './contentReconciliationJob';

const makeLedger = (state: ContentReconciliationState, committed: boolean) => {
  const row: ContentReconciliationOperation = {
    id: 'op-1',
    workspace: 'ws',
    operation: 'test',
    scope: 'scope',
    node_ids: ['n'],
    payload: {
      storageChanges: [
        { operationId: 'op-1', action: 'write', workspace: 'ws', projectId: 'p', fileId: 'n' }
      ],
      stages: [],
      completedStages: [],
      committed
    },
    state,
    attempt_count: 0,
    next_attempt_at: new Date(Date.now() - 1000),
    last_error: null,
    created_at: new Date(),
    updated_at: new Date(),
    resolved_at: null
  };
  const apply = (update: Partial<ContentReconciliationOperation>) => Object.assign(row, update);
  const contentReconciliation = {
    listDueOperations: async () => (row.next_attempt_at <= new Date() ? [{ ...row }] : []),
    getOperation: async () => row,
    updateOperation: async (_id: string, update: Partial<ContentReconciliationOperation>) =>
      apply(update),
    transitionOperation: async (
      _id: string,
      t: { expectedStates: string[]; dueAt?: Date },
      update: Partial<ContentReconciliationOperation>
    ) => {
      if (!t.expectedStates.includes(row.state)) return false;
      if (t.dueAt && row.next_attempt_at > t.dueAt) return false;
      apply(update);
      return true;
    },
    summarize: async () => ({
      pending: 0,
      database_committed: 0,
      resolving: 0,
      failed: 0,
      oldest_unresolved_at: null
    })
  };
  return { row, db: { contentReconciliation } as unknown as DatabaseAdapter };
};

const scan = (db: DatabaseAdapter, storage: RecoverableStorageAdapter) =>
  createContentReconciliationJobHandler(db, storage)({ workspace: 'ws' });

describe('contentReconciliationJob', () => {
  it('retries a failed rollback as a rollback and never finalizes', async () => {
    const { row, db } = makeLedger('pending', false);
    const reconcile = vi
      .fn()
      .mockRejectedValueOnce(new Error('disk busy'))
      .mockResolvedValue(undefined);
    const storage = { reconcile } as unknown as RecoverableStorageAdapter;

    await scan(db, storage);
    expect(row.state).toBe('failed');

    row.next_attempt_at = new Date(Date.now() - 1000);
    await scan(db, storage);

    expect(row.state).toBe('resolved');
    expect(reconcile.mock.calls.map(call => call[1])).toEqual(['rollback', 'rollback']);
  });

  it('rolls back a failed row that never reached database commit', async () => {
    const { row, db } = makeLedger('failed', false);
    const reconcile = vi.fn().mockResolvedValue(undefined);
    await scan(db, { reconcile } as unknown as RecoverableStorageAdapter);
    expect(reconcile.mock.calls.map(call => call[1])).toEqual(['rollback']);
    expect(row.state).toBe('resolved');
  });

  it('finalizes a failed row that was database committed', async () => {
    const { row, db } = makeLedger('failed', true);
    const reconcile = vi.fn().mockResolvedValue(undefined);
    await scan(db, { reconcile } as unknown as RecoverableStorageAdapter);
    expect(reconcile.mock.calls.map(call => call[1])).toEqual(['finalize']);
    expect(row.state).toBe('resolved');
  });

  it('does not touch a row whose writer lease has not expired', async () => {
    const { row, db } = makeLedger('pending', false);
    row.next_attempt_at = new Date(Date.now() + 60_000);
    const reconcile = vi.fn();
    await scan(db, { reconcile } as unknown as RecoverableStorageAdapter);
    expect(reconcile).not.toHaveBeenCalled();
    expect(row.state).toBe('pending');
  });

  it('passes scope-oriented names for legacy ledger rows', async () => {
    const { db } = makeLedger('pending', false);
    const reconcile = vi.fn().mockResolvedValue(undefined);
    await scan(db, { reconcile } as unknown as RecoverableStorageAdapter);
    expect(reconcile.mock.calls[0]![0]).toMatchObject({ scopeId: 'p', nodeId: 'n' });
  });
});
