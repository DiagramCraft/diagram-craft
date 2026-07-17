import { seedEntities } from '@arch-register/server/db/seedData';
import { createPermissionApiTest, expect } from '../helpers/permissionFixtures';
import { seedIds } from '../helpers/seedHelper';

const test = createPermissionApiTest();

test.describe('diagram craft permission routes', () => {
  test('authentication: public diagram craft routes still require auth', async ({ server }) => {
    const res = await fetch(`${server.baseUrl}/api/public/default/schemas`);
    expect(res.status).toBe(401);
  });

  test('authorization: ws.view is required for schemas and data', async ({ server, personas }) => {
    const schemasRes = await fetch(`${server.baseUrl}/api/public/default/schemas`, {
      headers: { Authorization: personas.outsider.auth }
    });
    expect(schemasRes.status).toBe(403);

    const dataRes = await fetch(`${server.baseUrl}/api/public/default/data`, {
      headers: { Authorization: personas.outsider.auth }
    });
    expect(dataRes.status).toBe(403);
  });

  test('authorized users receive workspace data only', async ({ server, personas }) => {
    const dataRes = await fetch(`${server.baseUrl}/api/public/default/data`, {
      headers: { Authorization: personas.workspaceViewer.auth }
    });

    expect(dataRes.status).toBe(200);
    const body = (await dataRes.json()) as Array<{ _name: string }>;
    const expectedNames = seedEntities
      .filter(entity => entity.workspace === seedIds.workspace.default)
      .map(entity => entity.name)
      .sort();
    expect(body.map(entity => entity._name).sort()).toEqual(expectedNames);
  });
});
