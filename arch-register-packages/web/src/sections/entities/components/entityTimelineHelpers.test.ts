import { describe, expect, it } from 'vitest';
import type { EntitySnapshot } from '@arch-register/api-types/entityContract';
import { detectConflicts, diffSnapshotState } from './entityTimelineHelpers';

describe('diffSnapshotState', () => {
  it('returns no changes when proposed state is missing', () => {
    expect(diffSnapshotState({ name: 'A' }, undefined, null, [], [])).toEqual([]);
  });

  it('diffs built-in fields and schema data fields', () => {
    const changes = diffSnapshotState(
      { name: 'A', data: { technology: 'Java' } },
      { name: 'B', data: { technology: 'Kotlin' } },
      { id: 's', name: 'Service', fields: [{ id: 'technology', name: 'Technology', type: 'text' }] } as never,
      [],
      []
    );
    expect(changes).toContainEqual({ label: 'Name', from: 'A', to: 'B' });
    expect(changes).toContainEqual({ label: 'Technology', from: 'Java', to: 'Kotlin' });
  });

  it('resolves lifecycle and owner ids to labels', () => {
    const changes = diffSnapshotState(
      { lifecycle: 'l1' },
      { lifecycle: 'l2' },
      null,
      [
        { id: 'l1', label: 'Active' } as never,
        { id: 'l2', label: 'Deprecated' } as never
      ],
      []
    );
    expect(changes).toContainEqual({ label: 'Lifecycle', from: 'Active', to: 'Deprecated' });
  });
});

describe('detectConflicts', () => {
  const snap = (overrides: Partial<EntitySnapshot>): EntitySnapshot =>
    ({
      id: 'id',
      status: 'future_update',
      project_id: 'p1',
      proposed_state: {},
      ...overrides
    }) as EntitySnapshot;

  it('flags future snapshots that touch overlapping fields', () => {
    const a = snap({ id: 'a', project_id: 'p1', proposed_state: { name: 'A' } });
    const b = snap({ id: 'b', project_id: 'p2', proposed_state: { name: 'B' } });
    const { conflictedProjectIds, conflictedSnapIds } = detectConflicts([a, b]);
    expect(conflictedProjectIds).toEqual(new Set(['p1', 'p2']));
    expect(conflictedSnapIds).toEqual(new Set(['a', 'b']));
  });

  it('does not flag snapshots touching disjoint fields', () => {
    const a = snap({ id: 'a', project_id: 'p1', proposed_state: { name: 'A' } });
    const b = snap({ id: 'b', project_id: 'p2', proposed_state: { description: 'B' } });
    const { conflictedProjectIds, conflictedSnapIds } = detectConflicts([a, b]);
    expect(conflictedProjectIds.size).toBe(0);
    expect(conflictedSnapIds.size).toBe(0);
  });
});
