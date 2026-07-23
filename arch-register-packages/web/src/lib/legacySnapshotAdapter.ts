import type { EntitySnapshot } from '@arch-register/api-types/entityContract';
import type { EntityVersion } from '@arch-register/api-types/entityVersionContract';
import type { ChangeCase } from '@arch-register/api-types/changeCaseContract';

// Bridges the split entityVersions/changeCases APIs back into the EntitySnapshot shape that the
// timeline UI (TimelineView, EntityChangeHistoryTab, timelineViewState, snapshotDisplay) still
// renders. This is a deliberate, contained stopgap — see the follow-up issue tracking a native
// rewrite of those components against the split shapes directly.
const versionKindToSnapshotStatus = (kind: EntityVersion['kind']): EntitySnapshot['status'] => {
  switch (kind) {
    case 'saved_version':
      return 'saved_version';
    case 'case_applied':
      return 'applied';
    case 'deleted':
      return 'deleted';
    // 'autosave', 'direct_edit', 'restored', and 'bypass' all render as a plain autosave entry.
    default:
      return 'autosave';
  }
};

const versionToLegacySnapshot = (version: EntityVersion): EntitySnapshot => ({
  id: version.id,
  workspace: version.workspace,
  entity_id: version.entity_id,
  status: versionKindToSnapshotStatus(version.kind),
  project_id: null,
  target_date: null,
  milestone_id: null,
  commit_message: version.commit_message,
  created_at: version.created_at,
  created_by: version.created_by ?? '',
  created_by_name: version.created_by_name,
  base_state: version.state,
  proposed_state: null,
  case_id: null
});

const changeCaseToLegacySnapshots = (changeCase: ChangeCase, workspace: string): EntitySnapshot[] =>
  changeCase.members.map(member => ({
    id: member.id,
    workspace,
    entity_id: member.entity_id,
    status: changeCase.status === 'applied' ? 'applied' : 'future_update',
    project_id: changeCase.project_id,
    target_date: changeCase.target_date,
    milestone_id: changeCase.milestone_id,
    commit_message: changeCase.commit_message,
    created_at: changeCase.created_at,
    created_by: '',
    created_by_name: null,
    base_state: member.base_state,
    proposed_state: member.proposed_state,
    case_id: changeCase.id
  }));

const byCreatedAtDesc = (a: EntitySnapshot, b: EntitySnapshot) =>
  new Date(b.created_at).getTime() - new Date(a.created_at).getTime();

// planned_change cases only ever move planned -> applied or planned -> withdrawn; anything else
// (withdrawn, rejected, cancelled, superseded) is no longer live and shouldn't surface as a
// pending or applied timeline entry.
const isLiveChangeCase = (changeCase: ChangeCase) =>
  changeCase.status === 'planned' || changeCase.status === 'applied';

export const toLegacyEntitySnapshots = (
  workspace: string,
  entityId: string,
  versions: EntityVersion[],
  changeCases: ChangeCase[]
): EntitySnapshot[] =>
  [
    ...versions.map(versionToLegacySnapshot),
    ...changeCases
      .filter(isLiveChangeCase)
      .flatMap(changeCase => changeCaseToLegacySnapshots(changeCase, workspace))
  ]
    .filter(snapshot => snapshot.entity_id === entityId)
    .sort(byCreatedAtDesc);

export const toLegacyProjectSnapshots = (
  workspace: string,
  changeCases: ChangeCase[]
): EntitySnapshot[] =>
  changeCases
    .filter(isLiveChangeCase)
    .flatMap(changeCase => changeCaseToLegacySnapshots(changeCase, workspace))
    .sort(byCreatedAtDesc);
