import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildAuthorizationContext, type TeamRole } from '@arch-register/permissions';
import type { DatabaseAdapter } from '../../db/database';
import type { EntityLandscapeDiffState } from '@arch-register/api-types/entityContract';
import type { EntityDbResult, SchemaDbResult } from './db/catalogDatabase';

vi.mock('../auth/authorization', () => ({
  filterVisibleEntities: (_authCtx: unknown, entities: EntityDbResult[]) => entities,
  requireProjectAccess: vi.fn()
}));

vi.mock('./entitySnapshotReconstruction', () => ({
  reconstructEntitiesAsOf: vi.fn()
}));

vi.mock('./entityHelpers', () => ({
  toApiEntity: (entity: EntityDbResult) => ({
    _uid: entity.id,
    _publicId: entity.public_id,
    _schema: { id: entity.schema_id, name: entity.schema_name },
    _name: entity.name,
    _slug: entity.slug,
    _namespace: entity.namespace,
    _description: entity.description,
    _owner: null,
    _lifecycle: null,
    _targetLifecycle: null,
    _targetLifecycleDate: null,
    _tags: entity.tags,
    _links: entity.links,
    _projectId: entity.project_id,
    _completeness: entity.completeness,
    canView: true,
    canEdit: true,
    canDelete: true,
    canAdmin: true,
    canCreateChild: true,
    ...entity.data
  })
}));

import { reconstructEntitiesAsOf } from './entitySnapshotReconstruction';
import { diffEntityLandscapes } from './entityLandscapeDiffOperations';

const now = new Date('2026-07-30T12:00:00.000Z');

const makeEntity = (id: string, overrides: Partial<EntityDbResult> = {}): EntityDbResult => ({
  id,
  workspace: 'ws-1',
  public_id: id.toUpperCase(),
  slug: id,
  namespace: 'default',
  name: id,
  description: '',
  owner: null,
  lifecycle: null,
  target_lifecycle: null,
  target_lifecycle_date: null,
  tags: [],
  links: [],
  schema_id: 'schema-1',
  data: {},
  project_id: null,
  created_at: now,
  updated_at: now,
  completeness: 100,
  owner_name: null,
  lifecycle_label: null,
  target_lifecycle_label: null,
  schema_name: 'Service',
  ...overrides
});

const state = (overrides: Partial<EntityLandscapeDiffState>): EntityLandscapeDiffState => ({
  asOf: now.toISOString(),
  includePlannedChanges: false,
  includeOverdueChanges: false,
  ...overrides
});

const authCtxWithTeamRoles = (roles: Record<string, TeamRole[]>) =>
  buildAuthorizationContext({
    userId: 'user-1',
    globalRoles: [],
    workspaceRole: null,
    teamAssignments: Object.entries(roles).flatMap(([teamId, teamRoles]) =>
      teamRoles.map(role => ({ teamId, role }))
    ),
    schemas: [],
    entities: [],
    grants: []
  });

const restrictedSchema = {
  id: 'schema-1',
  workspace: 'ws-1',
  name: 'Service',
  description: '',
  color: null,
  icon: null,
  default_owner: null,
  key_prefix: 'SVC',
  created_at: now,
  updated_at: now,
  fields: [
    { id: 'visible', name: 'Visible', requirementLevel: null, type: 'text' },
    {
      id: 'secret',
      name: 'Secret',
      requirementLevel: null,
      type: 'text',
      groupId: 'restricted'
    },
    {
      id: 'relatedSecret',
      name: 'Related secret',
      requirementLevel: null,
      type: 'reference',
      schemaId: 'schema-1',
      minCount: 0,
      maxCount: 1,
      groupId: 'restricted'
    }
  ],
  groups: [
    { id: 'restricted', name: 'Restricted', accessControl: { teamIds: ['team-restricted'] } }
  ]
} as unknown as SchemaDbResult;

const unrestrictedSecretSchema = {
  ...restrictedSchema,
  id: 'schema-2',
  fields: [{ id: 'secret', name: 'Secret', requirementLevel: null, type: 'text' }],
  groups: []
} as unknown as SchemaDbResult;

