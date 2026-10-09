import { test as baseTest, expect, createTestORPCClient } from '../helpers/fixtures';
import { makeAuthHeader } from '../helpers/seedHelper';
import { CONFIG_USER_ID } from '../helpers/testIds';
import { createFixtureUser } from '@arch-register/server/db/testSupport/fixtures';

const now = new Date('2026-06-06T12:00:00.000Z');

const APP_KEY = 'api-integration-catalog';
const params = { workspace: 'default' };

const test = baseTest.extend<{ memberId: string }>({
  memberId: [
    async ({ server, orpc }, use) => {
      await createFixtureUser(server.db, {
        id: CONFIG_USER_ID,
        user_id: 'config-user',
        email: 'config-user@e2e.test',
        display_name: 'Config User',
        password_hash: null,
        is_active: true,
        created_at: now,
        updated_at: now
      });
      await orpc.config.members.updateRole({
        params: { ...params, id: CONFIG_USER_ID },
        body: { roleId: 'viewer' }
      });
      await use(CONFIG_USER_ID);
    },
    { scope: 'file' }
  ]
});

test.describe('Application dashboard access', () => {
  test('enforces application policies on dashboard reads', async ({ server, orpc, memberId }) => {
    const memberOrpc = createTestORPCClient(
      server.baseUrl,
      await makeAuthHeader(server.db, memberId)
    );
    const appDashboard = await orpc.dashboard.getApp({ params: { ...params, appKey: APP_KEY } });
    const applicationId = appDashboard.applicationId!;
    const setPolicy = (body: {
      mode: 'all_members' | 'selected';
      user_ids: string[];
      team_ids: string[];
    }) => orpc.config.applicationAccess.update({
      params: { ...params, applicationId: APP_KEY },
      body
    });
    const listedKeys = async (client: typeof orpc) =>
      (await client.workspaceApplications.list({ params })).map(a => a.key);

    // No policy: ordinary member is denied, administrator is allowed
    await orpc.config.applicationAccess.reset({ params: { ...params, applicationId: APP_KEY } });
    await expect(
      memberOrpc.dashboard.get({ params: { ...params, id: appDashboard.id } })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(
      memberOrpc.dashboard.getApp({ params: { ...params, appKey: APP_KEY } })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(await listedKeys(memberOrpc)).not.toContain(APP_KEY);
    expect(await listedKeys(orpc)).toContain(APP_KEY);
    expect((await orpc.dashboard.get({ params: { ...params, id: appDashboard.id } })).id).toBe(
      appDashboard.id
    );

    // Selected policy excluding the member: still denied
    await setPolicy({ mode: 'selected', user_ids: [], team_ids: [] });
    await expect(
      memberOrpc.dashboard.getApp({ params: { ...params, appKey: APP_KEY } })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(await listedKeys(memberOrpc)).not.toContain(APP_KEY);
    expect((await orpc.dashboard.getApp({ params: { ...params, appKey: APP_KEY } })).id).toBe(
      appDashboard.id
    );

    // Selected policy including the member: allowed
    await setPolicy({ mode: 'selected', user_ids: [memberId], team_ids: [] });
    expect(
      (await memberOrpc.dashboard.get({ params: { ...params, id: appDashboard.id } })).id
    ).toBe(appDashboard.id);
    expect(
      (await memberOrpc.dashboard.getApp({ params: { ...params, appKey: APP_KEY } })).id
    ).toBe(appDashboard.id);
    const listed = await memberOrpc.workspaceApplications.list({ params });
    expect(listed.find(a => a.id === applicationId)?.dashboards.length).toBeGreaterThan(0);

    // All members: allowed
    await setPolicy({ mode: 'all_members', user_ids: [], team_ids: [] });
    expect(
      (await memberOrpc.dashboard.getApp({ params: { ...params, appKey: APP_KEY } })).id
    ).toBe(appDashboard.id);

    await orpc.config.applicationAccess.reset({ params: { ...params, applicationId: APP_KEY } });
  });

  test('keeps workspace home dashboards available to members', async ({
    server,
    orpc,
    memberId
  }) => {
    const memberOrpc = createTestORPCClient(
      server.baseUrl,
      await makeAuthHeader(server.db, memberId)
    );
    await orpc.config.applicationAccess.reset({ params: { ...params, applicationId: APP_KEY } });

    const home = await memberOrpc.dashboard.list({ params });
    expect(home.length).toBeGreaterThan(0);
    expect(
      (await memberOrpc.dashboard.get({ params: { ...params, id: home[0]!.id } })).id
    ).toBe(home[0]!.id);
  });
});
