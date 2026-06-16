import { createTestORPCClient } from '../helpers/fixtures';
import { createPermissionApiTest, expect } from '../helpers/permissionFixtures';

const test = createPermissionApiTest().extend<{ restrictedSeed: true }>({
  restrictedSeed: [
    async ({ server, resources }, use) => {
      const customerPortal = await server.db.catalog.getEntity(
        resources.workspaceId,
        resources.entityIds.customerPortal
      );

      if (!customerPortal) {
        throw new Error('Expected seeded customer portal entity to exist');
      }

      await server.db.catalog.updateEntity(resources.workspaceId, customerPortal.id, {
        slug: customerPortal.slug,
        namespace: customerPortal.namespace,
        name: customerPortal.name,
        description: customerPortal.description,
        owner: customerPortal.owner,
        lifecycle: customerPortal.lifecycle,
        target_lifecycle: customerPortal.target_lifecycle,
        target_lifecycle_date: customerPortal.target_lifecycle_date,
        tags: customerPortal.tags,
        links: customerPortal.links,
        schema_id: customerPortal.schema_id,
        data: customerPortal.data,
        visibility_mode: 'restricted',
        updated_at: new Date('2026-02-02T00:00:00.000Z')
      });

      await use(true);
    },
    { scope: 'file' }
  ]
});

test.describe('search permission routes', () => {
  test('authentication: search returns 401 without auth', async ({ server, restrictedSeed: _ }) => {
    const anonOrpc = createTestORPCClient(server.baseUrl);
    await expect(
      anonOrpc.search.query({ params: { workspace: 'default' }, query: { q: 'portal' } })
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  test('filtering: explicit grant user only receives matching visible entities', async ({
    personas,
    restrictedSeed: _,
    resources
  }) => {
    const result = await personas.userWithExplicitEntityGrant.orpc.search.query({
      params: { workspace: 'default' },
      query: { q: 'frontend', types: 'entities' }
    });

    expect(result.entities.map(entity => entity.entityId)).toEqual([
      resources.entityIds.customerApi,
      resources.entityIds.frontendApp
    ]);
    expect(result.projects).toEqual([]);
    expect(result.files).toEqual([]);
    expect(result.schemas).toEqual([]);
  });

  test('non-disclosure: hidden projects and files do not appear in search results', async ({
    personas,
    restrictedSeed: _
  }) => {
    const result = await personas.workspaceViewer.orpc.search.query({
      params: { workspace: 'default' },
      query: { q: 'auth', types: 'projects,files' }
    });

    expect(result.projects).toEqual([]);
    expect(result.files).toEqual([]);
  });

  test('non-disclosure: outsider cannot discover restricted entities by exact query', async ({
    personas,
    restrictedSeed: _
  }) => {
    const result = await personas.outsider.orpc.search.query({
      params: { workspace: 'default' },
      query: { q: 'customer portal', types: 'entities' }
    });

    expect(result.entities).toEqual([]);
  });
});