const db = {
  project: {
    getProject: vi.fn(async () => null),
    listProjectEntityLinks: vi.fn(async () => [])
  },
  catalog: {
    listEntitiesPaginated: vi.fn(async () => []),
    listSchemas: vi.fn(async () => [])
  }
} as unknown as DatabaseAdapter;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(db.project.getProject).mockResolvedValue(null as never);
  vi.mocked(db.project.listProjectEntityLinks).mockResolvedValue([] as never);
  vi.mocked(db.catalog.listEntitiesPaginated).mockResolvedValue([] as never);
  vi.mocked(db.catalog.listSchemas).mockResolvedValue([] as never);
});

describe('diffEntityLandscapes', () => {
  it('classifies added, removed, and changed entities and returns the to entity', async () => {
    const from = [makeEntity('removed'), makeEntity('changed', { name: 'Before' })];
    const to = [makeEntity('added'), makeEntity('changed', { name: 'After' })];
    vi.mocked(reconstructEntitiesAsOf).mockResolvedValueOnce(from).mockResolvedValueOnce(to);

    const result = await diffEntityLandscapes(
      db,
      'ws-1',
      {} as never,
      state({ asOf: '2026-07-29T12:00:00.000Z' }),
      state({ asOf: '2026-07-30T12:00:00.000Z' })
    );

    expect(result.added.map(entity => entity._uid)).toEqual(['added']);
    expect(result.removed.map(entity => entity._uid)).toEqual(['removed']);
    expect(result.changed).toEqual([
      expect.objectContaining({
        entity: expect.objectContaining({ _uid: 'changed', _name: 'After' }),
        diff: { name: { before: 'Before', after: 'After' } }
      })
    ]);
  });

  it('uses a shared project scope and passes the project filter to reconstruction', async () => {
    const project = { id: 'project-1', owner: 'team-1' };
    vi.mocked(db.project.getProject).mockResolvedValue(project as never);
    vi.mocked(db.project.listProjectEntityLinks).mockResolvedValue([
      { entity_id: 'linked-1', created_at: now }
    ] as never);
    vi.mocked(db.catalog.listEntitiesPaginated)
      .mockResolvedValueOnce([makeEntity('owned-1')] as never)
      .mockResolvedValueOnce([] as never);
    vi.mocked(reconstructEntitiesAsOf).mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    await diffEntityLandscapes(
      db,
      'ws-1',
      {} as never,
      state({ projectId: 'project-1' }),
      state({ projectId: 'project-1', includePlannedChanges: true })
    );

    expect(reconstructEntitiesAsOf).toHaveBeenNthCalledWith(
      1,
      db,
      'ws-1',
      expect.any(Date),
      {},
      expect.arrayContaining(['owned-1', 'linked-1']),
      false,
      'project-1',
      expect.any(Date)
    );
    expect(reconstructEntitiesAsOf).toHaveBeenNthCalledWith(
      2,
      db,
      'ws-1',
      expect.any(Date),
      {},
      expect.arrayContaining(['owned-1', 'linked-1']),
      true,
      'project-1',
      expect.any(Date)
    );
  });

  it('omits the overdue-changes cutoff when includeOverdueChanges is set', async () => {
    vi.mocked(reconstructEntitiesAsOf).mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    await diffEntityLandscapes(
      db,
      'ws-1',
      {} as never,
      state({}),
      state({ includeOverdueChanges: true })
    );

    expect(reconstructEntitiesAsOf).toHaveBeenNthCalledWith(
      1,
      db,
      'ws-1',
      expect.any(Date),
      {},
      undefined,
      false,
      undefined,
      expect.any(Date)
    );
    expect(reconstructEntitiesAsOf).toHaveBeenNthCalledWith(
      2,
      db,
      'ws-1',
      expect.any(Date),
      {},
      undefined,
      false,
      undefined,
      undefined
    );
  });

  it('compares two projects as independent workspace-wide scenarios', async () => {
    const projectA = { id: 'project-a', owner: 'team-a' };
    const projectB = { id: 'project-b', owner: 'team-b' };
    vi.mocked(db.project.getProject)
      .mockResolvedValueOnce(projectA as never)
      .mockResolvedValueOnce(projectB as never);
    vi.mocked(db.project.listProjectEntityLinks)
      .mockResolvedValueOnce([] as never)
      .mockResolvedValueOnce([] as never);

    vi.mocked(reconstructEntitiesAsOf)
      .mockResolvedValueOnce([
        makeEntity('shared', { name: 'Shared before' }),
        makeEntity('only-a', { project_id: 'project-a' })
      ])
      .mockResolvedValueOnce([
        makeEntity('shared', { name: 'Shared after' }),
        makeEntity('only-b', { project_id: 'project-b' })
      ])
      .mockResolvedValueOnce([makeEntity('shared', { name: 'Live value' })]);

    const result = await diffEntityLandscapes(
      db,
      'ws-1',
      {} as never,
      state({
        asOf: '2026-08-01T00:00:00.000Z',
        projectId: 'project-a',
        projectScope: 'all',
        includePlannedChanges: true
      }),
      state({
        asOf: '2026-09-01T00:00:00.000Z',
        projectId: 'project-b',
        projectScope: 'all',
        includePlannedChanges: true
      })
    );

    expect(result.added.map(entity => entity._uid)).toEqual(['only-b']);
    expect(result.removed.map(entity => entity._uid)).toEqual(['only-a']);
    expect(result.changed).toEqual([
      expect.objectContaining({
        entity: expect.objectContaining({ _uid: 'shared', _name: 'Shared after' }),
        diff: {
          name: { current: 'Live value', before: 'Shared before', after: 'Shared after' }
        }
      })
    ]);
    expect(reconstructEntitiesAsOf).toHaveBeenNthCalledWith(
      1,
      db,
      'ws-1',
      expect.any(Date),
      {},
      undefined,
      true,
      'project-a',
      expect.any(Date)
    );
    expect(reconstructEntitiesAsOf).toHaveBeenNthCalledWith(
      2,
      db,
      'ws-1',
      expect.any(Date),
      {},
      undefined,
      true,
      'project-b',
      expect.any(Date)
    );
  });

  it('requires workspace-wide scope for comparisons between different projects', async () => {
    await expect(
      diffEntityLandscapes(
        db,
        'ws-1',
        {} as never,
        state({ projectId: 'project-a', projectScope: 'project' }),
        state({ projectId: 'project-b', projectScope: 'project' })
      )
    ).rejects.toThrow('Comparing different projects requires workspace-wide scenario scope');
  });

  it('includes project-owned entities in a workspace-wide diff (no projectId)', async () => {
    const from = [makeEntity('global-1'), makeEntity('project-owned-1', { project_id: 'p-1' })];
    const to = [makeEntity('global-1'), makeEntity('project-owned-1', { project_id: 'p-1' })];
    vi.mocked(reconstructEntitiesAsOf).mockResolvedValueOnce(from).mockResolvedValueOnce(to);

    const result = await diffEntityLandscapes(db, 'ws-1', {} as never, state({}), state({}));

    expect(result.added).toEqual([]);
    expect(result.removed).toEqual([]);
  });

  it('scopes each side by a free-text query independently', async () => {
    const from = [makeEntity('alpha', { name: 'Alpha service' })];
    const to = [
      makeEntity('alpha', { name: 'Alpha service' }),
      makeEntity('beta', { name: 'Beta service' })
    ];
    vi.mocked(reconstructEntitiesAsOf).mockResolvedValueOnce(from).mockResolvedValueOnce(to);

    const result = await diffEntityLandscapes(
      db,
      'ws-1',
      {} as never,
      state({ q: 'beta' }),
      state({ q: 'beta' })
    );

    expect(result.added.map(entity => entity._uid)).toEqual(['beta']);
    expect(result.removed).toEqual([]);
  });

  it('scopes by collection membership independently per side', async () => {
    const dbWithView = {
      ...db,
      view: {
        listCollectionEntityIds: vi
          .fn()
          .mockResolvedValueOnce(['alpha'])
          .mockResolvedValueOnce(['alpha', 'beta'])
      }
    } as unknown as DatabaseAdapter;
    const from = [makeEntity('alpha'), makeEntity('beta')];
    const to = [makeEntity('alpha'), makeEntity('beta')];
    vi.mocked(reconstructEntitiesAsOf).mockResolvedValueOnce(from).mockResolvedValueOnce(to);

    const result = await diffEntityLandscapes(
      dbWithView,
      'ws-1',
      { userId: 'user-1' } as never,
      state({ collectionId: 'col-1' }),
      state({ collectionId: 'col-1' })
    );

    expect(result.added.map(entity => entity._uid)).toEqual(['beta']);
    expect(result.removed).toEqual([]);
  });

  describe('field-group redaction', () => {
    beforeEach(() => {
      vi.mocked(db.catalog.listSchemas).mockResolvedValue([restrictedSchema] as never);
    });

    it.each(['equals', 'not_equals', 'empty', 'not_empty'] as const)(
      'rejects unauthorized %s conditions before evaluating entity data',
      async op => {
        vi.mocked(db.catalog.listSchemas).mockResolvedValue([restrictedSchema] as never);

        await expect(
          diffEntityLandscapes(
            db,
            'ws-1',
            authCtxWithTeamRoles({}),
            state({ conditions: [{ fieldId: 'secret', op, value: 'guess' }] }),
            state({})
          )
        ).rejects.toThrow("Unknown field 'secret'");

        expect(reconstructEntitiesAsOf).not.toHaveBeenCalled();
      }
    );

    it('rejects unauthorized conditions on restricted relation fields', async () => {
      vi.mocked(db.catalog.listSchemas).mockResolvedValue([restrictedSchema] as never);

      await expect(
        diffEntityLandscapes(
          db,
          'ws-1',
          authCtxWithTeamRoles({}),
          state({
            conditions: [{ fieldId: 'relatedSecret', op: 'not_empty', value: '' }]
          }),
          state({})
        )
      ).rejects.toThrow("Unknown field 'relatedSecret'");
    });

    it('validates assessment conditions before splitting them from entity conditions', async () => {
      await expect(
        diffEntityLandscapes(
          db,
          'ws-1',
          authCtxWithTeamRoles({}),
          state({ conditions: [{ fieldId: '_assessment:review', op: 'equals', value: 'yes' }] }),
          state({})
        )
      ).rejects.toThrow('assessmentId');

      expect(reconstructEntitiesAsOf).not.toHaveBeenCalled();
    });

    it('allows a caller with view access to filter on a restricted field', async () => {
      const from = [makeEntity('e1', { data: { secret: 'before' } })];
      const to = [makeEntity('e1', { data: { secret: 'after' } })];
      vi.mocked(reconstructEntitiesAsOf).mockResolvedValueOnce(from).mockResolvedValueOnce(to);

      const result = await diffEntityLandscapes(
        db,
        'ws-1',
        authCtxWithTeamRoles({ 'team-restricted': ['team_reviewer'] }),
        state({ conditions: [{ fieldId: 'secret', op: 'equals', value: 'before' }] }),
        state({ conditions: [{ fieldId: 'secret', op: 'equals', value: 'after' }] })
      );

      expect(result.changed).toHaveLength(1);
    });

    it('rejects an entity editor without field-group access', async () => {
      const entityEditor = buildAuthorizationContext({
        userId: 'user-1',
        globalRoles: [],
        workspaceRole: 'editor',
        schemas: [],
        entities: [],
        grants: []
      });

      await expect(
        diffEntityLandscapes(
          db,
          'ws-1',
          entityEditor,
          state({ conditions: [{ fieldId: 'secret', op: 'equals', value: 'guess' }] }),
          state({})
        )
      ).rejects.toThrow("Unknown field 'secret'");
    });

    it('does not evaluate a restricted field on a schema that only collides by field id', async () => {
      const restrictedEntity = makeEntity('restricted', {
        data: { secret: 'match' },
        schema_id: 'schema-1'
      });
      const unrestrictedEntity = makeEntity('unrestricted', {
        data: { secret: 'match' },
        schema_id: 'schema-2',
        schema_name: 'Other'
      });
      vi.mocked(db.catalog.listSchemas).mockResolvedValue([
        restrictedSchema,
        unrestrictedSecretSchema
      ] as never);
      vi.mocked(reconstructEntitiesAsOf)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([restrictedEntity, unrestrictedEntity]);

      const result = await diffEntityLandscapes(
        db,
        'ws-1',
        authCtxWithTeamRoles({}),
        state({}),
        state({ conditions: [{ fieldId: 'secret', op: 'equals', value: 'match' }] })
      );

      expect(result.added.map(entity => entity._uid)).toEqual(['unrestricted']);
    });

    it('keeps a restricted-only data change in `changed` with an empty diff', async () => {
      const from = [makeEntity('e1', { data: { secret: 'before' } })];
      const to = [makeEntity('e1', { data: { secret: 'after' } })];
      vi.mocked(reconstructEntitiesAsOf).mockResolvedValueOnce(from).mockResolvedValueOnce(to);

      const result = await diffEntityLandscapes(
        db,
        'ws-1',
        authCtxWithTeamRoles({}),
        state({}),
        state({})
      );

      expect(result.changed).toEqual([
        expect.objectContaining({
          entity: expect.objectContaining({ _uid: 'e1' }),
          diff: {}
        })
      ]);
    });

    it('redacts only the restricted field when a visible field also changes', async () => {
      const from = [makeEntity('e1', { data: { visible: 'v-before', secret: 'before' } })];
      const to = [makeEntity('e1', { data: { visible: 'v-after', secret: 'after' } })];
      vi.mocked(reconstructEntitiesAsOf).mockResolvedValueOnce(from).mockResolvedValueOnce(to);

      const result = await diffEntityLandscapes(
        db,
        'ws-1',
        authCtxWithTeamRoles({}),
        state({}),
        state({})
      );

      expect(result.changed).toEqual([
        expect.objectContaining({
          diff: {
            data: {
              before: { visible: 'v-before' },
              after: { visible: 'v-after' }
            }
          }
        })
      ]);
    });

    it('does not redact when the caller has view access to the group', async () => {
      const from = [makeEntity('e1', { data: { secret: 'before' } })];
      const to = [makeEntity('e1', { data: { secret: 'after' } })];
      vi.mocked(reconstructEntitiesAsOf).mockResolvedValueOnce(from).mockResolvedValueOnce(to);

      const result = await diffEntityLandscapes(
        db,
        'ws-1',
        authCtxWithTeamRoles({ 'team-restricted': ['team_reviewer'] }),
        state({}),
        state({})
      );

      expect(result.changed).toEqual([
        expect.objectContaining({
          diff: {
            data: { before: { secret: 'before' }, after: { secret: 'after' } }
          }
        })
      ]);
    });

    it('redacts the merged current value in scenario comparisons', async () => {
      const projectA = { id: 'project-a', owner: 'team-a' };
      const projectB = { id: 'project-b', owner: 'team-b' };
      vi.mocked(db.project.getProject)
        .mockResolvedValueOnce(projectA as never)
        .mockResolvedValueOnce(projectB as never);
      vi.mocked(db.project.listProjectEntityLinks)
        .mockResolvedValueOnce([] as never)
        .mockResolvedValueOnce([] as never);

      vi.mocked(reconstructEntitiesAsOf)
        .mockResolvedValueOnce([
          makeEntity('shared', { data: { visible: 'v-before', secret: 'before' } })
        ])
        .mockResolvedValueOnce([
          makeEntity('shared', { data: { visible: 'v-after', secret: 'after' } })
        ])
        .mockResolvedValueOnce([
          makeEntity('shared', { data: { visible: 'v-live', secret: 'live' } })
        ]);

      const result = await diffEntityLandscapes(
        db,
        'ws-1',
        authCtxWithTeamRoles({}),
        state({ projectId: 'project-a', projectScope: 'all' }),
        state({ projectId: 'project-b', projectScope: 'all' })
      );

      expect(result.changed).toEqual([
        expect.objectContaining({
          entity: expect.objectContaining({ _uid: 'shared' }),
          diff: {
            data: {
              before: { visible: 'v-before' },
              after: { visible: 'v-after' },
              current: { visible: 'v-live' }
            }
          }
        })
      ]);
    });

    it('behaves unchanged when no schema is found for the entity', async () => {
      vi.mocked(db.catalog.listSchemas).mockResolvedValue([] as never);
      const from = [makeEntity('e1', { data: { secret: 'before' } })];
      const to = [makeEntity('e1', { data: { secret: 'after' } })];
      vi.mocked(reconstructEntitiesAsOf).mockResolvedValueOnce(from).mockResolvedValueOnce(to);

      const result = await diffEntityLandscapes(
        db,
        'ws-1',
        authCtxWithTeamRoles({}),
        state({}),
        state({})
      );

      expect(result.changed).toEqual([
        expect.objectContaining({
          diff: {
            data: { before: { secret: 'before' }, after: { secret: 'after' } }
          }
        })
      ]);
    });
  });
});
