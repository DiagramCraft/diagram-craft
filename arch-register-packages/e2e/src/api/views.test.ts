import { createApiTest, expect } from '../helpers/fixtures';
import { makeAuthHeader, seedCatalogViews } from '../helpers/seedHelper';
import { hashPassword } from '@arch-register/server/utils/password';

const test = createApiTest({
  afterSeed: async server => {
    await seedCatalogViews(server.db);
  }
});

test.describe('Saved Views API', () => {
  const viewData = {
    name: 'E2E Test View',
    description: 'A view created by E2E tests',
    viewMode: 'table',
    filters: {
      status: 'production',
      q: 'test'
    },
    config: null
  };

  test('CRUD operations for saved views', async ({ server, auth }) => {
    // 1. List views (should include seeded views)
    const listRes = await fetch(`${server.baseUrl}/api/default/views`, {
      headers: { Authorization: auth }
    });
    expect(listRes.status).toBe(200);
    const views = (await listRes.json()) as any[];
    expect(Array.isArray(views)).toBe(true);
    expect(views.length).toBeGreaterThanOrEqual(3); // Seeded views

    // 2. Create a new view
    const createRes = await fetch(`${server.baseUrl}/api/default/views`, {
      method: 'POST',
      headers: { 
        Authorization: auth,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(viewData)
    });
    expect(createRes.status).toBe(200);
    const created = await createRes.json();
    expect(created.name).toBe(viewData.name);
    expect(created.viewMode).toBe(viewData.viewMode);
    expect(created.filters).toEqual(viewData.filters);
    const viewId = created.id;

    // 3. Update the view
    const updateData = { name: 'Updated E2E View' };
    const updateRes = await fetch(`${server.baseUrl}/api/default/views/${viewId}`, {
      method: 'PATCH',
      headers: { 
        Authorization: auth,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updateData)
    });
    expect(updateRes.status).toBe(200);
    const updated = await updateRes.json();
    expect(updated.name).toBe(updateData.name);
    expect(updated.id).toBe(viewId);

    // 4. Delete the view
    const deleteRes = await fetch(`${server.baseUrl}/api/default/views/${viewId}`, {
      method: 'DELETE',
      headers: { Authorization: auth }
    });
    expect(deleteRes.status).toBe(200);
    const deleted = await deleteRes.json();
    expect(deleted.success).toBe(true);

    // 5. Verify deletion
    const listResAfter = await fetch(`${server.baseUrl}/api/default/views`, {
      headers: { Authorization: auth }
    });
    const viewsAfter = (await listResAfter.json()) as any[];
    expect(viewsAfter.find(v => v.id === viewId)).toBeUndefined();
  });

  test('returns 401 without auth', async ({ server }) => {
    const res = await fetch(`${server.baseUrl}/api/default/views`);
    expect(res.status).toBe(401);
  });

  test('returns 404 for unknown workspace', async ({ server, auth }) => {
    const res = await fetch(`${server.baseUrl}/api/nonexistent/views`, {
      headers: { Authorization: auth }
    });
    expect(res.status).toBe(404);
  });

  test('validation: name is required', async ({ server, auth }) => {
    const res = await fetch(`${server.baseUrl}/api/default/views`, {
      method: 'POST',
      headers: { 
        Authorization: auth,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ ...viewData, name: '' })
    });
    expect(res.status).toBe(400);
  });

  test('viewer can list views but cannot create or update them', async ({ server }) => {
    const now = new Date('2026-01-01T00:00:00.000Z');
    const passwordHash = await hashPassword('ViewerPassword123!');

    await server.db.identityAuth.createUser({
      id: 'views-viewer',
      email: 'views-viewer@example.com',
      display_name: 'Views Viewer',
      auth_provider: 'local',
      password_hash: passwordHash,
      oidc_issuer: null,
      oidc_subject: null,
      is_active: true,
      color: null,
      created_at: now,
      updated_at: now,
      last_login_at: null
    });
    await server.db.workspaceAdmin.setWorkspaceMemberRole('default', 'views-viewer', 'viewer', now);

    const viewerAuth = await makeAuthHeader(server.db, 'views-viewer');

    const listRes = await fetch(`${server.baseUrl}/api/default/views`, {
      headers: { Authorization: viewerAuth }
    });
    expect(listRes.status).toBe(200);
    const views = (await listRes.json()) as Array<{ id: string }>;
    expect(views.length).toBeGreaterThan(0);

    const createRes = await fetch(`${server.baseUrl}/api/default/views`, {
      method: 'POST',
      headers: {
        Authorization: viewerAuth,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(viewData)
    });
    expect(createRes.status).toBe(403);

    const updateRes = await fetch(`${server.baseUrl}/api/default/views/${views[0]!.id}`, {
      method: 'PATCH',
      headers: {
        Authorization: viewerAuth,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ name: 'Should not be allowed' })
    });
    expect(updateRes.status).toBe(403);
  });
});
