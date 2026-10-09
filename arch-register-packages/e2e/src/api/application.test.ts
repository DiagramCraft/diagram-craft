import { createApiTest, expect } from '../helpers/fixtures';

const test = createApiTest();
const params = { workspace: 'default' };

test.describe('Workspace Application API', () => {
  test('list returns the seeded built-in applications in order', async ({ orpc }) => {
    const apps = await orpc.workspaceApplications.list({ params });
    expect(apps.map(app => app.key)).toEqual([
      'business-glossary',
      'strategy-model',
      'vendor-management',
      'risk-compliance',
      'data-stewardship',
      'api-integration-catalog'
    ]);
  });

  test('create, update, reorder and delete an application', async ({ orpc }) => {
    const created = await orpc.workspaceApplications.create({
      params,
      body: { key: 'custom-app', name: 'Custom', accentColor: 'oklch(0.6 0.1 200)' }
    });
    expect(created.key).toBe('custom-app');

    await expect(
      orpc.workspaceApplications.create({ params, body: { key: 'custom-app', name: 'Again' } })
    ).rejects.toMatchObject({ code: 'CONFLICT' });
    await expect(
      orpc.workspaceApplications.create({ params, body: { key: 'home', name: 'Home' } })
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });

    const renamed = await orpc.workspaceApplications.update({
      params: { ...params, id: created.id },
      body: { name: 'Renamed', accentColor: null }
    });
    expect(renamed.name).toBe('Renamed');
    expect(renamed.accentColor).toBeNull();

    const before = await orpc.workspaceApplications.list({ params });
    const reversed = [...before].reverse().map(app => app.id);
    const reordered = await orpc.workspaceApplications.reorder({ params, body: { ids: reversed } });
    expect(reordered.map(app => app.id)).toEqual(reversed);

    await expect(
      orpc.workspaceApplications.reorder({ params, body: { ids: reversed.slice(1) } })
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });

    // Custom apps take part in access policies; deleting also drops the policy
    await orpc.config.applicationAccess.update({
      params: { ...params, applicationId: 'custom-app' },
      body: { mode: 'all_members', user_ids: [], team_ids: [] }
    });
    expect((await orpc.applications.accessible({ params })).installed_application_ids).toContain(
      'custom-app'
    );

    await orpc.workspaceApplications.remove({ params: { ...params, id: created.id } });
    expect(
      (await orpc.applications.accessible({ params })).installed_application_ids
    ).not.toContain('custom-app');
    await expect(
      orpc.workspaceApplications.remove({ params: { ...params, id: created.id } })
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});
