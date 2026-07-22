import { createApiTest, expect, createTestORPCClient } from '../helpers/fixtures';
import { seedCatalogViews, seedIds } from '../helpers/seedHelper';

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
      q: 'test',
      entityQuery: { root: { kind: 'and', children: [] } }
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

  test('project-scoped views are isolated to their project and can be listed with workspace views', async ({
    orpc
  }) => {
    const project = await orpc.projects.create({
      params: { workspace: 'default' },
      body: { name: 'Views Project Scope Test' }
    });
    const projectId = project.id;
    const created = await orpc.views.create({
      params: { workspace: 'default' },
      body: {
        ...viewData,
        scope: 'project',
        projectId,
        projectScope: 'project'
      }
    });

    expect(created.scope).toBe('project');
    expect(created.projectId).toBe(projectId);
    expect(created.projectScope).toBe('project');

    const projectViews = await orpc.views.list({
      params: { workspace: 'default' },
      query: { projectId, includeWorkspace: true }
    });
    expect(projectViews.some(view => view.id === created.id)).toBe(true);
    expect(projectViews.some(view => view.scope === 'workspace')).toBe(true);

    const workspaceViews = await orpc.views.list({ params: { workspace: 'default' } });
    expect(workspaceViews.some(view => view.id === created.id)).toBe(false);
  });

  test('returns 401 without auth', async ({ server }) => {
    const anonOrpc = createTestORPCClient(server.baseUrl);
    await expect(anonOrpc.views.list({ params: { workspace: 'default' } })).rejects.toMatchObject({
      code: 'UNAUTHORIZED'
    });
  });

  test('returns 404 for unknown workspace', async ({ orpc }) => {
    await expect(orpc.views.list({ params: { workspace: 'nonexistent' } })).rejects.toMatchObject({
      code: 'NOT_FOUND'
    });
  });

  test('validation: name is required', async ({ orpc }) => {
    await expect(
      orpc.views.create({ params: { workspace: 'default' }, body: { ...viewData, name: '' } })
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });
});
