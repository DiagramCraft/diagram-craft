import type { DatabaseAdapter } from '@arch-register/server/db/database';
import {
  seedEntities,
  seedIds,
  seedWorkspaces,
  seedLifecycleStates,
  seedOwners,
  seedSchemas,
  seedEnums,
  seedSavedViews,
  seedAiConfig
} from '@arch-register/server/db/seedData';
import { generateTokenPair } from '@arch-register/server/utils/jwt';
import { hashPassword } from '@arch-register/server/utils/password';

export const TEST_ADMIN = {
  id: '00000000-0000-0000-0000-e2e000000001',
  email: 'admin@e2e.test',
  password: 'TestPassword123!',
  display_name: 'E2E Admin'
};

export { seedIds };

export async function seedMinimal(db: DatabaseAdapter): Promise<void> {
  const now = new Date();

  for (const ws of seedWorkspaces) {
    await db.workspace.createWorkspace(ws);
    await db.workspace.registerPublicIdPrefix(ws.short_code, 'workspace', ws.id, ws.created_at);
    const states = seedLifecycleStates.filter(s => s.workspace === ws.id);
    const owners = seedOwners.filter(o => o.workspace === ws.id);
    await db.workspace.replaceLifecycleStates(ws.id, states);
    await db.workspace.replaceTeams(ws.id, owners);
    for (const e of seedEnums.filter(en => en.workspace === ws.id)) {
      await db.catalog.createEnum(e);
    }
    for (const schema of seedSchemas.filter(s => s.workspace === ws.id)) {
      const createdSchema = await db.catalog.createSchema(schema);
      const keyPrefix = createdSchema.key_prefix ?? schema.key_prefix;
      if (!keyPrefix) {
        throw new Error(`Schema '${createdSchema.id}' is missing a key prefix`);
      }
      await db.workspace.registerPublicIdPrefix(
        keyPrefix,
        'schema',
        createdSchema.id,
        createdSchema.created_at
      );
    }
    await db.ai.upsertAiConfig(ws.id, seedAiConfig);
  }

  const passwordHash = await hashPassword(TEST_ADMIN.password);
  await db.auth.createUser({
    id: TEST_ADMIN.id,
    user_id: 'test-admin',
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
  await db.auth.replaceGlobalRoleAssignments(TEST_ADMIN.id, ['global_admin'], now);

  // Add as workspace admin member in each seeded workspace
  for (const ws of seedWorkspaces) {
    await db.workspace.setWorkspaceMemberRole(ws.id, TEST_ADMIN.id, 'admin', now);
  }
}

export async function seedCatalogEntities(db: DatabaseAdapter): Promise<void> {
  const syncTimestamp = new Date();

  for (const entity of seedEntities) {
    await db.catalog.createEntity(entity);
  }

  const maxByPrefix = new Map<string, number>();
  for (const entity of seedEntities) {
    if (!entity.public_id) continue;
    const parts = entity.public_id.split('-');
    const prefix = parts.slice(0, -1).join('-');
    const seq = parseInt(parts.at(-1) ?? '0', 10);
    if (prefix && !Number.isNaN(seq)) {
      maxByPrefix.set(prefix, Math.max(maxByPrefix.get(prefix) ?? 0, seq));
    }
  }
  for (const [prefix, max] of maxByPrefix) {
    await db.workspace.setPublicIdNextNumber(prefix, max + 1, syncTimestamp);
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
  const user = await db.auth.getUser(userId);
  if (!user) throw new Error(`Test user not found: ${userId}`);
  return `Bearer ${generateTokenPair(user).access_token}`;
}
