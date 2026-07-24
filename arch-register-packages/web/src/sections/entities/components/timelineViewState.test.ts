import { describe, expect, it } from 'vitest';
import type { EntityRecord } from '@arch-register/api-types/entityContract';
import type { EntityVersion } from '@arch-register/api-types/entityVersionContract';
import type { ChangeCase, ChangeCaseMember } from '@arch-register/api-types/changeCaseContract';
import type { ChangeCaseMemberEntry } from './snapshotDisplay';
import {
  collectTimelineDates,
  getDatedTimelineRows,
  getOwnTimelineVersions,
  groupTimelineRows,
  groupChangeCaseEntriesByProject
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

const version = (id: string, kind: EntityVersion['kind'], createdAt: string) =>
  ({ id, kind, created_at: createdAt }) as unknown as EntityVersion;

const changeCaseEntry = (
  id: string,
  createdAt: string,
  projectId?: string
): ChangeCaseMemberEntry => ({
  changeCase: { project_id: projectId ?? null, created_at: createdAt } as ChangeCase,
  member: { id } as ChangeCaseMember
});

describe('timeline view state', () => {
  it('filters and sorts own history versions', () => {
    const versions = [
      version('saved', 'saved_version', '2024-02-01T00:00:00Z'),
      version('deleted', 'deleted', '2024-01-01T00:00:00Z'),
      version('auto', 'autosave', '2024-01-01T12:00:00Z')
    ];
    expect(getOwnTimelineVersions(versions).map(item => item.id)).toEqual(['auto', 'saved']);
  });

  it('groups change case entries while preserving lane order', () => {
    const entries = [
      changeCaseEntry('a', '2024-01-01T00:00:00Z', 'p1'),
      changeCaseEntry('b', '2024-01-02T00:00:00Z'),
      changeCaseEntry('c', '2024-01-03T00:00:00Z', 'p1')
    ];
    expect(groupChangeCaseEntriesByProject(entries)).toEqual([
      { projectId: 'p1', entries: [entries[0], entries[2]] }
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
