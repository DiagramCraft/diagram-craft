import { createPermissionApiTest, expect } from '../helpers/permissionFixtures';

const componentId = '00000000-0000-0000-0003-000000000002';

const test = createPermissionApiTest();

const jsonHeaders = (auth: string) => ({
  Authorization: auth,
  'Content-Type': 'application/json'
});

test.describe('watch and notification permission routes', () => {
  test('authentication: notification routes return 401 without auth', async ({ server }) => {
    const res = await fetch(`${server.baseUrl}/api/default/notifications/count`);
    expect(res.status).toBe(401);
  });

  test('authorization: outsider cannot access watches or notifications', async ({
    server,
    personas
  }) => {
    const countRes = await fetch(`${server.baseUrl}/api/default/notifications/count`, {
      headers: { Authorization: personas.outsider.auth }
    });
    expect(countRes.status).toBe(403);

    const watchRes = await fetch(`${server.baseUrl}/api/default/watching`, {
      method: 'POST',
      headers: jsonHeaders(personas.outsider.auth),
      body: JSON.stringify({ entity_id: componentId })
    });
    expect(watchRes.status).toBe(403);
  });

  test('authorization: pinned entity endpoints require ws.view permission', async ({
    server,
    personas
  }) => {
    const listRes = await fetch(`${server.baseUrl}/api/default/pinned-entities`, {
      headers: { Authorization: personas.outsider.auth }
    });
    expect(listRes.status).toBe(403);

    const createRes = await fetch(`${server.baseUrl}/api/default/pinned-entities`, {
      method: 'POST',
      headers: jsonHeaders(personas.outsider.auth),
      body: JSON.stringify({ entity_id: componentId })
    });
    expect(createRes.status).toBe(403);

    const deleteRes = await fetch(`${server.baseUrl}/api/default/pinned-entities/${componentId}`, {
      method: 'DELETE',
      headers: { Authorization: personas.outsider.auth }
    });
    expect(deleteRes.status).toBe(403);
  });
});
