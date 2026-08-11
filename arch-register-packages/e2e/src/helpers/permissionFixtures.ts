import { seededProjects, seededUsers, seededEntities } from '@arch-register/server/db/seedFixtures';
import {
  buildFixtureEntityGrant,
  createFixtureUser
} from '@arch-register/server/db/testSupport/fixtures';
import { createApiTest, createTestORPCClient, expect } from './fixtures';
import { makeAuthHeader, seedIds } from './seedHelper';
import type { TestORPCClient } from './orpcTestClient';

const password = 'PermissionPassword123!';
const now = new Date('2026-02-01T00:00:00.000Z');

const OUTSIDER_USER_ID = '00000000-0000-0000-0000-e2e000000002';
const EXPLICIT_GRANT_USER_ID = '00000000-0000-0000-0000-e2e000000003';

type PersonaName =
  | 'globalAdmin'
  | 'workspaceAdmin'
  | 'workspaceOwner'
  | 'platformTeamAdmin'
  | 'platformTeamEditor'
  | 'designTeamAdmin'
  | 'securityTeamAdmin'
  | 'workspaceEditor'
  | 'workspaceReviewer'
  | 'workspaceViewer'
  | 'outsider'
  | 'userWithExplicitEntityGrant';

type PersonaFixture = {
  auth: string;
  orpc: TestORPCClient;
  userId: string;
};

type PersonasFixture = Record<PersonaName, PersonaFixture>;

type PermissionResources = {
  workspaceId: string;
  teamIds: typeof seedIds.teams;
  entityIds: {
    customerPortal: string;
    identityPlatform: string;
    customerApi: string;
    authApi: string;
    apiGateway: string;
    frontendApp: string;
    authService: string;
  };
  projectIds: {
    portalRedesign: string;
    authMigration: string;
    checkoutRevamp: string;
  };
};

const seededPersonaUserIds = {
  globalAdmin: seededUsers.globalAdmin.id,
  workspaceAdmin: seededUsers.workspaceAdmin.id,
  workspaceOwner: seededUsers.workspaceOwner.id,
  platformTeamAdmin: seededUsers.platformTeamAdmin.id,
  platformTeamEditor: seededUsers.platformTeamEditor.id,
  designTeamAdmin: seededUsers.designTeamAdmin.id,
  securityTeamAdmin: seededUsers.securityTeamAdmin.id,
  workspaceEditor: seededUsers.workspaceEditor.id,
  workspaceReviewer: seededUsers.workspaceReviewer.id,
  workspaceViewer: seededUsers.workspaceViewer.id
} as const satisfies Record<
  Exclude<PersonaName, 'outsider' | 'userWithExplicitEntityGrant'>,
  string
>;

const makePersona = async (
  baseUrl: string,
  auth: string,
  userId: string
): Promise<PersonaFixture> => ({
  auth,
  orpc: createTestORPCClient(baseUrl, auth),
  userId
});

export const createPermissionApiTest = () =>
  createApiTest({
    seed: 'bootstrap',
    afterSeed: async server => {
      await createFixtureUser(server.db, {
        id: OUTSIDER_USER_ID,
        user_id: OUTSIDER_USER_ID,
        email: 'outsider@e2e.test',
        display_name: 'Permission Outsider',
        password,
        is_active: true,
        created_at: now,
        updated_at: now
      });

      await createFixtureUser(server.db, {
        id: EXPLICIT_GRANT_USER_ID,
        user_id: EXPLICIT_GRANT_USER_ID,
        email: 'explicit-grant@e2e.test',
        display_name: 'Explicit Grant User',
        password,
        is_active: true,
        created_at: now,
        updated_at: now
      });

      await server.db.catalog.replaceEntityGrants(
        seedIds.workspace.default,
        seededEntities.default.customerPortal.id,
        [
          buildFixtureEntityGrant(
            seedIds.workspace.default,
            seededEntities.default.customerPortal.id,
            'user',
            EXPLICIT_GRANT_USER_ID,
            { applies_to: 'subtree', created_at: now }
          )
        ]
      );
    }
  }).extend<{
    personas: PersonasFixture;
    resources: PermissionResources;
  }>({
    personas: [
      async ({ server }, use) => {
        const entries = await Promise.all(
          Object.entries(seededPersonaUserIds).map(async ([name, userId]) => {
            const auth = await makeAuthHeader(server.db, userId);
            return [name, await makePersona(server.baseUrl, auth, userId)] as const;
          })
        );

        const outsiderAuth = await makeAuthHeader(server.db, OUTSIDER_USER_ID);
        const explicitGrantAuth = await makeAuthHeader(server.db, EXPLICIT_GRANT_USER_ID);

        await use({
          ...Object.fromEntries(entries),
          outsider: await makePersona(server.baseUrl, outsiderAuth, OUTSIDER_USER_ID),
          userWithExplicitEntityGrant: await makePersona(
            server.baseUrl,
            explicitGrantAuth,
            EXPLICIT_GRANT_USER_ID
          )
        } as PersonasFixture);
      },
      { scope: 'file' }
    ],
    resources: [
      async ({ server }, use) => {
        void server;
        await use({
          workspaceId: seedIds.workspace.default,
          teamIds: seedIds.teams,
          entityIds: {
            customerPortal: seededEntities.default.customerPortal.id,
            identityPlatform: '00000000-0000-0000-0002-000000000002',
            customerApi: seededEntities.default.customerApi.id,
            authApi: seededEntities.default.authApi.id,
            apiGateway: '00000000-0000-0000-0003-000000000001',
            frontendApp: seededEntities.default.frontendApp.id,
            authService: seededEntities.default.authService.id
          },
          projectIds: {
            portalRedesign: seededProjects.portalRedesign.id,
            authMigration: seededProjects.authMigration.id,
            checkoutRevamp: seededProjects.checkoutRevamp.id
          }
        });
      },
      { scope: 'file' }
    ]
  });

export const csvRows = (csv: string) =>
  csv
    .trim()
    .split('\n')
    .map(row => row.trim());

export { expect };
