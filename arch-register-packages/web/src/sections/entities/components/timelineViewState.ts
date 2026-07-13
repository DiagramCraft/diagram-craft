import type { EntityRecord, EntitySnapshot } from '@arch-register/api-types/entityContract';

export type TimelineGroupBy = 'owner' | 'type' | 'snapshot';

export type TimelineSchemaEntry = {
  schema: { name: string };
  index: number;
};

export type TimelineProjectLane = {
  projectId: string;
  snaps: EntitySnapshot[];
};

export const getOwnTimelineSnapshots = (snapshots: EntitySnapshot[]): EntitySnapshot[] =>
  snapshots
    .filter(snapshot => snapshot.status === 'autosave' || snapshot.status === 'saved_version')
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

export const groupTimelineSnapshotsByProject = (
  snapshots: EntitySnapshot[]
): TimelineProjectLane[] => {
  const byProject: Record<string, EntitySnapshot[]> = {};
  for (const snapshot of snapshots) {
    if (snapshot.project_id) (byProject[snapshot.project_id] ??= []).push(snapshot);
  }
  return Object.entries(byProject).map(([projectId, snaps]) => ({ projectId, snaps }));
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
