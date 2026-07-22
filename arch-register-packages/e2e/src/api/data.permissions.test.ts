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
        project_id: null,
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
        project_id: null,
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

  test('filtering: explicit grant user sees only the granted subtree', async ({
    personas,
    restrictedSeed: _,
    resources
  }) => {
    const entities = await personas.userWithExplicitEntityGrant.orpc.entities.list({
      params: { workspace: 'default' },
      query: { view: 'summary' }
    });

    // This user has no workspace role at all — only an explicit subtree grant on
    // customerPortal (see permissionFixtures.ts). content.view is the only path to
    // workspace-wide view now, so without it this user sees exactly the granted
    // subtree and nothing else (no more implicit "public entity" visibility).
    const expectedEntityIds = [
      resources.entityIds.customerPortal,
      resources.entityIds.customerApi,
      resources.entityIds.frontendApp,
      '00000000-0000-0000-0003-000000000001',
      '00000000-0000-0000-0003-00000000000e',
      '00000000-0000-0000-0003-00000000000f',
      '00000000-0000-0000-0005-000000000001',
      '00000000-0000-0000-0005-000000000002',
      '00000000-0000-0000-0005-000000000008'
    ].sort();

    expect(entities.items.map(entity => entity._uid).sort()).toEqual(expectedEntityIds);
    expect(entities.total).toBe(expectedEntityIds.length);
  });

  test('filtering: restricted facets and tree only include visible entities', async ({
    personas,
    restrictedSeed: _,
    resources
  }) => {
    const facets = await personas.userWithExplicitEntityGrant.orpc.entities.facets({
      params: { workspace: 'default' }
    });
    const expectedTotal = 9;
    expect(facets.total).toBe(expectedTotal);

    const tree = await personas.userWithExplicitEntityGrant.orpc.entities.tree({
      params: { workspace: 'default' },
      query: { q: 'frontend' }
    });

    // The top-level domain ancestor above customerPortal is no longer visible: this user
    // has no workspace role, and the subtree grant only covers customerPortal and its
    // descendants, not its ancestors — there's no more "public entity" fallback to see it.
    expect(tree.nodes.map(node => node._uid)).toEqual(
      expect.arrayContaining([
        resources.entityIds.customerApi,
        resources.entityIds.frontendApp,
        resources.entityIds.customerPortal
      ])
    );
    expect(tree.nodes.map(node => node._uid)).not.toEqual(
      expect.arrayContaining([
        resources.entityIds.identityPlatform,
        resources.entityIds.authApi,
        resources.entityIds.authService,
        '00000000-0000-0000-0001-000000000001'
      ])
    );
    expect(tree.edges).toEqual(
      expect.arrayContaining([
        { childId: resources.entityIds.customerApi, parentId: resources.entityIds.customerPortal },
        { childId: resources.entityIds.frontendApp, parentId: resources.entityIds.customerPortal }
      ])
    );
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

  test('authorization: bulk creation rejects the complete batch when create-child is denied', async ({
    personas,
    restrictedSeed: _,
    resources
  }) => {
    await expect(
      personas.workspaceViewer.orpc.entities.bulkCreate({
        params: { workspace: 'default' },
        body: {
          entities: [
            {
              _schemaId: '00000000-0000-0000-0000-000000000003',
              _name: 'Forbidden Bulk Component',
              system: [resources.entityIds.customerPortal]
            }
          ]
        }
      })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });

    const matches = await personas.globalAdmin.orpc.entities.list({
      params: { workspace: 'default' },
      query: { q: 'Forbidden Bulk Component', view: 'summary' }
    });
    expect(matches.items).toEqual([]);
    expect(matches.total).toBe(0);
  });
});
