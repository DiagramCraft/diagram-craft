import { describe, expect, it } from 'vitest';
import type { EntitySnapshot } from '@arch-register/api-types/entityContract';
import type { Milestone } from '@arch-register/api-types/milestoneContract';
import { getSnapshotDateLabel, getSnapshotEffectiveDate } from './snapshotDisplay';

const snapshot = (overrides: Partial<EntitySnapshot>): EntitySnapshot =>
  ({
    target_date: null,
    milestone_id: null,
    ...overrides
  }) as EntitySnapshot;

const milestone = (overrides: Partial<Milestone> = {}): Milestone =>
  ({
    id: 'm1',
    name: 'Launch',
    project_id: 'p1',
    target_date: '2026-06-01',
    ...overrides
  }) as Milestone;

describe('snapshotDisplay', () => {
  it('prefers a raw target date when present', () => {
    const snap = snapshot({ target_date: '2026-05-01' });
    const milestones = new Map([['m1', milestone()]]);

    expect(getSnapshotEffectiveDate(snap, milestones)).toBe('2026-05-01');
    expect(getSnapshotDateLabel(snap, milestones)).toBe('2026-05-01');
  });

  it('resolves milestone-backed snapshots to the milestone date and label', () => {
    const snap = snapshot({ milestone_id: 'm1' });
    const milestones = new Map([['m1', milestone()]]);

    expect(getSnapshotEffectiveDate(snap, milestones)).toBe('2026-06-01');
    expect(getSnapshotDateLabel(snap, milestones)).toBe('Launch (2026-06-01)');
  });

  it('returns no date when the referenced milestone is missing', () => {
    const snap = snapshot({ milestone_id: 'missing' });

    expect(getSnapshotEffectiveDate(snap, new Map())).toBeNull();
    expect(getSnapshotDateLabel(snap, new Map())).toBeNull();
  });
});
