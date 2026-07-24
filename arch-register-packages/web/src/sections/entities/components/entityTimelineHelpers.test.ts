import { describe, expect, it } from 'vitest';
import type { ChangeCase, ChangeCaseMember } from '@arch-register/api-types/changeCaseContract';
import type { ChangeCaseMemberEntry } from './snapshotDisplay';
import { detectConflicts, diffSnapshotState } from './entityTimelineHelpers';

describe('diffSnapshotState', () => {
  it('returns no changes when proposed state is missing', () => {
    expect(diffSnapshotState({ name: 'A' }, undefined, null, [], [])).toEqual([]);
  });

  it('diffs built-in fields and schema data fields', () => {
    const changes = diffSnapshotState(
      { name: 'A', data: { technology: 'Java' } },
      { name: 'B', data: { technology: 'Kotlin' } },
      {
        id: 's',
        name: 'Service',
        fields: [{ id: 'technology', name: 'Technology', type: 'text' }]
      } as never,
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
      [{ id: 'l1', label: 'Active' } as never, { id: 'l2', label: 'Deprecated' } as never],
      []
    );
    expect(changes).toContainEqual({ label: 'Lifecycle', from: 'Active', to: 'Deprecated' });
  });

  it('does not report a change when both sides are differently-shaped empty values', () => {
    const changes = diffSnapshotState(
      { target_lifecycle: null, target_lifecycle_date: undefined, data: { apis: [] } },
      { target_lifecycle: '', target_lifecycle_date: null, data: { apis: null } },
      {
        id: 's',
        name: 'Service',
        fields: [{ id: 'apis', name: 'Provided APIs', type: 'text' }]
      } as never,
      [],
      []
    );
    expect(changes).toEqual([]);
  });
});

describe('detectConflicts', () => {
  const entry = (
    id: string,
    projectId: string,
    proposedState: Record<string, unknown>
  ): ChangeCaseMemberEntry => ({
    changeCase: { status: 'planned', project_id: projectId } as ChangeCase,
    member: { id, proposed_state: proposedState } as ChangeCaseMember
  });

  it('flags future entries that touch overlapping fields', () => {
    const a = entry('a', 'p1', { name: 'A' });
    const b = entry('b', 'p2', { name: 'B' });
    const { conflictedProjectIds, conflictedSnapIds } = detectConflicts([a, b]);
    expect(conflictedProjectIds).toEqual(new Set(['p1', 'p2']));
    expect(conflictedSnapIds).toEqual(new Set(['a', 'b']));
  });

  it('does not flag entries touching disjoint fields', () => {
    const a = entry('a', 'p1', { name: 'A' });
    const b = entry('b', 'p2', { description: 'B' });
    const { conflictedProjectIds, conflictedSnapIds } = detectConflicts([a, b]);
    expect(conflictedProjectIds.size).toBe(0);
    expect(conflictedSnapIds.size).toBe(0);
  });
});
