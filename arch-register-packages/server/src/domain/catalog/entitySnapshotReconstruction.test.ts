import { describe, expect, it, vi } from 'vitest';
import type { DatabaseAdapter } from '../../db/database';
import type { AuthorizationContext } from '@arch-register/permissions';
import type { EntityDbResult, EntitySnapshotDbResult, SchemaDbResult } from './db/catalogDatabase';
import { reconstructEntitiesAsOf } from './entitySnapshotReconstruction';

vi.mock('@arch-register/permissions', async importOriginal => {
  const actual = await importOriginal<typeof import('@arch-register/permissions')>();
  return {
    ...actual,
    PermissionChecker: class {
      hasProjectPermission(context: { accessibleOwnerIds?: string[] }, ownerTeamId: string | null) {
        return ownerTeamId != null && (context.accessibleOwnerIds ?? []).includes(ownerTeamId);
      }
    }
  };
});

const makeAuthCtx = (accessibleOwnerIds: string[]): AuthorizationContext =>
  ({ accessibleOwnerIds }) as unknown as AuthorizationContext;

const makeLiveEntity = (overrides: Partial<EntityDbResult>): EntityDbResult => ({
  id: 'entity-1',
  workspace: 'ws-1',
  public_id: 'ENT-1',
  slug: 'entity-1',
  namespace: 'default',
  name: 'Live Entity',
  description: '',
  owner: null,
  lifecycle: null,
  target_lifecycle: null,
  target_lifecycle_date: null,
  tags: [],
  links: [],
  schema_id: 'schema-1',
  data: {},
  visibility_mode: null,
  created_at: new Date('2026-01-01T00:00:00.000Z'),
  updated_at: new Date('2026-01-01T00:00:00.000Z'),
  owner_name: null,
  lifecycle_label: null,
  target_lifecycle_label: null,
  schema_name: 'Service',
  ...overrides
});

const schema: SchemaDbResult = {
  id: 'schema-1',
  workspace: 'ws-1',
  name: 'Service',
  description: '',
  fields: [],
  color: null,
  icon: null,
  default_owner: null,
  key_prefix: 'SRV',
  created_at: new Date('2026-01-01T00:00:00.000Z'),
  updated_at: new Date('2026-01-01T00:00:00.000Z')
};

const baseSnapshot = (overrides: Partial<EntitySnapshotDbResult>): EntitySnapshotDbResult => ({
  id: 'snap-1',
  workspace: 'ws-1',
  entity_id: 'entity-1',
  status: 'autosave',
  project_id: null,
  target_date: null,
  milestone_id: null,
  commit_message: null,
  created_at: new Date('2026-01-01T00:00:00.000Z'),
  created_by: 'user-1',
  created_by_name: 'User One',
  base_state: {},
  proposed_state: null,
  ...overrides
});

const makeDb = (
  snapshots: EntitySnapshotDbResult[],
  liveEntities: EntityDbResult[] = [],
  projects: Array<{ id: string; owner: string | null }> = []
) => {
  const listSnapshotsAsOf = vi.fn(async (_workspace: string, asOf: Date, entityIds?: string[]) =>
    snapshots
      .filter(s => {
        if (entityIds != null && !entityIds.includes(s.entity_id)) return false;
        if (s.status === 'future_update') {
          return s.target_date != null && new Date(s.target_date) <= asOf && s.created_at <= asOf;
        }
        return s.created_at <= asOf;
      })
      .sort(
        (a, b) =>
          a.entity_id.localeCompare(b.entity_id) || a.created_at.getTime() - b.created_at.getTime()
      )
  );

  const listEntityIdsWithAnySnapshot = vi.fn(async (_workspace: string, entityIds?: string[]) => {
    const ids = new Set(
      snapshots
        .filter(
          s => s.status === 'autosave' || s.status === 'saved_version' || s.status === 'deleted'
        )
        .map(s => s.entity_id)
    );
    return [...ids].filter(id => entityIds == null || entityIds.includes(id));
  });

  return {
    catalog: {
      listSnapshotsAsOf,
      listEntityIdsWithAnySnapshot,
      listSchemas: vi.fn(async () => [schema]),
      getEntity: vi.fn(
        async (_workspace: string, id: string) => liveEntities.find(e => e.id === id) ?? null
      ),
      listEntitiesPaginated: vi.fn(
        async (
          _workspace: string,
          _filters?: unknown,
          pagination?: { limit?: number; offset?: number }
        ) =>
          liveEntities.slice(
            pagination?.offset ?? 0,
            (pagination?.offset ?? 0) + (pagination?.limit ?? liveEntities.length)
          )
      )
    },
    project: {
      getProject: vi.fn(
        async (_workspace: string, id: string) => projects.find(p => p.id === id) ?? null
      ),
      listMilestones: vi.fn(async () => [])
    },
    workspace: {
      listTeams: vi.fn(async () => [{ id: 'owner-1', name: 'Team A' }]),
      listLifecycleStates: vi.fn(async () => [{ id: 'lc-1', label: 'Active' }])
    }
  } as unknown as DatabaseAdapter;
};

