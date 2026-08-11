import { randomUUID } from 'node:crypto';
import { createTestORPCClient } from '../helpers/fixtures';
import { createPermissionApiTest, expect } from '../helpers/permissionFixtures';
import { makeAuthHeader, seedIds } from '../helpers/seedHelper';
import type { TestORPCClient } from '../helpers/orpcTestClient';
import { createFixtureUser } from '@arch-register/server/db/testSupport/fixtures';

const test = createPermissionApiTest().extend<{
  restrictedAnalytics: { schemaId: string; viewer: TestORPCClient };
}>({
  restrictedAnalytics: [
    async ({ server, resources }, use) => {
      const now = new Date('2026-08-05T12:00:00.000Z');
      const schemaId = randomUUID();
      const restrictedGroupId = randomUUID();
      const viewerId = randomUUID();
      const roleId = randomUUID();

      await createFixtureUser(server.db, {
        id: viewerId,
        user_id: 'analytics-field-restricted-viewer',
        email: 'analytics-field-restricted-viewer@e2e.test',
        display_name: 'Analytics Field Restricted Viewer',
        password_hash: null,
        is_active: true,
        created_at: now,
        updated_at: now
      });
      await server.db.workspace.createCustomWorkspaceRole({
        id: roleId,
        workspace: resources.workspaceId,
        name: 'Analytics field restricted viewer',
        description: '',
        tone: '',
        builtin: false,
        capabilities: ['ws.view', 'ws.audit', 'content.view'],
        created_at: now,
        updated_at: now
      });
      await server.db.workspace.setWorkspaceMemberRole(
        resources.workspaceId,
        viewerId,
        roleId,
        now
      );

      await server.db.catalog.createSchema({
        id: schemaId,
        workspace: resources.workspaceId,
        name: 'Analytics restricted schema',
        description: '',
        fields: [
          {
            id: 'public_field',
            name: 'Public field',
            type: 'text',
            requirementLevel: 'required'
          },
          {
            id: 'secret_field',
            name: 'Secret field',
            type: 'text',
            requirementLevel: 'required',
            groupId: restrictedGroupId
          }
        ],
        templates: [],
        groups: [
          {
            id: restrictedGroupId,
            name: 'Restricted',
            accessControl: { teamIds: [resources.teamIds.security] }
          }
        ],
        shared_field_group_links: [],
        color: null,
        icon: null,
        default_owner: null,
        key_prefix: `AN${randomUUID().replaceAll('-', '').slice(0, 3).toUpperCase()}`,
        created_at: now,
        updated_at: now
      });

      await server.db.catalog.createEntity({
        id: randomUUID(),
        workspace: resources.workspaceId,
        public_id: 'AN-1',
        slug: 'analytics-restricted-entity',
        namespace: 'default',
        name: 'Analytics restricted entity',
        description: '',
        owner: resources.teamIds.platform,
        lifecycle: seedIds.lifecycle.production,
        target_lifecycle: null,
        target_lifecycle_date: null,
        tags: [],
        links: [],
        schema_id: schemaId,
        data: { public_field: 'visible', secret_field: 'restricted' },
        project_id: null,
        created_at: now,
        updated_at: now,
        completeness: 100
      });

      await use({
        schemaId,
        viewer: createTestORPCClient(server.baseUrl, await makeAuthHeader(server.db, viewerId))
      });
    },
    { scope: 'file' }
  ]
});

test('workspace analytics scopes completeness to visible fields', async ({
  personas,
  restrictedAnalytics
}) => {
  const authorized = await personas.globalAdmin.orpc.analytics.get({
    params: { workspace: 'default' },
    query: { staleAfterDays: 90 }
  });
  const restricted = await restrictedAnalytics.viewer.analytics.get({
    params: { workspace: 'default' },
    query: { staleAfterDays: 90 }
  });

  const authorizedRow = authorized.completeness?.find(
    row => row.schemaId === restrictedAnalytics.schemaId
  );
  const restrictedRow = restricted.completeness?.find(
    row => row.schemaId === restrictedAnalytics.schemaId
  );

  expect(authorizedRow).toMatchObject({
    totalCount: 1,
    above80Count: 1,
    between50And79Count: 0,
    below50Count: 0
  });
  expect(restrictedRow).toMatchObject({
    totalCount: 1,
    above80Count: 0,
    between50And79Count: 1,
    below50Count: 0
  });
  expect(authorized.summary.percentCompleteness80Plus).not.toBe(
    restricted.summary.percentCompleteness80Plus
  );
  expect(restricted.summary.totalEntities).toBe(authorized.summary.totalEntities);
  expect(restricted.schemaUtilization).toEqual(authorized.schemaUtilization);
  expect(restricted.coverage).toEqual(authorized.coverage);
});
