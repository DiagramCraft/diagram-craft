import type { EntityQuery } from '@arch-register/api-types/entityQueryIR';
import { seededUsers } from '@arch-register/server/db/seedFixtures';
import { createApiTest, expect } from '../helpers/fixtures';
import { makeAuthHeader } from '../helpers/seedHelper';
import type { TestServer } from '../helpers/serverHelper';

const test = createApiTest({ seed: 'bootstrap' }).extend<{ auth: string }>({
  auth: [
    async ({ server }, use) => {
      await use(await makeAuthHeader(server.db, seededUsers.globalAdmin.id));
    },
    { scope: 'file' }
  ]
});

const relationSchemaId = '00000000-0000-0000-0000-000000000030';
const relationIds = [
  '00000000-0000-0000-0009-000000000001',
  '00000000-0000-0000-0009-000000000002',
  '00000000-0000-0000-0009-000000000003'
];

const allRelationsQuery: EntityQuery = {
  schemaId: relationSchemaId,
  root: { kind: 'predicate', path: [], fieldId: '_id', op: 'not_empty', value: '' }
};

const queryRelations = async <T>(
  server: TestServer,
  auth: string | undefined,
  relationQuery: EntityQuery,
  options: { view?: 'summary' | 'full'; limit?: number; offset?: number } = {}
) => {
  const query = new URLSearchParams({ relationQuery: JSON.stringify(relationQuery) });
  if (options.view) query.set('view', options.view);
  if (options.limit !== undefined) query.set('limit', String(options.limit));
  if (options.offset !== undefined) query.set('offset', String(options.offset));
  const headers = auth ? { Authorization: auth } : undefined;
  const response = await fetch(
    `${server.baseUrl}/api/application/v1/default/relations/query?${query}`,
    { headers }
  );
  expect(response.status).toBe(200);
  return (await response.json()) as T;
};

test.describe('RelationQuery HTTP routes', () => {
  test('lists relation-rooted records and returns an accurate total', async ({ server, auth }) => {
    const page = await queryRelations<{
      items: Array<Record<string, unknown> & { _uid: string }>;
      total: number;
    }>(server, auth, allRelationsQuery, { view: 'full' });

    expect(page.total).toBe(3);
    expect(page.items.map(relation => relation._uid)).toEqual(expect.arrayContaining(relationIds));
    expect(page.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          _uid: relationIds[0],
          data_classification: 'sensitive',
          protocol: 'https-rest'
        })
      ])
    );
  });

  test('filters relation-rooted records by a relation field', async ({ server, auth }) => {
    const query: EntityQuery = {
      schemaId: relationSchemaId,
      root: {
        kind: 'predicate',
        path: [],
        fieldId: 'data_classification',
        op: 'equals',
        value: 'sensitive'
      }
    };

    const page = await queryRelations<{
      items: Array<{ _uid: string }>;
      total: number;
    }>(server, auth, query, { view: 'summary' });

    expect(page.total).toBe(2);
    expect(page.items.map(relation => relation._uid)).toEqual(
      expect.arrayContaining([relationIds[0], relationIds[2]])
    );
    expect(page.items.map(relation => relation._uid)).not.toContain(relationIds[1]);
  });

  test('accepts a serialized relation query over GET and paginates in SQL', async ({
    server,
    auth
  }) => {
    const params = new URLSearchParams({
      relationQuery: JSON.stringify(allRelationsQuery),
      view: 'full',
      limit: '1',
      offset: '1'
    });
    const response = await fetch(
      `${server.baseUrl}/api/application/v1/default/relations/query?${params}`,
      { headers: { Authorization: auth } }
    );

    expect(response.status).toBe(200);
    const page = (await response.json()) as {
      items: Array<{ _uid: string }>;
      total: number;
    };

    expect(page.total).toBe(3);
    expect(page.items).toHaveLength(1);
    expect(relationIds).toContain(page.items[0]?._uid);

    const firstPageBody = await queryRelations<{ items: Array<{ _uid: string }> }>(
      server,
      auth,
      allRelationsQuery,
      { limit: 1, offset: 0 }
    );
    const lastPageBody = await queryRelations<{ items: Array<{ _uid: string }> }>(
      server,
      auth,
      allRelationsQuery,
      { limit: 1, offset: 2 }
    );
    const pagedIds = [...firstPageBody.items, ...page.items, ...lastPageBody.items].map(
      relation => relation._uid
    );

    expect(new Set(pagedIds).size).toBe(3);
    expect(new Set(pagedIds)).toEqual(new Set(relationIds));
  });

  test('returns HTTP 400 for an invalid serialized relation query', async ({ server, auth }) => {
    const invalidQuery = {
      schemaId: relationSchemaId,
      root: {
        kind: 'predicate',
        path: [],
        fieldId: 'not_a_relation_field',
        op: 'equals',
        value: 'x'
      }
    };
    const params = new URLSearchParams({ relationQuery: JSON.stringify(invalidQuery) });
    const response = await fetch(
      `${server.baseUrl}/api/application/v1/default/relations/query?${params}`,
      { headers: { Authorization: auth } }
    );

    expect(response.status).toBe(400);
  });

  test('requires authentication for relation-rooted queries', async ({ server }) => {
    const params = new URLSearchParams({ relationQuery: JSON.stringify(allRelationsQuery) });
    const response = await fetch(
      `${server.baseUrl}/api/application/v1/default/relations/query?${params}`
    );

    expect(response.status).toBe(401);
  });
});
