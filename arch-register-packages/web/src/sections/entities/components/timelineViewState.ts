import type { EntityRecord } from '@arch-register/api-types/entityContract';
import type { EntityVersion } from '@arch-register/api-types/entityVersionContract';
import type { ChangeCaseMemberEntry } from './snapshotDisplay';

export type TimelineGroupBy = 'owner' | 'type' | 'snapshot';

export type TimelineSchemaEntry = {
  schema: { name: string };
  index: number;
};

export type TimelineProjectLane = {
  projectId: string;
  entries: ChangeCaseMemberEntry[];
};

// 'case_applied' and 'deleted' versions aren't rendered on the own-history lane — they surface
// via the project lanes (applied) or aren't shown at all (deleted).
const OWN_HISTORY_KINDS = new Set<EntityVersion['kind']>([
  'autosave',
  'direct_edit',
  'restored',
  'bypass',
  'saved_version'
]);

export type OwnVersionDisplayStatus = 'saved_version' | 'autosave';

// 'direct_edit', 'restored', and 'bypass' all render as a plain autosave entry.
export const getOwnVersionDisplayStatus = (kind: EntityVersion['kind']): OwnVersionDisplayStatus =>
  kind === 'saved_version' ? 'saved_version' : 'autosave';

export const getOwnTimelineVersions = (versions: EntityVersion[]): EntityVersion[] =>
  versions
    .filter(version => OWN_HISTORY_KINDS.has(version.kind))
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

export const groupChangeCaseEntriesByProject = (
  entries: ChangeCaseMemberEntry[]
): TimelineProjectLane[] => {
  const byProject: Record<string, ChangeCaseMemberEntry[]> = {};
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
  schemaMap: Map<string, TimelineSchemaEntry>
): [string, EntityRecord[]][] => {
  const groups: Record<string, EntityRecord[]> = {};
  for (const entity of rows) {
    const key =
      groupBy === 'type'
        ? (schemaMap.get(entity._schema.id)?.schema.name ?? entity._schema.id)
        : (entity._owner?.name ?? 'Unassigned');
    (groups[key] ??= []).push(entity);
  }
  return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
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
