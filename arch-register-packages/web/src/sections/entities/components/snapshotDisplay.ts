import type { EntitySnapshot } from '@arch-register/api-types/entityContract';
import type { Milestone } from '@arch-register/api-types/milestoneContract';

// A future_update snapshot targets either a raw target_date or a milestone (never both) — the
// milestone's target_date is its effective date. These helpers centralize that resolution so
// every display site (timeline dots, detail panels, dialogs) treats the two the same way.

export const getSnapshotEffectiveDate = (
  snapshot: Pick<EntitySnapshot, 'target_date' | 'milestone_id'>,
  milestonesById: Map<string, Milestone>
): string | null =>
  snapshot.target_date ??
  (snapshot.milestone_id != null
    ? (milestonesById.get(snapshot.milestone_id)?.target_date ?? null)
    : null);

export const getSnapshotDateLabel = (
  snapshot: Pick<EntitySnapshot, 'target_date' | 'milestone_id'>,
  milestonesById: Map<string, Milestone>
): string | null => {
  if (snapshot.milestone_id != null) {
    const milestone = milestonesById.get(snapshot.milestone_id);
    return milestone ? `${milestone.name} (${milestone.target_date})` : null;
  }
  return snapshot.target_date;
};

export const toMilestonesById = (milestones: Milestone[]): Map<string, Milestone> =>
  new Map(milestones.map(m => [m.id, m]));