describe('reconstructEntitiesAsOf', () => {
  it('excludes an entity created after asOf', async () => {
    const snapshots = [
      baseSnapshot({
        entity_id: 'entity-1',
        status: 'autosave',
        created_at: new Date('2026-03-01T00:00:00.000Z'),
        base_state: { id: 'entity-1', name: 'Late Entity', schema_id: 'schema-1' }
      })
    ];
    const db = makeDb(snapshots);

    const result = await reconstructEntitiesAsOf(
      db,
      'ws-1',
      new Date('2026-02-01T00:00:00.000Z'),
      null
    );

    expect(result).toHaveLength(0);
  });

  it('reconstructs the post-edit state at the latest autosave at or before asOf', async () => {
    const snapshots = [
      // create
      baseSnapshot({
        id: 'snap-create',
        entity_id: 'entity-1',
        status: 'autosave',
        created_at: new Date('2026-01-01T00:00:00.000Z'),
        base_state: {
          id: 'entity-1',
          public_id: 'ENT-1',
          name: 'Original Name',
          slug: 'original-name',
          schema_id: 'schema-1',
          data: {}
        },
        proposed_state: null
      }),
      // update: base_state = pre-edit, proposed_state = post-edit (full state)
      baseSnapshot({
        id: 'snap-update',
        entity_id: 'entity-1',
        status: 'autosave',
        created_at: new Date('2026-02-01T00:00:00.000Z'),
        base_state: {
          id: 'entity-1',
          public_id: 'ENT-1',
          name: 'Original Name',
          slug: 'original-name',
          schema_id: 'schema-1',
          data: {}
        },
        proposed_state: {
          id: 'entity-1',
          public_id: 'ENT-1',
          name: 'Updated Name',
          slug: 'original-name',
          schema_id: 'schema-1',
          data: {}
        }
      })
    ];
    const db = makeDb(snapshots);

    const asOfBetween = await reconstructEntitiesAsOf(
      db,
      'ws-1',
      new Date('2026-01-15T00:00:00.000Z'),
      null
    );
    expect(asOfBetween).toHaveLength(1);
    expect(asOfBetween[0]?.name).toBe('Original Name');

    const asOfAfterUpdate = await reconstructEntitiesAsOf(
      db,
      'ws-1',
      new Date('2026-03-01T00:00:00.000Z'),
      null
    );
    expect(asOfAfterUpdate).toHaveLength(1);
    expect(asOfAfterUpdate[0]?.name).toBe('Updated Name');
  });

  it('excludes an entity whose latest baseline before asOf is a deleted snapshot', async () => {
    const snapshots = [
      baseSnapshot({
        id: 'snap-create',
        entity_id: 'entity-1',
        status: 'autosave',
        created_at: new Date('2026-01-01T00:00:00.000Z'),
        base_state: { id: 'entity-1', name: 'Doomed Entity', schema_id: 'schema-1', data: {} }
      }),
      baseSnapshot({
        id: 'snap-deleted',
        entity_id: 'entity-1',
        status: 'deleted',
        created_at: new Date('2026-02-01T00:00:00.000Z'),
        base_state: { id: 'entity-1', name: 'Doomed Entity', schema_id: 'schema-1', data: {} }
      })
    ];
    const db = makeDb(snapshots);

    const beforeDeletion = await reconstructEntitiesAsOf(
      db,
      'ws-1',
      new Date('2026-01-15T00:00:00.000Z'),
      null
    );
    expect(beforeDeletion).toHaveLength(1);

    const afterDeletion = await reconstructEntitiesAsOf(
      db,
      'ws-1',
      new Date('2026-03-01T00:00:00.000Z'),
      null
    );
    expect(afterDeletion).toHaveLength(0);
  });

  it('applies future_update snapshots in ascending target_date order over the autosave baseline', async () => {
    const snapshots = [
      baseSnapshot({
        id: 'snap-create',
        entity_id: 'entity-1',
        status: 'autosave',
        created_at: new Date('2026-01-01T00:00:00.000Z'),
        base_state: {
          id: 'entity-1',
          name: 'Current Name',
          owner: 'owner-1',
          schema_id: 'schema-1',
          data: {}
        }
      }),
      baseSnapshot({
        id: 'snap-future-1',
        entity_id: 'entity-1',
        status: 'future_update',
        target_date: '2026-06-01',
        created_at: new Date('2026-01-10T00:00:00.000Z'),
        base_state: { id: 'entity-1', name: 'Current Name', schema_id: 'schema-1' },
        proposed_state: { name: 'First Planned Name' }
      }),
      baseSnapshot({
        id: 'snap-future-2',
        entity_id: 'entity-1',
        status: 'future_update',
        target_date: '2026-09-01',
        created_at: new Date('2026-01-10T00:00:00.000Z'),
        base_state: { id: 'entity-1', name: 'Current Name', schema_id: 'schema-1' },
        proposed_state: { lifecycle: 'lc-1' }
      })
    ];
    const db = makeDb(snapshots);

    const beforeAnyFutureUpdate = await reconstructEntitiesAsOf(
      db,
      'ws-1',
      new Date('2026-03-01T00:00:00.000Z'),
      null
    );
    expect(beforeAnyFutureUpdate[0]?.name).toBe('Current Name');
    expect(beforeAnyFutureUpdate[0]?.lifecycle).toBeNull();

    const afterFirstOnly = await reconstructEntitiesAsOf(
      db,
      'ws-1',
      new Date('2026-07-01T00:00:00.000Z'),
      null
    );
    expect(afterFirstOnly[0]?.name).toBe('First Planned Name');
    expect(afterFirstOnly[0]?.lifecycle).toBeNull();

    const afterBoth = await reconstructEntitiesAsOf(
      db,
      'ws-1',
      new Date('2026-10-01T00:00:00.000Z'),
      null
    );
    expect(afterBoth[0]?.name).toBe('First Planned Name');
    expect(afterBoth[0]?.lifecycle).toBe('lc-1');
    expect(afterBoth[0]?.lifecycle_label).toBe('Active');
    expect(afterBoth[0]?.owner_name).toBe('Team A');
  });

  describe('project access control for future_update snapshots', () => {
    const makeFutureUpdateSnapshots = () => [
      baseSnapshot({
        id: 'snap-create',
        entity_id: 'entity-1',
        status: 'autosave',
        created_at: new Date('2026-01-01T00:00:00.000Z'),
        base_state: { id: 'entity-1', name: 'Current Name', schema_id: 'schema-1', data: {} }
      }),
      baseSnapshot({
        id: 'snap-future',
        entity_id: 'entity-1',
        status: 'future_update',
        project_id: 'project-private',
        target_date: '2026-06-01',
        created_at: new Date('2026-01-10T00:00:00.000Z'),
        base_state: { id: 'entity-1', name: 'Current Name', schema_id: 'schema-1' },
        proposed_state: { name: 'Leaked Planned Name' }
      })
    ];

    it('does not apply a future_update from a project the user cannot access', async () => {
      const db = makeDb(
        makeFutureUpdateSnapshots(),
        [],
        [{ id: 'project-private', owner: 'team-private' }]
      );
      const authCtx = makeAuthCtx(['team-other']); // no access to team-private's projects

      const result = await reconstructEntitiesAsOf(
        db,
        'ws-1',
        new Date('2026-07-01T00:00:00.000Z'),
        authCtx
      );

      expect(result).toHaveLength(1);
      expect(result[0]?.name).toBe('Current Name');
    });

    it('applies a future_update from a project the user can access', async () => {
      const db = makeDb(
        makeFutureUpdateSnapshots(),
        [],
        [{ id: 'project-private', owner: 'team-private' }]
      );
      const authCtx = makeAuthCtx(['team-private']);

      const result = await reconstructEntitiesAsOf(
        db,
        'ws-1',
        new Date('2026-07-01T00:00:00.000Z'),
        authCtx
      );

      expect(result).toHaveLength(1);
      expect(result[0]?.name).toBe('Leaked Planned Name');
    });

    it('applies all future_update snapshots when authCtx is null (system/internal context)', async () => {
      const db = makeDb(
        makeFutureUpdateSnapshots(),
        [],
        [{ id: 'project-private', owner: 'team-private' }]
      );

      const result = await reconstructEntitiesAsOf(
        db,
        'ws-1',
        new Date('2026-07-01T00:00:00.000Z'),
        null
      );

      expect(result[0]?.name).toBe('Leaked Planned Name');
    });

    it('does not apply any future_update snapshot when includeProjectSnapshots is false, even for an accessible project', async () => {
      const db = makeDb(
        makeFutureUpdateSnapshots(),
        [],
        [{ id: 'project-private', owner: 'team-private' }]
      );
      const authCtx = makeAuthCtx(['team-private']);

      const result = await reconstructEntitiesAsOf(
        db,
        'ws-1',
        new Date('2026-07-01T00:00:00.000Z'),
        authCtx,
        undefined,
        false
      );

      expect(result).toHaveLength(1);
      expect(result[0]?.name).toBe('Current Name');
    });
  });

  it('respects candidateEntityIds to scope reconstruction to a project-linked entity set', async () => {
    const snapshots = [
      baseSnapshot({
        entity_id: 'entity-1',
        status: 'autosave',
        created_at: new Date('2026-01-01T00:00:00.000Z'),
        base_state: { id: 'entity-1', name: 'In Scope', schema_id: 'schema-1', data: {} }
      }),
      baseSnapshot({
        entity_id: 'entity-2',
        status: 'autosave',
        created_at: new Date('2026-01-01T00:00:00.000Z'),
        base_state: { id: 'entity-2', name: 'Out Of Scope', schema_id: 'schema-1', data: {} }
      })
    ];
    const db = makeDb(snapshots);

    const result = await reconstructEntitiesAsOf(
      db,
      'ws-1',
      new Date('2026-02-01T00:00:00.000Z'),
      null,
      ['entity-1']
    );

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe('entity-1');
  });

  describe('entities with no snapshot history at all (e.g. imported or seeded)', () => {
    it('falls back to the live entity for a past asOf on or after its created_at', async () => {
      const live = makeLiveEntity({
        id: 'entity-imported',
        name: 'Imported Entity',
        created_at: new Date('2026-01-01T00:00:00.000Z')
      });
      const db = makeDb([], [live]);

      const result = await reconstructEntitiesAsOf(
        db,
        'ws-1',
        new Date('2026-02-01T00:00:00.000Z'),
        null
      );

      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe('entity-imported');
      expect(result[0]?.name).toBe('Imported Entity');
    });

    it('excludes it for a past asOf before its created_at', async () => {
      const live = makeLiveEntity({
        id: 'entity-imported',
        created_at: new Date('2026-03-01T00:00:00.000Z')
      });
      const db = makeDb([], [live]);

      const result = await reconstructEntitiesAsOf(
        db,
        'ws-1',
        new Date('2026-02-01T00:00:00.000Z'),
        null
      );

      expect(result).toHaveLength(0);
    });

    it('still shows it for a future asOf, using live state as the baseline', async () => {
      const live = makeLiveEntity({
        id: 'entity-imported',
        name: 'Imported Entity',
        created_at: new Date('2026-01-01T00:00:00.000Z')
      });
      const db = makeDb([], [live]);

      const result = await reconstructEntitiesAsOf(
        db,
        'ws-1',
        new Date('2027-01-01T00:00:00.000Z'),
        null
      );

      expect(result).toHaveLength(1);
      expect(result[0]?.name).toBe('Imported Entity');
    });

    it('applies a future_update planned against it even though it has no autosave baseline', async () => {
      const live = makeLiveEntity({
        id: 'entity-imported',
        name: 'Imported Entity',
        created_at: new Date('2026-01-01T00:00:00.000Z')
      });
      const futureUpdate = baseSnapshot({
        entity_id: 'entity-imported',
        status: 'future_update',
        target_date: '2026-06-01',
        created_at: new Date('2026-01-10T00:00:00.000Z'),
        base_state: { id: 'entity-imported', name: 'Imported Entity', schema_id: 'schema-1' },
        proposed_state: { name: 'Renamed After Import' }
      });
      const db = makeDb([futureUpdate], [live]);

      const result = await reconstructEntitiesAsOf(
        db,
        'ws-1',
        new Date('2026-07-01T00:00:00.000Z'),
        null
      );

      expect(result).toHaveLength(1);
      expect(result[0]?.name).toBe('Renamed After Import');
    });

    it('does not fall back for an entity whose latest real snapshot is a deleted marker', async () => {
      const deleted = baseSnapshot({
        entity_id: 'entity-gone',
        status: 'deleted',
        created_at: new Date('2026-01-15T00:00:00.000Z'),
        base_state: { id: 'entity-gone', name: 'Gone Entity', schema_id: 'schema-1', data: {} }
      });
      // Entity still exists live in this contrived test setup, but that must not matter —
      // the real 'deleted' snapshot takes precedence over any live-entity fallback.
      const live = makeLiveEntity({ id: 'entity-gone', name: 'Gone Entity' });
      const db = makeDb([deleted], [live]);

      const result = await reconstructEntitiesAsOf(
        db,
        'ws-1',
        new Date('2026-02-01T00:00:00.000Z'),
        null
      );

      expect(result).toHaveLength(0);
    });

    it('respects candidateEntityIds when falling back (project scope)', async () => {
      const liveA = makeLiveEntity({ id: 'entity-a', name: 'A' });
      const liveB = makeLiveEntity({ id: 'entity-b', name: 'B' });
      const db = makeDb([], [liveA, liveB]);

      const result = await reconstructEntitiesAsOf(
        db,
        'ws-1',
        new Date('2026-02-01T00:00:00.000Z'),
        null,
        ['entity-a']
      );

      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe('entity-a');
    });

    it('does NOT fall back to live state when the entity has snapshot history that merely starts after asOf', async () => {
      // Regression test: an entity whose *first-ever* snapshot happens to be dated after the
      // requested asOf (e.g. its first edit under the audited path was today) must not be
      // confused with an entity that has literally zero snapshot history. The former should be
      // excluded (we have no data for that date); only the latter should fall back to live state.
      const firstEverEdit = baseSnapshot({
        entity_id: 'entity-1',
        status: 'autosave',
        created_at: new Date('2026-02-10T00:00:00.000Z'), // "today"
        base_state: { id: 'entity-1', name: 'Old Name', schema_id: 'schema-1', data: {} },
        proposed_state: { id: 'entity-1', name: 'New Name', schema_id: 'schema-1', data: {} }
      });
      const live = makeLiveEntity({
        id: 'entity-1',
        name: 'New Name',
        created_at: new Date('2026-01-01T00:00:00.000Z') // entity has existed for a while
      });
      const db = makeDb([firstEverEdit], [live]);

      const yesterday = await reconstructEntitiesAsOf(
        db,
        'ws-1',
        new Date('2026-02-09T00:00:00.000Z'),
        null
      );

      // Must NOT show the live (New Name) state — there is no data for yesterday, so the
      // entity should be excluded rather than incorrectly showing today's current name.
      expect(yesterday).toHaveLength(0);

      const today = await reconstructEntitiesAsOf(
        db,
        'ws-1',
        new Date('2026-02-10T12:00:00.000Z'),
        null
      );
      expect(today).toHaveLength(1);
      expect(today[0]?.name).toBe('New Name');
    });
  });
});
