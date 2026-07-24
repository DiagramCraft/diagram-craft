import { createApiTest, expect } from '../helpers/fixtures';
import { makeAuthHeader, seedCatalogEntities, seedIds } from '../helpers/seedHelper';
import { TEST_EDITOR_ID } from '../helpers/testIds';

const componentId = '00000000-0000-0000-0003-000000000002';
const editorUserId = TEST_EDITOR_ID;

const test = createApiTest({
  afterSeed: async server => {
    await seedCatalogEntities(server.db);
    const now = new Date();
    await server.db.auth.createUser({
      id: editorUserId,
      user_id: 'test-editor',
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
    await server.db.workspace.setWorkspaceMemberRole(
      seedIds.workspace.default,
      editorUserId,
      'admin',
      now
    );
    await server.db.workspace.replaceTeamAssignments(seedIds.workspace.default, [
      {
        workspace: seedIds.workspace.default,
        team_id: seedIds.teams.design,
        user_id: editorUserId,
        role: 'team_editor',
        created_at: now
      }
    ]);
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
  'Authorization': auth,
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
  await fetch(`${baseUrl}/api/default/pinned-entities/${componentId}`, {
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

  test('notifies entity owners about comments and comment authors about replies', async ({
    server,
    auth,
    editorAuth
  }) => {
    await resetInbox(server.baseUrl, auth);
    await resetInbox(server.baseUrl, editorAuth);

    const rootRes = await fetch(`${server.baseUrl}/api/default/discussions`, {
      method: 'POST',
      headers: jsonHeaders(auth),
      body: JSON.stringify({
        objectType: 'entity',
        objectId: componentId,
        body: 'A new entity discussion'
      })
    });
    expect(rootRes.status).toBe(200);

    const ownerNotificationsRes = await fetch(`${server.baseUrl}/api/default/notifications`, {
      headers: { Authorization: editorAuth }
    });
    const ownerNotifications = (await ownerNotificationsRes.json()) as Array<
      Record<string, unknown>
    >;
    expect(ownerNotifications).toEqual([
      expect.objectContaining({
        event_type: 'comment.created',
        resource_type: 'comment',
        message: 'E2E Admin commented on Frontend App',
        action_route: '/entities/CMP-2?tab=discussions'
      })
    ]);

    await resetInbox(server.baseUrl, editorAuth);
    const editorRootRes = await fetch(`${server.baseUrl}/api/default/discussions`, {
      method: 'POST',
      headers: jsonHeaders(editorAuth),
      body: JSON.stringify({
        objectType: 'entity',
        objectId: componentId,
        body: 'Owner comment'
      })
    });
    expect(editorRootRes.status).toBe(200);
    const editorRoot = (await editorRootRes.json()) as { id: string };

    const replyRes = await fetch(`${server.baseUrl}/api/default/discussions`, {
      method: 'POST',
      headers: jsonHeaders(auth),
      body: JSON.stringify({
        objectType: 'entity',
        objectId: componentId,
        parentPostId: editorRoot.id,
        body: 'A reply to the owner comment'
      })
    });
    expect(replyRes.status).toBe(200);

    const replyNotificationsRes = await fetch(`${server.baseUrl}/api/default/notifications`, {
      headers: { Authorization: editorAuth }
    });
    const replyNotifications = (await replyNotificationsRes.json()) as Array<
      Record<string, unknown>
    >;
    expect(replyNotifications).toEqual([
      expect.objectContaining({
        event_type: 'comment.replied',
        resource_type: 'comment',
        message: 'E2E Admin replied to your comment on Frontend App'
      })
    ]);
  });

  test('notifies a content author about inline comments and links to the thread', async ({
    server,
    auth,
    editorAuth
  }) => {
    await resetInbox(server.baseUrl, editorAuth);

    const documentRes = await fetch(`${server.baseUrl}/api/default/content/markdown`, {
      method: 'POST',
      headers: jsonHeaders(editorAuth),
      body: JSON.stringify({ name: 'Inline Review' })
    });
    expect(documentRes.status).toBe(200);
    const document = (await documentRes.json()) as { id: string };
    const commentRes = await fetch(`${server.baseUrl}/api/default/wiki-comments`, {
      method: 'POST',
      headers: jsonHeaders(auth),
      body: JSON.stringify({
        nodeId: document.id,
        body: 'Please review this line',
        anchor: { quote: 'review', prefix: 'Please ', suffix: ' this', start: 7, end: 13 }
      })
    });
    expect(commentRes.status).toBe(200);
    const comment = (await commentRes.json()) as { id: string };

    const notificationsRes = await fetch(`${server.baseUrl}/api/default/notifications`, {
      headers: { Authorization: editorAuth }
    });
    const notifications = (await notificationsRes.json()) as Array<Record<string, unknown>>;
    expect(notifications).toEqual([
      expect.objectContaining({
        event_type: 'comment.created',
        resource_id: comment.id,
        message: 'E2E Admin commented on Inline Review',
        action_route: `/content/wiki/${document.id}?commentId=${comment.id}`
      })
    ]);
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

test.describe('pinned entities API', () => {
  test('pinning and unpinning an entity is per-user', async ({ server, auth, editorAuth }) => {
    await resetInbox(server.baseUrl, auth);
    await resetInbox(server.baseUrl, editorAuth);

    const createRes = await fetch(`${server.baseUrl}/api/default/pinned-entities`, {
      method: 'POST',
      headers: jsonHeaders(auth),
      body: JSON.stringify({ entity_id: componentId })
    });
    expect(createRes.status).toBe(200);
    expect(await createRes.json()).toEqual(
      expect.objectContaining({
        entity_id: componentId
      })
    );

    const ownPinsRes = await fetch(`${server.baseUrl}/api/default/pinned-entities`, {
      headers: { Authorization: auth }
    });
    expect(ownPinsRes.status).toBe(200);
    expect(await ownPinsRes.json()).toEqual([
      expect.objectContaining({
        entity_id: componentId
      })
    ]);

    const otherPinsRes = await fetch(`${server.baseUrl}/api/default/pinned-entities`, {
      headers: { Authorization: editorAuth }
    });
    expect(otherPinsRes.status).toBe(200);
    expect(await otherPinsRes.json()).toEqual([]);

    const deleteRes = await fetch(`${server.baseUrl}/api/default/pinned-entities/${componentId}`, {
      method: 'DELETE',
      headers: { Authorization: auth }
    });
    expect(deleteRes.status).toBe(200);
    expect(await deleteRes.json()).toMatchObject({
      success: true,
      message: `Entity '${componentId}' unpinned`
    });

    const afterDeleteRes = await fetch(`${server.baseUrl}/api/default/pinned-entities`, {
      headers: { Authorization: auth }
    });
    expect(afterDeleteRes.status).toBe(200);
    expect(await afterDeleteRes.json()).toEqual([]);
  });
});
