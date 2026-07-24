import type { ChangeCase, ChangeCaseMember } from '@arch-register/api-types/changeCaseContract';
import type { Milestone } from '@arch-register/api-types/milestoneContract';

// A change case's members are the individual entities affected by a planned/applied change.
// The timeline UI renders one entry per member, carrying the parent case's date/status metadata.
export type ChangeCaseMemberEntry = {
  changeCase: ChangeCase;
  member: ChangeCaseMember;
};

// planned_change cases only ever move planned -> applied or planned -> withdrawn; anything else
// (withdrawn, rejected, cancelled, superseded) is no longer live and shouldn't surface as a
// pending or applied timeline entry.
const isLiveChangeCase = (changeCase: ChangeCase) =>
  changeCase.status === 'planned' || changeCase.status === 'applied';

export const flattenChangeCaseMembers = (changeCases: ChangeCase[]): ChangeCaseMemberEntry[] =>
  changeCases
    .filter(isLiveChangeCase)
    .flatMap(changeCase => changeCase.members.map(member => ({ changeCase, member })));

// A change case targets either a raw target_date or a milestone (never both) — the milestone's
// target_date is its effective date. These helpers centralize that resolution so every display
// site (timeline dots, detail panels, dialogs) treats the two the same way.

export const getSnapshotEffectiveDate = (
  changeCase: Pick<ChangeCase, 'target_date' | 'milestone_id'>,
  milestonesById: Map<string, Milestone>
): string | null =>
  changeCase.target_date ??
  (changeCase.milestone_id != null
    ? (milestonesById.get(changeCase.milestone_id)?.target_date ?? null)
    : null);

export const getSnapshotDateLabel = (
  changeCase: Pick<ChangeCase, 'target_date' | 'milestone_id'>,
  milestonesById: Map<string, Milestone>
): string | null => {
  if (changeCase.milestone_id != null) {
    const milestone = milestonesById.get(changeCase.milestone_id);
    return milestone ? `${milestone.name} (${milestone.target_date})` : null;
  }
  return changeCase.target_date;
};

export const toMilestonesById = (milestones: Milestone[]): Map<string, Milestone> =>
  new Map(milestones.map(m => [m.id, m]));
