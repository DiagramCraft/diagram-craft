import { seededProjects, seededUsers } from '@arch-register/server/db/seedFixtures';
import { createApiTest, createTestORPCClient, expect } from '../helpers/fixtures';
import { makeAuthHeader } from '../helpers/seedHelper';

const test = createApiTest({ seed: 'bootstrap' }).extend<{ adminAuth: string }>({
  adminAuth: [
    async ({ server }, use) => use(await makeAuthHeader(server.db, seededUsers.globalAdmin.id)),
    { scope: 'file' }
  ]
});

test.describe('architecture baselines', () => {
  test('captures, browses, compares, exports, and soft-deletes a workspace baseline', async ({
    server,
    adminAuth
  }) => {
    const orpc = createTestORPCClient(server.baseUrl, adminAuth);
    const created = await orpc.baselines.create({
      params: { workspace: 'default' },
      body: {
        name: 'Bootstrap catalog',
        description: 'Baseline API test',
        ownerTeamId: null,
        effectiveAt: new Date().toISOString(),
        scope: { kind: 'workspace' },
        includePlannedChanges: false,
        includeOverdueChanges: false
      }
    });
    expect(created.name).toBe('Bootstrap catalog');
    expect(created.entityCount).toBeGreaterThan(0);

    const detail = await orpc.baselines.get({
      params: { workspace: 'default', id: created.id }
    });
    expect(detail.entities.length).toBe(created.entityCount);

    const link = await orpc.baselines.links.create({
      params: { workspace: 'default', id: created.id },
      body: { targetType: 'project', targetId: seededProjects.checkoutRevamp.id }
    });
    expect(link.targetType).toBe('project');
    expect(link.targetId).toBe(seededProjects.checkoutRevamp.id);
    await expect(
      orpc.baselines.links.list({ params: { workspace: 'default', id: created.id } })
    ).resolves.toEqual([expect.objectContaining({ id: link.id })]);

    const linkedDetail = await orpc.baselines.get({
      params: { workspace: 'default', id: created.id }
    });
    expect(linkedDetail.links).toEqual([expect.objectContaining({ id: link.id })]);

    const comparison = await orpc.baselines.diff({
      params: { workspace: 'default' },
      body: { from: { kind: 'baseline', id: created.id }, to: { kind: 'current' } }
    });
    expect(comparison).toHaveProperty('relations');

    const exported = await orpc.baselines.export({
      params: { workspace: 'default', id: created.id }
    });
    expect(exported.entities.length).toBe(detail.entities.length);

    await orpc.baselines.links.remove({
      params: { workspace: 'default', id: created.id, linkId: link.id }
    });

    const replacement = await orpc.baselines.create({
      params: { workspace: 'default' },
      body: {
        name: 'Replacement catalog',
        description: null,
        ownerTeamId: null,
        effectiveAt: new Date().toISOString(),
        scope: { kind: 'workspace' },
        includePlannedChanges: false,
        includeOverdueChanges: false
      }
    });
    const superseded = await orpc.baselines.supersede({
      params: { workspace: 'default', id: created.id },
      body: { replacementId: replacement.id }
    });
    expect(superseded.status).toBe('superseded');

    await orpc.baselines.remove({ params: { workspace: 'default', id: created.id } });
    await expect(
      orpc.baselines.get({ params: { workspace: 'default', id: created.id } })
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});
