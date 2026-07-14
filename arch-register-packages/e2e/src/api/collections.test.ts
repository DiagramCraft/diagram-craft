import { createApiTest, expect } from '../helpers/fixtures';
import { seedCatalogEntities } from '../helpers/seedHelper';

const test = createApiTest({
  afterSeed: async server => {
    await seedCatalogEntities(server.db);
  }
});

const entityId = '00000000-0000-0000-0003-000000000002';

test.describe('Collections API', () => {
  test('creates collections, manages membership, and filters entities', async ({ orpc }) => {
    const first = await orpc.collections.create({
      params: { workspace: 'default' },
      body: { name: 'Important systems' }
    });
    const second = await orpc.collections.create({
      params: { workspace: 'default' },
      body: { name: 'Important systems' }
    });

    expect(first.entityCount).toBe(0);
    expect(second.entityCount).toBe(0);

    await orpc.collections.addEntity({
      params: { workspace: 'default', id: first.id },
      body: { entity_id: entityId }
    });
    await orpc.collections.addEntity({
      params: { workspace: 'default', id: second.id },
      body: { entity_id: entityId }
    });

    const memberships = await orpc.collections.list({
      params: { workspace: 'default' },
      query: { entityId }
    });
    expect(memberships).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: first.id, entityCount: 1, isMember: true }),
        expect.objectContaining({ id: second.id, entityCount: 1, isMember: true })
      ])
    );

    const entities = await orpc.entities.list({
      params: { workspace: 'default' },
      query: { collectionId: first.id }
    });
    expect(entities.map(entity => entity._uid)).toEqual([entityId]);

    await orpc.collections.removeEntity({
      params: { workspace: 'default', id: first.id, entityId }
    });
    expect(
      (await orpc.entities.list({
        params: { workspace: 'default' },
        query: { collectionId: first.id }
      }))
    ).toEqual([]);

    await orpc.collections.remove({ params: { workspace: 'default', id: second.id } });
    expect(
      (await orpc.entities.get({ params: { workspace: 'default', id: entityId } }))._uid
    ).toBe(entityId);
  });

  test('rejects blank collection names', async ({ orpc }) => {
    await expect(
      orpc.collections.create({ params: { workspace: 'default' }, body: { name: '   ' } })
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });
});
