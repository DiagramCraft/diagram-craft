import { describe, expect, it, vi } from 'vitest';
import type { DatabaseAdapter } from '../../db/database';
import type { Entity } from './db/catalogDatabase';
import type { ChangeCaseMemberDbResult, ChangeCaseRevisionDbResult } from './db/changeCaseDatabase';
import type { RelationDbResult } from './db/relationDatabase';
import {
  assertChangeCaseMembersAreCurrent,
  assertChangeCaseResolutions,
  buildChangeCaseConflicts,
  getCurrentMemberVersion
} from './changeCaseConflictOperations';

const entity = (version: number): Entity => ({ version }) as Entity;
const relation = (version: number): RelationDbResult => ({ version }) as RelationDbResult;
const member = (overrides: Partial<ChangeCaseMemberDbResult> = {}) =>
  ({
    id: 'member-1',
    revision_id: 'revision-1',
    workspace: 'workspace-1',
    entity_id: 'entity-1',
    base_version: 1,
    base_state: {},
    proposed_state: {},
    diff: {},
    applied_version_id: null,
    ...overrides
  }) as ChangeCaseMemberDbResult;

describe('change-case conflict workflow', () => {
  it('uses entity and relation versions when reporting conflicts', async () => {
    const entityMember = member();
    const entityDb = {
      changeCase: { listMembers: vi.fn(async () => [entityMember]) },
      catalog: { getEntity: vi.fn(async () => entity(2)) },
      relation: { getRelation: vi.fn(async () => null) }
    } as unknown as DatabaseAdapter;

    const result = await buildChangeCaseConflicts(entityDb, 'workspace-1', {
      id: 'revision-1'
    } as ChangeCaseRevisionDbResult);

    expect(result.conflicts).toEqual([
      expect.objectContaining({
        memberId: 'member-1',
        entityId: 'entity-1',
        baseVersion: 1,
        currentVersion: 2,
        stale: true
      })
    ]);

    expect(getCurrentMemberVersion({ kind: 'relation', relation: relation(4) })).toBe(4);
  });

  it('rejects incomplete resolution lists before apply writes begin', () => {
    expect(() =>
      assertChangeCaseResolutions(
        [member(), member({ id: 'member-2' })],
        [{ memberId: 'member-1', resolvedEntityData: {} }]
      )
    ).toThrow('A resolution must be supplied for every member entity of this case');
  });

  it('rejects stale subjects during the transactional apply check', () => {
    expect(() =>
      assertChangeCaseMembersAreCurrent(
        [member()],
        new Map([['member-1', { kind: 'entity', entity: entity(2) }]])
      )
    ).toThrow('changed since this case was planned');
  });
});
