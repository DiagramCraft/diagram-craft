import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DatabaseAdapter } from '../../db/database';
import type { EntityLandscapeDiffState } from '@arch-register/api-types/entityContract';
import type { EntityDbResult } from './db/catalogDatabase';

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
  ...overrides
});

const db = {
  project: {
    getProject: vi.fn(async () => null),
    listProjectEntityLinks: vi.fn(async () => [])
  },
  catalog: {
    listEntitiesPaginated: vi.fn(async () => [])
  }
} as unknown as DatabaseAdapter;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(db.project.getProject).mockResolvedValue(null as never);
  vi.mocked(db.project.listProjectEntityLinks).mockResolvedValue([] as never);
  vi.mocked(db.catalog.listEntitiesPaginated).mockResolvedValue([] as never);
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
      'project-1'
    );
    expect(reconstructEntitiesAsOf).toHaveBeenNthCalledWith(
      2,
      db,
      'ws-1',
      expect.any(Date),
      {},
      expect.arrayContaining(['owned-1', 'linked-1']),
      true,
      'project-1'
    );
  });

  it('rejects comparisons between different projects', async () => {
    await expect(
      diffEntityLandscapes(
        db,
        'ws-1',
        {} as never,
        state({ projectId: 'project-a' }),
        state({ projectId: 'project-b' })
      )
    ).rejects.toThrow('Comparing different projects is not supported');
  });
});
