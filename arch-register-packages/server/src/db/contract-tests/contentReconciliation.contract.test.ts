import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { runContractSuiteAgainstBothDrivers } from './harness';
import { createFixtureWorkspace } from '../testSupport/fixtures';

runContractSuiteAgainstBothDrivers('ContentReconciliationDatabase', getDb => {
  describe('content reconciliation', () => {
    it('persists an operation and advances it through resolution', async () => {
      const db = getDb();
      const workspace = await createFixtureWorkspace(db);
      const id = randomUUID();
      const now = new Date();
      const created = await db.contentReconciliation.createOperation({
        id,
        workspace,
        operation: 'test-write',
        scope: 'project',
        node_ids: ['node-1'],
        payload: { storageChanges: [] },
        next_attempt_at: now,
        created_at: now
      });

      expect(created.state).toBe('pending');
      expect(await db.contentReconciliation.listDueOperations(workspace, now, 10)).toHaveLength(1);

      const committed = await db.contentReconciliation.updateOperation(id, {
        state: 'database_committed',
        updated_at: now
      });
      expect(committed?.state).toBe('database_committed');

      const resolved = await db.contentReconciliation.updateOperation(id, {
        state: 'resolved',
        resolved_at: now,
        updated_at: now
      });
      expect(resolved?.state).toBe('resolved');
      expect((await db.contentReconciliation.summarize(workspace)).pending).toBe(0);
    });

    it('transitions only from an expected state and only when due', async () => {
      const db = getDb();
      const workspace = await createFixtureWorkspace(db);
      const id = randomUUID();
      const now = new Date();
      const later = new Date(now.getTime() + 60_000);
      await db.contentReconciliation.createOperation({
        id,
        workspace,
        operation: 'test-write',
        scope: 'project',
        node_ids: ['node-1'],
        payload: {},
        next_attempt_at: later,
        created_at: now
      });

      // Not due yet
      expect(
        await db.contentReconciliation.transitionOperation(
          id,
          { expectedStates: ['pending'], dueAt: now },
          { state: 'resolving', updated_at: now }
        )
      ).toBe(false);
      // Wrong state
      expect(
        await db.contentReconciliation.transitionOperation(
          id,
          { expectedStates: ['failed'] },
          { state: 'resolving', updated_at: now }
        )
      ).toBe(false);
      expect((await db.contentReconciliation.getOperation(id))?.state).toBe('pending');

      expect(
        await db.contentReconciliation.transitionOperation(
          id,
          { expectedStates: ['pending'], dueAt: later },
          { state: 'resolving', updated_at: now }
        )
      ).toBe(true);
      // The first owner won; a second claim fails
      expect(
        await db.contentReconciliation.transitionOperation(
          id,
          { expectedStates: ['pending'] },
          { state: 'database_committed', updated_at: now }
        )
      ).toBe(false);
    });
  });
});
