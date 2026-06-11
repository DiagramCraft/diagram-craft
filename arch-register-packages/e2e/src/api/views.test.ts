import { createApiTest, expect, createTestORPCClient } from '../helpers/fixtures';
import { makeAuthHeader, seedCatalogViews, seedIds } from '../helpers/seedHelper';
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
    viewMode: 'table' as const,
    filters: {
      status: seedIds.lifecycle.production,
      q: 'test'
    },
    config: null
  };

  test('CRUD operations for saved views', async ({ orpc }) => {
    // 1. List views (should include seeded views)
    const views = await orpc.views.list({ params: { workspace: 'default' } });
    expect(Array.isArray(views)).toBe(true);
    expect(views.length).toBeGreaterThanOrEqual(3); // Seeded views

    // 2. Create a new view
    const created = await orpc.views.create({ params: { workspace: 'default' }, body: viewData });
    expect(created.name).toBe(viewData.name);
    expect(created.viewMode).toBe(viewData.viewMode);
    expect(created.filters).toEqual(viewData.filters);
    const viewId = created.id;

    // 3. Update the view
    const updated = await orpc.views.update({
      params: { workspace: 'default', id: viewId },
      body: { name: 'Updated E2E View' }
    });
    expect(updated.name).toBe('Updated E2E View');
    expect(updated.id).toBe(viewId);

    // 4. Delete the view
    const deleted = await orpc.views.remove({ params: { workspace: 'default', id: viewId } });
    expect(deleted.success).toBe(true);

    // 5. Verify deletion
    const viewsAfter = await orpc.views.list({ params: { workspace: 'default' } });
    expect(viewsAfter.find(v => v.id === viewId)).toBeUndefined();
  });

  test('returns 401 without auth', async ({ server }) => {
    const anonOrpc = createTestORPCClient(server.baseUrl);
    await expect(
      anonOrpc.views.list({ params: { workspace: 'default' } })
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  test('returns 404 for unknown workspace', async ({ orpc }) => {
    await expect(
      orpc.views.list({ params: { workspace: 'nonexistent' } })
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  test('validation: name is required', async ({ orpc }) => {
    await expect(
      orpc.views.create({ params: { workspace: 'default' }, body: { ...viewData, name: '' } })
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  test('viewer can list views but cannot create or update them', async ({ server }) => {
    const now = new Date('2026-01-01T00:00:00.000Z');
    const passwordHash = await hashPassword('ViewerPassword123!');

    await server.db.auth.createUser({
      id: 'views-viewer',
      user_id: 'views-viewer',
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
    await server.db.workspace.setWorkspaceMemberRole(
      seedIds.workspace.default,
      'views-viewer',
      'viewer',
      now
    );

    const viewerAuth = await makeAuthHeader(server.db, 'views-viewer');
    const viewerOrpc = createTestORPCClient(server.baseUrl, viewerAuth);

    const views = await viewerOrpc.views.list({ params: { workspace: 'default' } });
    expect(views.length).toBeGreaterThan(0);

    await expect(
      viewerOrpc.views.create({ params: { workspace: 'default' }, body: viewData })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });

    await expect(
      viewerOrpc.views.update({
        params: { workspace: 'default', id: views[0]!.id },
        body: { name: 'Should not be allowed' }
      })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});
