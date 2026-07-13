import { ORPCError } from '@orpc/server';
import { describe, expect, it } from 'vitest';
import type { EntitySnapshotDbResult } from './db/catalogDatabase';
import { assertSnapshotCanBeRestored, serializeEntitySnapshot } from './entitySnapshotOperations';

const snapshot = (overrides: Partial<EntitySnapshotDbResult> = {}) =>
  ({
    id: 'snapshot-1',
    workspace: 'workspace-1',
    entity_id: 'entity-1',
    status: 'saved_version',
    project_id: null,
    target_date: null,
    commit_message: null,
    created_at: new Date('2026-07-05T12:00:00Z'),
    created_by: 'user-1',
    created_by_name: 'User One',
    base_state: {},
    proposed_state: null,
    ...overrides
  }) as EntitySnapshotDbResult;

describe('entity snapshot operations', () => {
  it('serializes snapshot dates', () => {
    expect(
      serializeEntitySnapshot(snapshot({ target_date: new Date('2026-08-09') as never }))
    ).toMatchObject({
      created_at: '2026-07-05T12:00:00.000Z',
      target_date: '2026-08-09'
    });
  });

  it('allows only snapshots belonging to the entity in a restorable state', () => {
    expect(() => assertSnapshotCanBeRestored(snapshot(), 'entity-1')).not.toThrow();
    expect(() => assertSnapshotCanBeRestored(snapshot(), 'entity-2')).toThrow(ORPCError);
    expect(() =>
      assertSnapshotCanBeRestored(snapshot({ status: 'future_update' }), 'entity-1')
    ).toThrow(ORPCError);
  });
});
