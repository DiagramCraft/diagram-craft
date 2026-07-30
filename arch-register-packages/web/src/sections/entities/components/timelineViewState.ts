import type {
  EntityRecord,
  TreeEdge,
  TreeNode,
  TimelineVersion,
  TimelineViewData
} from '@arch-register/api-types/entityContract';

export type TimelineGroupBy = 'owner' | 'type' | 'snapshot' | 'containment';

// A single project-scoped change-case entry as returned by the timeline summary endpoint (no
// entity state blobs — see snapshotDisplay.ts's ChangeCaseMemberEntry for the full-state variant
// used elsewhere).
export type TimelineChangeCaseEntry = TimelineViewData['projectChanges'][number];

export type TimelineSchemaEntry = {
  schema: { name: string };
  index: number;
};

export type TimelineProjectLane = {
  projectId: string;
  entries: TimelineChangeCaseEntry[];
};

// 'case_applied' and 'deleted' versions aren't rendered on the own-history lane — they surface
// via the project lanes (applied) or aren't shown at all (deleted).
const OWN_HISTORY_KINDS = new Set<TimelineVersion['kind']>([
  'autosave',
  'direct_edit',
  'restored',
  'bypass',
  'saved_version'
]);

export type OwnVersionDisplayStatus = 'saved_version' | 'autosave';

// 'direct_edit', 'restored', and 'bypass' all render as a plain autosave entry.
export const getOwnVersionDisplayStatus = (
  kind: TimelineVersion['kind']
): OwnVersionDisplayStatus => (kind === 'saved_version' ? 'saved_version' : 'autosave');

// Generic over the version shape so both the full EntityVersion (single-entity timeline tab) and
// the lighter TimelineVersion (browser-wide timeline view, no state blobs) can share this logic.
export const getOwnTimelineVersions = <V extends Pick<TimelineVersion, 'kind' | 'created_at'>>(
  versions: V[]
): V[] =>
  versions
    .filter(version => OWN_HISTORY_KINDS.has(version.kind))
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

export const filterOwnTimelineVersions = <V extends Pick<TimelineVersion, 'kind' | 'created_at'>>(
  versions: V[],
  showAutosaves: boolean
): V[] =>
  getOwnTimelineVersions(versions).filter(
    version => showAutosaves || getOwnVersionDisplayStatus(version.kind) !== 'autosave'
  );

export const groupChangeCaseEntriesByProject = (
  entries: TimelineChangeCaseEntry[]
): TimelineProjectLane[] => {
  const byProject: Record<string, TimelineChangeCaseEntry[]> = {};
  for (const entry of entries) {
    if (entry.changeCase.project_id) {
      (byProject[entry.changeCase.project_id] ??= []).push(entry);
    }
  }
  return Object.entries(byProject).map(([projectId, entries]) => ({ projectId, entries }));
};

export const getDatedTimelineRows = (
  rows: EntityRecord[],
  startFieldId: string | null,
  endFieldId: string | null,
  getDate: (entity: EntityRecord, fieldId: string | null) => Date | null
): EntityRecord[] =>
  rows.filter(entity => getDate(entity, startFieldId) ?? getDate(entity, endFieldId));

export const groupTimelineRows = (
  rows: EntityRecord[],
  groupBy: Exclude<TimelineGroupBy, 'snapshot'>,
  schemaMap: Map<string, TimelineSchemaEntry>,
  parentNameByUid?: Map<string, string>
): [string, EntityRecord[]][] => {
  const groups: Record<string, EntityRecord[]> = {};
  for (const entity of rows) {
    const key =
      groupBy === 'type'
        ? (schemaMap.get(entity._schema.id)?.schema.name ?? entity._schema.id)
        : groupBy === 'containment'
          ? (parentNameByUid?.get(entity._uid) ?? 'No parent')
          : (entity._owner?.name ?? 'Unassigned');
    (groups[key] ??= []).push(entity);
  }
  return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
};

// Reverse-direction lookup over the same nodes/edges the tree and map views use: for each
// child, resolve its containment parent's display name (falls back to nothing if the parent
// isn't present in `nodes`, e.g. filtered out).
export const buildContainmentParentNames = (
  nodes: TreeNode[],
  edges: TreeEdge[]
): Map<string, string> => {
  const nameByUid = new Map(nodes.map(n => [n._uid, n._name ?? n._slug]));
  const parentNameByChildUid = new Map<string, string>();
  for (const { childId, parentId } of edges) {
    const parentName = nameByUid.get(parentId);
    if (parentName) parentNameByChildUid.set(childId, parentName);
  }
  return parentNameByChildUid;
};

export const collectTimelineDates = (
  rows: EntityRecord[],
  startFieldId: string | null,
  endFieldId: string | null,
  getDate: (entity: EntityRecord, fieldId: string | null) => Date | null,
  fallbackDates: Date[] = []
): Date[] => {
  const dates: Date[] = [];
  for (const entity of rows) {
    const start = getDate(entity, startFieldId);
    const end = getDate(entity, endFieldId);
    if (start) dates.push(start);
    if (end) dates.push(end);
  }
  return [...dates, ...fallbackDates];
};
