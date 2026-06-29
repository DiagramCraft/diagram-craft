import { describe, expect, it, vi } from 'vitest';
import type { DatabaseAdapter } from '../../db/database';
import type { EntityDbResult, SchemaDbResult } from './db/catalogDatabase';
import { countEntities, listEntities } from './entityOperations';

const now = new Date('2026-06-29T12:00:00.000Z');

const makeEntity = (index: number): EntityDbResult => ({
  id: `entity-${index}`,
  workspace: 'ws-1',
  public_id: `ENT-${index}`,
  slug: `entity-${String(index).padStart(3, '0')}`,
  namespace: 'default',
  name: `Entity ${String(index).padStart(3, '0')}`,
  description: `Description ${index}`,
  owner: null,
  lifecycle: null,
  target_lifecycle: null,
  target_lifecycle_date: null,
  tags: [],
  links: [],
  schema_id: 'schema-1',
  data: {},
  visibility_mode: null,
  created_at: now,
  updated_at: now,
  owner_name: null,
  lifecycle_label: null,
  target_lifecycle_label: null,
  schema_name: 'Service'
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
  created_at: now,
  updated_at: now
};

const makeDb = (entities: EntityDbResult[]) => {
  const listEntitiesPaginated = vi.fn(
    async (_workspace: string, _filters?: unknown, pagination?: { limit?: number; offset?: number }) =>
      entities.slice(
        pagination?.offset ?? 0,
        (pagination?.offset ?? 0) + (pagination?.limit ?? entities.length)
      )
  );

  return {
    catalog: {
      listSchemas: vi.fn(async () => [schema]),
      listEntitiesPaginated,
      listEntities: vi.fn(async () => entities)
    },
    project: {
      listProjectEntities: vi.fn(async () => [])
    }
  } as unknown as DatabaseAdapter;
};

describe('listEntities', () => {
  it('uses paginated catalog reads to satisfy offset and limit requests', async () => {
    const entities = Array.from({ length: 201 }, (_, index) => makeEntity(index));
    const db = makeDb(entities);

    const result = await listEntities(db, 'ws-1', null, {
      view: 'summary',
      limit: 1,
      offset: 200
    });

    expect(result).toHaveLength(1);
    expect(result[0]?._uid).toBe('entity-200');
    expect(db.catalog.listEntitiesPaginated).toHaveBeenNthCalledWith(1, 'ws-1', {
      schemaId: null,
      owner: null,
      lifecycle: null,
      q: '',
      conditions: []
    }, {
      limit: 200,
      offset: 0
    });
    expect(db.catalog.listEntitiesPaginated).toHaveBeenNthCalledWith(2, 'ws-1', {
      schemaId: null,
      owner: null,
      lifecycle: null,
      q: '',
      conditions: []
    }, {
      limit: 200,
      offset: 200
    });
  });

  it('continues paging until the final partial page is exhausted', async () => {
    const entities = Array.from({ length: 250 }, (_, index) => makeEntity(index));
    const db = makeDb(entities);

    const result = await listEntities(db, 'ws-1', null, {
      view: 'summary'
    });

    expect(result).toHaveLength(250);
    expect(db.catalog.listEntitiesPaginated).toHaveBeenCalledTimes(2);
    expect(db.catalog.listEntitiesPaginated).toHaveBeenNthCalledWith(1, 'ws-1', {
      schemaId: null,
      owner: null,
      lifecycle: null,
      q: '',
      conditions: []
    }, {
      limit: 200,
      offset: 0
    });
    expect(db.catalog.listEntitiesPaginated).toHaveBeenNthCalledWith(2, 'ws-1', {
      schemaId: null,
      owner: null,
      lifecycle: null,
      q: '',
      conditions: []
    }, {
      limit: 200,
      offset: 200
    });
  });
});

describe('countEntities', () => {
  it('returns the total number of matching entities without slicing', async () => {
    const entities = Array.from({ length: 47 }, (_, index) => makeEntity(index));
    const db = makeDb(entities);

    const total = await countEntities(db, 'ws-1', null, {
    });

    expect(total).toBe(47);
  });
});
