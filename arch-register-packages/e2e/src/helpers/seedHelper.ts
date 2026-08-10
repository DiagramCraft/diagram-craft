import type { DatabaseAdapter } from '@arch-register/server/db/database';
import { seedEntities, seedIds, seedWorkspaces } from '@arch-register/server/db/seedData';
import {
  seedAiConfiguration,
  seedCatalogDefinitions,
  seedCatalogEntities as seedSharedCatalogEntities,
  seedCatalogViews as seedSharedCatalogViews,
  seedPublicIdCounters,
  seedUsersAndRoles,
  seedWorkspaceBase,
  seedWorkspaceConfiguration
} from '@arch-register/server/db/seedPhases';
import { generateTokenPair } from '@arch-register/server/utils/jwt';

export const TEST_ADMIN = {
  id: '00000000-0000-0000-0000-e2e000000001',
  email: 'admin@e2e.test',
  password: 'TestPassword123!',
  display_name: 'E2E Admin'
};

export { seedIds };

export async function seedMinimal(db: DatabaseAdapter): Promise<void> {
  const now = new Date();

  await seedWorkspaceBase(db);
  await seedWorkspaceConfiguration(db, {
    supportedCurrencies: false,
    projectEntityTypes: false,
    assessmentTypes: false
  });
  await seedCatalogDefinitions(db, { sharedFieldGroups: false });
  await seedAiConfiguration(db);
  await seedUsersAndRoles(db, {
    users: [
      {
        id: TEST_ADMIN.id,
        user_id: 'test-admin',
        email: TEST_ADMIN.email,
        display_name: TEST_ADMIN.display_name,
        color: null
      }
    ],
    password: TEST_ADMIN.password,
    globalRoleAssignments: [{ user_id: TEST_ADMIN.id, role: 'global_admin', created_at: now }],
    workspaceMembers: seedWorkspaces.map(workspace => ({
      workspace: workspace.id,
      user_id: TEST_ADMIN.id,
      role: 'admin',
      created_at: now
    })),
    createdAt: now
  });
}

export async function seedCatalogEntities(db: DatabaseAdapter): Promise<void> {
  const syncTimestamp = new Date();
  const entities = seedEntities.filter(entity => entity.project_id == null);
  await seedSharedCatalogEntities(db, entities);
  await seedPublicIdCounters(db, entities, syncTimestamp);
}

export async function seedCatalogViews(db: DatabaseAdapter): Promise<void> {
  await seedSharedCatalogViews(db);
}

// For API tests: generate a JWT directly without argon2 cost
export async function makeAuthHeader(
  db: DatabaseAdapter,
  userId: string = TEST_ADMIN.id
): Promise<string> {
  const user = await db.auth.getUser(userId);
  if (!user) throw new Error(`Test user not found: ${userId}`);
  return `Bearer ${generateTokenPair(user).access_token}`;
}
