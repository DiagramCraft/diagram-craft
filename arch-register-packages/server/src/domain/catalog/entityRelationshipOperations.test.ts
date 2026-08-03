import { describe, expect, it, vi } from 'vitest';
import type { DatabaseAdapter } from '../../db/database';
import { getEntityRelations } from './entityRelationshipOperations';

const entity = {
  id: 'internal-uuid-1',
  public_id: 'SYS-1',
  schema_id: 'schema-1',
  data: {}
};

const makeDb = () => {
  const listRelationsForEntity = vi.fn(async () => ({ outgoing: [], incoming: [] }));
  const db = {
    catalog: {
      getEntity: vi.fn(async (_ws: string, id: string) =>
        id === entity.id || id === entity.public_id ? entity : null
      ),
      listSchemas: vi.fn(async () => []),
      listEntitiesPaginated: vi.fn(async () => [])
    },
    relation: {
      listRelationsForEntity,
      listRelationSchemas: vi.fn(async () => [])
    }
  } as unknown as DatabaseAdapter;
  return { db, listRelationsForEntity };
};

describe('getEntityRelations', () => {
  it('resolves the public id to the entity internal id before querying relations', async () => {
    const { db, listRelationsForEntity } = makeDb();

    await getEntityRelations(db, 'ws-1', entity.public_id, null);

    expect(listRelationsForEntity).toHaveBeenCalledWith('ws-1', entity.id);
  });

  it('queries relations by internal id even when given the internal id directly', async () => {
    const { db, listRelationsForEntity } = makeDb();

    await getEntityRelations(db, 'ws-1', entity.id, null);

    expect(listRelationsForEntity).toHaveBeenCalledWith('ws-1', entity.id);
  });
});
