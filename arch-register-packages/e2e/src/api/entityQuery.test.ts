import type { EntityQuery } from '@arch-register/api-types/entityQueryIR';
import { seededUsers } from '@arch-register/server/db/seedFixtures';
import { createApiTest, createTestORPCClient, expect } from '../helpers/fixtures';
import { makeAuthHeader } from '../helpers/seedHelper';

const test = createApiTest({ seed: 'bootstrap' }).extend<{ auth: string }>({
  auth: [
    async ({ server }, use) => {
      await use(await makeAuthHeader(server.db, seededUsers.globalAdmin.id));
    },
    { scope: 'file' }
  ]
});

const componentSchemaId = '00000000-0000-0000-0000-000000000003';
const apiSchemaId = '00000000-0000-0000-0000-000000000004';
const frontendAppId = '00000000-0000-0000-0003-000000000002';
const authServiceId = '00000000-0000-0000-0003-000000000003';
const customerPortalId = '00000000-0000-0000-0002-000000000001';
const goTechnologyId = '00000000-0000-0000-0007-000000000003';
const portalRedesignProjectId = '00000000-0000-0000-0010-000000000001';

const eolRiskQuery: EntityQuery = {
  schemaId: componentSchemaId,
  root: {
    kind: 'predicate',
    path: [{ kind: 'forward', fieldId: 'technology_releases' }],
    fieldId: 'eol_date',
    op: 'before',
    value: '2026-06-30'
  },
  projections: [
    {
      path: [{ kind: 'forward', fieldId: 'technology_releases' }],
      fieldId: 'eol_date',
      alias: 'technology_release_eol'
    }
  ]
};

const identityAnchoredQuery: EntityQuery = {
  root: {
    kind: 'predicate',
    path: [
      { kind: 'forward', fieldId: 'technology_releases' },
      { kind: 'forward', fieldId: 'technology' }
    ],
    fieldId: '_id',
    op: 'equals',
    value: goTechnologyId
  }
};

test.describe('EntityQuery HTTP routes', () => {
  test('executes the seeded #2300 query through list and count with projections', async ({
    orpc
  }) => {
    const [list, count] = await Promise.all([
      orpc.entities.list({
        params: { workspace: 'default' },
        query: { entityQuery: eolRiskQuery, view: 'full' }
      }),
      orpc.entities.count({
        params: { workspace: 'default' },
        query: { entityQuery: eolRiskQuery }
      })
    ]);

    expect(list.total).toBe(11);
    expect(count.total).toBe(list.total);
    expect(list.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          _uid: frontendAppId,
          _projections: { technology_release_eol: expect.any(Array) }
        })
      ])
    );
  });

  test('executes the seeded #2315 identity-anchored query through list', async ({ orpc }) => {
    const body = await orpc.entities.list({
      params: { workspace: 'default' },
      query: { entityQuery: identityAnchoredQuery, view: 'summary' }
    });

    expect(body.total).toBe(4);
    expect(body.items.map(entity => entity._uid)).toEqual(expect.arrayContaining([authServiceId]));
  });

  test('accepts an EntityQuery serialized as a JSON GET parameter', async ({ server, auth }) => {
    const params = new URLSearchParams({ entityQuery: JSON.stringify(eolRiskQuery), view: 'full' });
    const response = await fetch(`${server.baseUrl}/api/default/data?${params}`, {
      headers: { Authorization: auth }
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      total: number;
      items: Array<{ _uid: string; _projections?: Record<string, unknown> }>;
    };
    expect(body.total).toBe(11);
    expect(body.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          _uid: frontendAppId,
          _projections: { technology_release_eol: expect.any(Array) }
        })
      ])
    );
  });

  test('allows matching legacy fields and rejects conflicting duplicates', async ({ orpc }) => {
    await expect(
      orpc.entities.list({
        params: { workspace: 'default' },
        query: {
          _schemaId: componentSchemaId,
          entityQuery: { ...identityAnchoredQuery, schemaId: componentSchemaId }
        }
      })
    ).resolves.toMatchObject({ total: 4 });

    await expect(
      orpc.entities.list({
        params: { workspace: 'default' },
        query: {
          _schemaId: apiSchemaId,
          entityQuery: { ...identityAnchoredQuery, schemaId: componentSchemaId }
        }
      })
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  test('applies project scope to list and tree responses', async ({ server, auth }) => {
    const query: EntityQuery = {
      projectId: portalRedesignProjectId,
      projectScope: 'project',
      schemaId: componentSchemaId,
      root: { kind: 'and', children: [] }
    };

    const request = async <T>(path: string): Promise<T> => {
      const params = new URLSearchParams({ entityQuery: JSON.stringify(query), view: 'summary' });
      const response = await fetch(`${server.baseUrl}/api/default/data${path}?${params}`, {
        headers: { Authorization: auth }
      });
      expect(response.status).toBe(200);
      return (await response.json()) as T;
    };

    const list = await request<{
      items: Array<{ _uid: string }>;
      total: number;
    }>('');
    expect(list.total).toBe(15);
    expect(list.items.map(entity => entity._uid)).toEqual(
      expect.arrayContaining(['00000000-0000-0000-0003-000000000001', frontendAppId])
    );

    const tree = await request<{
      nodes: Array<{ _uid: string; _isMatch: boolean }>;
      edges: Array<{ childId: string; parentId: string }>;
    }>('/tree');
    expect(tree.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ _uid: frontendAppId, _isMatch: true }),
        expect.objectContaining({ _uid: customerPortalId, _isMatch: false })
      ])
    );
    expect(tree.edges).toEqual(
      expect.arrayContaining([{ childId: frontendAppId, parentId: customerPortalId }])
    );
  });

  test('returns HTTP 400 for invalid serialized IR', async ({ server, auth }) => {
    const invalidQuery = {
      root: {
        kind: 'predicate',
        path: [],
        fieldId: 'not_a_schema_field',
        op: 'equals',
        value: 'x'
      }
    };
    const params = new URLSearchParams({ entityQuery: JSON.stringify(invalidQuery) });
    const response = await fetch(`${server.baseUrl}/api/default/data?${params}`, {
      headers: { Authorization: auth }
    });

    expect(response.status).toBe(400);
  });

  test('requires authentication for EntityQuery requests', async ({ server }) => {
    const anonOrpc = createTestORPCClient(server.baseUrl);
    await expect(
      anonOrpc.entities.list({
        params: { workspace: 'default' },
        query: { entityQuery: identityAnchoredQuery }
      })
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });
});
