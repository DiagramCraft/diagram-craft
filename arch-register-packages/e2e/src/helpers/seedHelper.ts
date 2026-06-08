import type { DatabaseAdapter } from '@arch-register/server/db/database';
import {
  seedEntities,
  seedWorkspaces,
  seedLifecycleStates,
  seedOwners,
  seedSchemas,
  seedEnums,
  seedSavedViews
} from '@arch-register/server/db/seedData';
import { generateTokenPair } from '@arch-register/server/utils/jwt';
import { hashPassword } from '@arch-register/server/utils/password';

export const TEST_ADMIN = {
  id: 'test-admin',
  email: 'admin@e2e.test',
  password: 'TestPassword123!',
  display_name: 'E2E Admin'
};

export async function seedMinimal(db: DatabaseAdapter): Promise<void> {
  const now = new Date();

  for (const ws of seedWorkspaces) {
    await db.workspaceAdmin.createWorkspace(ws);
    const states = seedLifecycleStates.filter(s => s.workspace === ws.id);
    const owners = seedOwners.filter(o => o.workspace === ws.id);
    await db.workspaceAdmin.replaceLifecycleStates(ws.id, states);
    await db.workspaceAdmin.replaceTeams(ws.id, owners);
    for (const e of seedEnums.filter(en => en.workspace === ws.id)) {
      await db.catalog.createEnum(e);
    }
    for (const schema of seedSchemas.filter(s => s.workspace === ws.id)) {
      await db.catalog.createSchema(schema);
    }
  }

  const passwordHash = await hashPassword(TEST_ADMIN.password);
  await db.identityAuth.createUser({
    id: TEST_ADMIN.id,
    email: TEST_ADMIN.email,
    display_name: TEST_ADMIN.display_name,
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

  // Grant global admin role so the user has full access
  await db.identityAuth.replaceGlobalRoleAssignments(TEST_ADMIN.id, ['global_admin'], now);

  // Add as workspace admin member in each seeded workspace
  for (const ws of seedWorkspaces) {
    await db.workspaceAdmin.setWorkspaceMemberRole(ws.id, TEST_ADMIN.id, 'admin', now);
  }
}

export async function seedCatalogEntities(db: DatabaseAdapter): Promise<void> {
  for (const entity of seedEntities) {
    await db.catalog.createEntity(entity);
  }
}

export async function seedCatalogViews(db: DatabaseAdapter): Promise<void> {
  for (const view of seedSavedViews) {
    await db.view.createSavedView(view);
  }
}

// For API tests: generate a JWT directly without argon2 cost
export async function makeAuthHeader(
  db: DatabaseAdapter,
  userId: string = TEST_ADMIN.id
): Promise<string> {
  const user = await db.identityAuth.getUser(userId);
  if (!user) throw new Error(`Test user not found: ${userId}`);
  return `Bearer ${generateTokenPair(user).access_token}`;
}
