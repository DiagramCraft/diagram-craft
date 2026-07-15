import { describe, expect, it } from 'vitest';
import type { EntityRecord, EntitySnapshot } from '@arch-register/api-types/entityContract';
import {
  collectTimelineDates,
  getDatedTimelineRows,
  getOwnTimelineSnapshots,
  groupTimelineRows,
  groupTimelineSnapshotsByProject
} from './timelineViewState';

const entity = (id: string, start?: Date, end?: Date, owner?: string): EntityRecord =>
  ({
    _uid: id,
    _publicId: id,
    _name: id,
    _slug: id,
    _schema: { id: 'service', name: 'Service' },
    _owner: owner ? { id: owner, name: owner } : null,
    _lifecycle: null,
    start,
    end
  }) as unknown as EntityRecord;

const snapshot = (
  id: string,
  status: EntitySnapshot['status'],
  createdAt: string,
  projectId?: string
) => ({ id, status, created_at: createdAt, project_id: projectId }) as unknown as EntitySnapshot;

describe('timeline view state', () => {
  it('filters and sorts own history snapshots', () => {
    const snapshots = [
      snapshot('saved', 'saved_version', '2024-02-01T00:00:00Z'),
      snapshot('future', 'future_update', '2024-01-01T00:00:00Z'),
      snapshot('auto', 'autosave', '2024-01-01T12:00:00Z')
    ];
    expect(getOwnTimelineSnapshots(snapshots).map(item => item.id)).toEqual(['auto', 'saved']);
  });

  it('groups project snapshots while preserving lane order', () => {
    const snapshots = [
      snapshot('a', 'future_update', '2024-01-01T00:00:00Z', 'p1'),
      snapshot('b', 'future_update', '2024-01-02T00:00:00Z'),
      snapshot('c', 'future_update', '2024-01-03T00:00:00Z', 'p1')
    ];
    expect(groupTimelineSnapshotsByProject(snapshots)).toEqual([
      { projectId: 'p1', snaps: [snapshots[0], snapshots[2]] }
    ]);
  });

  it('filters dated rows, groups them, and collects both date fields', () => {
    const rows = [
      entity('b', new Date('2024-02-01'), undefined, 'Zed'),
      entity('a', undefined, new Date('2024-01-01'), 'Amy'),
      entity('empty')
    ];
    const getDate = (row: EntityRecord, fieldId: string | null) =>
      fieldId && row[fieldId] instanceof Date ? (row[fieldId] as Date) : null;

    expect(getDatedTimelineRows(rows, 'start', 'end', getDate).map(row => row._uid)).toEqual([
      'b',
      'a'
    ]);
    expect(groupTimelineRows(rows.slice(0, 2), 'owner', new Map())).toEqual([
      ['Amy', [rows[1]]],
      ['Zed', [rows[0]]]
    ]);
    expect(
      collectTimelineDates(rows, 'start', 'end', getDate, [new Date('2020-01-01')]).map(date =>
        date.toISOString()
      )
    ).toEqual(['2024-02-01T00:00:00.000Z', '2024-01-01T00:00:00.000Z', '2020-01-01T00:00:00.000Z']);
  });
});
