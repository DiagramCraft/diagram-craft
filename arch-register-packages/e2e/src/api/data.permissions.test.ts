import { createTestORPCClient } from '../helpers/fixtures';
import { createPermissionApiTest, csvRows, expect } from '../helpers/permissionFixtures';

const test = createPermissionApiTest().extend<{ restrictedSeed: true }>({
  restrictedSeed: [
    async ({ server, resources }, use) => {
      const customerPortal = await server.db.catalog.getEntity(
        resources.workspaceId,
        resources.entityIds.customerPortal
      );
      const identityPlatform = await server.db.catalog.getEntity(
        resources.workspaceId,
        resources.entityIds.identityPlatform
      );

      if (!customerPortal || !identityPlatform) {
        throw new Error('Expected seeded entities to exist');
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

      await server.db.catalog.updateEntity(resources.workspaceId, identityPlatform.id, {
        slug: identityPlatform.slug,
        namespace: identityPlatform.namespace,
        name: identityPlatform.name,
        description: identityPlatform.description,
        owner: identityPlatform.owner,
        lifecycle: identityPlatform.lifecycle,
        target_lifecycle: identityPlatform.target_lifecycle,
        target_lifecycle_date: identityPlatform.target_lifecycle_date,
        tags: identityPlatform.tags,
        links: identityPlatform.links,
        schema_id: identityPlatform.schema_id,
        data: identityPlatform.data,
        visibility_mode: 'restricted',
        updated_at: new Date('2026-02-02T00:00:00.000Z')
      });

      await use(true);
    },
    { scope: 'file' }
  ]
});

test.describe('data permission routes', () => {
  test('authentication: list returns 401 without auth', async ({ server, restrictedSeed: _ }) => {
    const anonOrpc = createTestORPCClient(server.baseUrl);
    await expect(
      anonOrpc.entities.list({ params: { workspace: 'default' }, query: {} })
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  test('filtering: explicit grant user only sees the granted subtree records', async ({
    personas,
    restrictedSeed: _,
    resources
  }) => {
    const entities = await personas.userWithExplicitEntityGrant.orpc.entities.list({
      params: { workspace: 'default' },
      query: { view: 'summary' }
    });

    expect(entities.map(entity => entity._uid)).toEqual([
      resources.entityIds.apiGateway,
      resources.entityIds.customerApi,
      resources.entityIds.customerPortal,
      '00000000-0000-0000-0001-000000000001',
      resources.entityIds.frontendApp,
      '00000000-0000-0000-0005-000000000001'
    ]);
  });

  test('filtering: restricted facets and tree only include visible entities', async ({
    personas,
    restrictedSeed: _,
    resources
  }) => {
    const facets = await personas.userWithExplicitEntityGrant.orpc.entities.facets({
      params: { workspace: 'default' }
    });
    expect(facets.total).toBe(6);

    const tree = await personas.userWithExplicitEntityGrant.orpc.entities.tree({
      params: { workspace: 'default' },
      query: { q: 'frontend' }
    });

    expect(tree.nodes.map(node => node._uid)).toEqual([
      resources.entityIds.customerApi,
      resources.entityIds.frontendApp,
      resources.entityIds.customerPortal,
      '00000000-0000-0000-0001-000000000001',
    ]);
    expect(tree.edges).toEqual([
      { childId: resources.entityIds.customerApi, parentId: resources.entityIds.customerPortal },
      { childId: resources.entityIds.frontendApp, parentId: resources.entityIds.customerPortal },
      { childId: resources.entityIds.customerPortal, parentId: '00000000-0000-0000-0001-000000000001' }
    ]);
  });

  test('non-disclosure: restricted entities do not leak through direct reads or exports', async ({
    server,
    personas,
    restrictedSeed: _,
    resources
  }) => {
    await expect(
      personas.outsider.orpc.entities.get({
        params: { workspace: 'default', id: resources.entityIds.customerPortal }
      })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });

    const res = await fetch(
      `${server.baseUrl}/api/default/data/export?_schemaId=00000000-0000-0000-0000-000000000004`,
      {
        headers: { Authorization: personas.userWithExplicitEntityGrant.auth }
      }
    );

    expect(res.status).toBe(200);
    const rows = csvRows(await res.text()).join('\n');
    expect(rows).toContain('Customer API');
    expect(rows).not.toContain('Auth API');
  });
});
