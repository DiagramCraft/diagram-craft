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
    // target_date is normalized to a "YYYY-MM-DD" string by the DB row mapper (databaseDateOnly),
    // not here — this just checks created_at gets ISO-serialized and target_date passes through.
    expect(serializeEntitySnapshot(snapshot({ target_date: '2026-08-09' }))).toMatchObject({
      created_at: '2026-07-05T12:00:00.000Z',
      target_date: '2026-08-09'
    });
  });

  it('defaults case_id to null when the DB row omitted it', () => {
    expect(serializeEntitySnapshot(snapshot())).toMatchObject({ case_id: null });
    expect(serializeEntitySnapshot(snapshot({ case_id: 'case-1' }))).toMatchObject({
      case_id: 'case-1'
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
