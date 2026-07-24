import { createPermissionApiTest, expect } from '../helpers/permissionFixtures';
import type { EntityQuery } from '@arch-register/api-types/entityQueryIR';

const test = createPermissionApiTest();

const componentSchemaId = '00000000-0000-0000-0000-000000000003';
const authServiceId = '00000000-0000-0000-0003-000000000003';

test.describe('EntityQuery permission routes', () => {
  test('does not let hidden related entities satisfy a traversal predicate', async ({
    personas
  }) => {
    const query: EntityQuery = {
      schemaId: componentSchemaId,
      root: {
        kind: 'predicate',
        path: [{ kind: 'forward', fieldId: 'depends_on' }],
        fieldId: '_id',
        op: 'equals',
        value: authServiceId
      }
    };

    const [list, count] = await Promise.all([
      personas.userWithExplicitEntityGrant.orpc.entities.list({
        params: { workspace: 'default' },
        query: { entityQuery: query }
      }),
      personas.userWithExplicitEntityGrant.orpc.entities.count({
        params: { workspace: 'default' },
        query: { entityQuery: query }
      })
    ]);

    expect(list.items).toEqual([]);
    expect(list.total).toBe(0);
    expect(count.total).toBe(0);
  });

  test('rejects EntityQuery project access for users without project access', async ({
    server,
    personas,
    resources
  }) => {
    const query: EntityQuery = { root: { kind: 'and', children: [] } };
    const response = await fetch(
      `${server.baseUrl}/api/default/data?${new URLSearchParams({
        projectId: resources.projectIds.authMigration,
        projectScope: 'project',
        entityQuery: JSON.stringify(query)
      })}`,
      { headers: { Authorization: personas.workspaceViewer.auth } }
    );

    expect(response.status).toBe(403);
  });
});
