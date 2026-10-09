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

  test('add, re-icon, reorder and delete dashboards inside an application', async ({ orpc }) => {
    const app = await orpc.workspaceApplications.create({
      params,
      body: { key: 'dash-app', name: 'Dash app' }
    });
    const appParams = { ...params, id: app.id };

    const added = await orpc.dashboard.create({
      params,
      body: { name: 'Second', icon: 'TbBook', applicationId: app.id }
    });
    expect(added.applicationId).toBe(app.id);
    expect(added.icon).toBe('TbBook');

    await expect(
      orpc.dashboard.create({
        params,
        body: { name: 'Bad', icon: 'not an icon', applicationId: app.id }
      })
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });

    await orpc.dashboard.update({
      params: { ...params, id: added.id },
      body: { name: 'Renamed', icon: 'TbApi' }
    });
    const [listed] = (await orpc.workspaceApplications.list({ params })).filter(
      candidate => candidate.id === app.id
    );
    const ids = listed!.dashboards.map(d => d.id);
    expect(ids).toHaveLength(2);
    expect(listed!.dashboards[1]).toMatchObject({ name: 'Renamed', icon: 'TbApi' });

    await orpc.dashboard.update({
      params: { ...params, id: added.id },
      body: { railLabel: 'Short' }
    });
    const relabelled = (await orpc.workspaceApplications.list({ params })).find(
      candidate => candidate.id === app.id
    );
    expect(relabelled!.dashboards.find(d => d.id === added.id)?.railLabel).toBe('Short');

    // Application dashboards never show up in the home dashboard list
    expect((await orpc.dashboard.list({ params })).map(d => d.id)).not.toContain(added.id);

    const reversed = [...ids].reverse();
    const reordered = await orpc.workspaceApplications.reorderDashboards({
      params: appParams,
      body: { ids: reversed }
    });
    expect(reordered.map(d => d.id)).toEqual(reversed);

    const other = await orpc.workspaceApplications.create({
      params,
      body: { key: 'other-dash-app', name: 'Other dash app' }
    });
    const foreignId = (await orpc.workspaceApplications.list({ params }))
      .find(candidate => candidate.id === other.id)!
      .dashboards.map(d => d.id)[0]!;
    const invalidOrders = {
      missing: [reversed[0]!],
      duplicate: [reversed[0]!, reversed[0]!],
      foreign: [reversed[0]!, foreignId]
    };
    for (const invalid of Object.values(invalidOrders)) {
      await expect(
        orpc.workspaceApplications.reorderDashboards({ params: appParams, body: { ids: invalid } })
      ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
      const current = (await orpc.workspaceApplications.list({ params })).find(
        candidate => candidate.id === app.id
      );
      expect(current!.dashboards.map(d => d.id)).toEqual(reversed);
    }
    await orpc.workspaceApplications.remove({ params: { ...params, id: other.id } });

    await orpc.dashboard.remove({ params: { ...params, id: added.id } });
    await expect(
      orpc.dashboard.remove({ params: { ...params, id: ids.find(id => id !== added.id)! } })
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });

    await orpc.workspaceApplications.remove({ params: appParams });
  });
});
