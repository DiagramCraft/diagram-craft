import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EntityRecord } from '@arch-register/api-types/entityContract';
import type { DatabaseAdapter } from '../../db/database';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { buildAuthorizationContext } from '@arch-register/permissions';
import { attachUsageCounts, type NormalizedEntityQueryOptions } from './entityQueryOperations';
import { getBatchEntityDependents } from './entityRelationshipOperations';
import { collectEntityUsage } from './entityUsageOperations';

vi.mock('./entityRelationshipOperations', () => ({
  getBatchEntityDependents: vi.fn()
}));

vi.mock('./entityUsageOperations', () => ({
  collectEntityUsage: vi.fn()
}));

const db = {} as DatabaseAdapter;
const event = {} as AuthenticatedEvent;

const authCtx = buildAuthorizationContext({
  userId: 'user-1',
  globalRoles: ['global_admin'],
  workspaceRole: null,
  schemas: [],
  entities: [],
  grants: []
});

const makeEntity = (uid: string): EntityRecord =>
  ({
    _uid: uid,
    _name: `Entity ${uid}`
  }) as unknown as EntityRecord;

const baseNormalized = (
  overrides: Partial<Pick<NormalizedEntityQueryOptions, 'includeUsageCount' | 'usageContext'>>
): Pick<NormalizedEntityQueryOptions, 'includeUsageCount' | 'usageContext'> => ({
  includeUsageCount: false,
  usageContext: null,
  ...overrides
});

describe('attachUsageCounts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('is a no-op when includeUsageCount is not requested', async () => {
    const entities = [makeEntity('entity-1')];
    const result = await attachUsageCounts(
      db,
      'ws-1',
      authCtx,
      baseNormalized({ includeUsageCount: false }),
      entities
    );
    expect(result).toBe(entities);
    expect(getBatchEntityDependents).not.toHaveBeenCalled();
    expect(collectEntityUsage).not.toHaveBeenCalled();
  });

  it('is a no-op when usageContext is missing even if includeUsageCount is true', async () => {
    const entities = [makeEntity('entity-1')];
    const result = await attachUsageCounts(
      db,
      'ws-1',
      authCtx,
      baseNormalized({ includeUsageCount: true, usageContext: null }),
      entities
    );
    expect(result).toBe(entities);
    expect(collectEntityUsage).not.toHaveBeenCalled();
  });

  it('is a no-op when authCtx is null, since collectEntityUsage requires it', async () => {
    const entities = [makeEntity('entity-1')];
    const result = await attachUsageCounts(
      db,
      'ws-1',
      null,
      baseNormalized({
        includeUsageCount: true,
        usageContext: { workspaceSlug: 'ws-slug', event }
      }),
      entities
    );
    expect(result).toBe(entities);
    expect(collectEntityUsage).not.toHaveBeenCalled();
  });

  it('batches usage lookups and attaches _usageCount per entity when requested', async () => {
    const entities = [makeEntity('entity-1'), makeEntity('entity-2')];
    const dependentsById = new Map([['entity-1', { dependents: [] } as never]]);
    vi.mocked(getBatchEntityDependents).mockResolvedValue(dependentsById);
    vi.mocked(collectEntityUsage).mockImplementation(async (_db, _workspaceId, _slug, entityId) =>
      entityId === 'entity-1' ? [{ kind: 'document', id: 'doc-1', label: 'Doc' } as never] : []
    );

    const result = await attachUsageCounts(
      db,
      'ws-1',
      authCtx,
      baseNormalized({
        includeUsageCount: true,
        usageContext: { workspaceSlug: 'ws-slug', event }
      }),
      entities
    );

    expect(getBatchEntityDependents).toHaveBeenCalledWith(
      db,
      'ws-1',
      ['entity-1', 'entity-2'],
      { transitive: false },
      authCtx
    );
    expect(collectEntityUsage).toHaveBeenCalledTimes(2);
    expect(collectEntityUsage).toHaveBeenCalledWith(
      db,
      'ws-1',
      'ws-slug',
      'entity-1',
      event,
      authCtx,
      dependentsById.get('entity-1')
    );
    expect(result.map(entity => ({ id: entity._uid, count: entity._usageCount }))).toEqual([
      { id: 'entity-1', count: 1 },
      { id: 'entity-2', count: 0 }
    ]);
  });

  it('returns the same array reference when there are no entities', async () => {
    const entities: EntityRecord[] = [];
    const result = await attachUsageCounts(
      db,
      'ws-1',
      authCtx,
      baseNormalized({
        includeUsageCount: true,
        usageContext: { workspaceSlug: 'ws-slug', event }
      }),
      entities
    );
    expect(result).toBe(entities);
    expect(getBatchEntityDependents).not.toHaveBeenCalled();
  });
});
