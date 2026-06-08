import { createApiTest, expect } from '../helpers/fixtures';
import { makeAuthHeader, seedCatalogEntities } from '../helpers/seedHelper';

const componentId = '00000000-0000-0000-0003-000000000002';
const editorUserId = 'test-editor';

const test = createApiTest({
  afterSeed: async server => {
    await seedCatalogEntities(server.db);
    const now = new Date();
    await server.db.auth.createUser({
      id: editorUserId,
      email: 'editor@e2e.test',
      display_name: 'E2E Editor',
      auth_provider: 'local',
      password_hash: null,
      oidc_issuer: null,
      oidc_subject: null,
      is_active: true,
      color: null,
      created_at: now,
      updated_at: now,
      last_login_at: null
    });
    await server.db.workspace.setWorkspaceMemberRole('default', editorUserId, 'admin', now);
  }
}).extend<{ editorAuth: string }>({
  editorAuth: [
    async ({ server }, use) => {
      await use(await makeAuthHeader(server.db, editorUserId));
    },
    { scope: 'file' }
  ]
});

const jsonHeaders = (auth: string) => ({
  Authorization: auth,
  'Content-Type': 'application/json'
});

const getEntity = async (baseUrl: string, auth: string, entityId: string) => {
  const res = await fetch(`${baseUrl}/api/default/data/${entityId}`, {
    headers: { Authorization: auth }
  });
  expect(res.status).toBe(200);
  return (await res.json()) as Record<string, unknown>;
};

const resetInbox = async (baseUrl: string, auth: string) => {
  await fetch(`${baseUrl}/api/default/notifications`, {
    method: 'DELETE',
    headers: { Authorization: auth }
  });
  await fetch(`${baseUrl}/api/default/watching/${componentId}`, {
    method: 'DELETE',
    headers: { Authorization: auth }
  });
};

test.describe('entity watch notifications', () => {
  test('watching an entity and updating it as another user creates an unread notification', async ({
    server,
    auth,
    editorAuth
  }) => {
    await resetInbox(server.baseUrl, auth);

    const watchRes = await fetch(`${server.baseUrl}/api/default/watching`, {
      method: 'POST',
      headers: jsonHeaders(auth),
      body: JSON.stringify({ entity_id: componentId })
    });
    expect(watchRes.status).toBe(200);

    const beforeCountRes = await fetch(`${server.baseUrl}/api/default/notifications/count`, {
      headers: { Authorization: auth }
    });
    expect(beforeCountRes.status).toBe(200);
    expect(await beforeCountRes.json()).toEqual({ count: 0 });

    const entity = await getEntity(server.baseUrl, editorAuth, componentId);
    const updateRes = await fetch(`${server.baseUrl}/api/default/data/${componentId}`, {
      method: 'PUT',
      headers: jsonHeaders(editorAuth),
      body: JSON.stringify({
        ...entity,
        _description: 'Updated by editor for notification testing'
      })
    });
    expect(updateRes.status).toBe(200);

    const countRes = await fetch(`${server.baseUrl}/api/default/notifications/count`, {
      headers: { Authorization: auth }
    });
    expect(countRes.status).toBe(200);
    expect(await countRes.json()).toEqual({ count: 1 });

    const notificationsRes = await fetch(`${server.baseUrl}/api/default/notifications`, {
      headers: { Authorization: auth }
    });
    expect(notificationsRes.status).toBe(200);
    const notifications = (await notificationsRes.json()) as Array<Record<string, unknown>>;
    expect(notifications).toEqual([
      expect.objectContaining({
        entity_id: componentId,
        operation: 'update',
        changed_by_user_id: editorUserId,
        changed_by_display_name: 'E2E Editor'
      })
    ]);
  });

  test('deleting a notification removes it from the unread count', async ({
    server,
    auth,
    editorAuth
  }) => {
    await resetInbox(server.baseUrl, auth);

    await fetch(`${server.baseUrl}/api/default/watching`, {
      method: 'POST',
      headers: jsonHeaders(auth),
      body: JSON.stringify({ entity_id: componentId })
    });

    const entity = await getEntity(server.baseUrl, editorAuth, componentId);
    await fetch(`${server.baseUrl}/api/default/data/${componentId}`, {
      method: 'PUT',
      headers: jsonHeaders(editorAuth),
      body: JSON.stringify({
        ...entity,
        _description: 'Another update to create a notification'
      })
    });

    const notificationsRes = await fetch(`${server.baseUrl}/api/default/notifications`, {
      headers: { Authorization: auth }
    });
    const notifications = (await notificationsRes.json()) as Array<{ id: string }>;
    expect(notifications).toHaveLength(1);

    const deleteRes = await fetch(
      `${server.baseUrl}/api/default/notifications/${notifications[0]!.id}`,
      {
        method: 'DELETE',
        headers: { Authorization: auth }
      }
    );
    expect(deleteRes.status).toBe(200);

    const countRes = await fetch(`${server.baseUrl}/api/default/notifications/count`, {
      headers: { Authorization: auth }
    });
    expect(await countRes.json()).toEqual({ count: 0 });
  });

  test('clear all removes all unread notifications and self-authored changes are ignored', async ({
    server,
    auth,
    editorAuth
  }) => {
    await resetInbox(server.baseUrl, auth);

    await fetch(`${server.baseUrl}/api/default/watching`, {
      method: 'POST',
      headers: jsonHeaders(auth),
      body: JSON.stringify({ entity_id: componentId })
    });

    const selfEntity = await getEntity(server.baseUrl, auth, componentId);
    const selfUpdateRes = await fetch(`${server.baseUrl}/api/default/data/${componentId}`, {
      method: 'PUT',
      headers: jsonHeaders(auth),
      body: JSON.stringify({
        ...selfEntity,
        _description: 'Self-authored update should not notify'
      })
    });
    expect(selfUpdateRes.status).toBe(200);

    const zeroCountRes = await fetch(`${server.baseUrl}/api/default/notifications/count`, {
      headers: { Authorization: auth }
    });
    expect(await zeroCountRes.json()).toEqual({ count: 0 });

    for (const description of ['External update one', 'External update two']) {
      const entity = await getEntity(server.baseUrl, editorAuth, componentId);
      const updateRes = await fetch(`${server.baseUrl}/api/default/data/${componentId}`, {
        method: 'PUT',
        headers: jsonHeaders(editorAuth),
        body: JSON.stringify({
          ...entity,
          _description: description
        })
      });
      expect(updateRes.status).toBe(200);
    }

    const clearRes = await fetch(`${server.baseUrl}/api/default/notifications`, {
      method: 'DELETE',
      headers: { Authorization: auth }
    });
    expect(clearRes.status).toBe(200);
    expect(await clearRes.json()).toMatchObject({ success: true, count: 2 });

    const finalCountRes = await fetch(`${server.baseUrl}/api/default/notifications/count`, {
      headers: { Authorization: auth }
    });
    expect(await finalCountRes.json()).toEqual({ count: 0 });
  });
});
