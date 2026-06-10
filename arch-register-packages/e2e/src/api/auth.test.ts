import { test, expect, createTestORPCClient } from '../helpers/fixtures';
import type { DatabaseAdapter } from '@arch-register/server/db/database';
import { hashPassword } from '@arch-register/server/utils/password';
import { generateTokenPair } from '@arch-register/server/utils/jwt';
import { seedIds } from '../helpers/seedHelper';

const createLocalUser = async (
  db: DatabaseAdapter,
  overrides: {
    id: string;
    email: string;
    display_name?: string;
    password?: string;
    is_active?: boolean;
  }
) => {
  const now = new Date();
  const password = overrides.password ?? 'TestPassword123!';
  const passwordHash = await hashPassword(password);

  await db.auth.createUser({
    id: overrides.id,
    email: overrides.email,
    display_name: overrides.display_name ?? overrides.id,
    auth_provider: 'local',
    password_hash: passwordHash,
    oidc_issuer: null,
    oidc_subject: null,
    is_active: overrides.is_active ?? true,
    color: null,
    created_at: now,
    updated_at: now,
    last_login_at: null
  });

  return { password };
};

test.describe('auth public routes', () => {
  test('GET /api/auth/config returns local auth mode', async ({ orpc }) => {
    const result = await orpc.auth.config(undefined);
    expect(result).toEqual({ mode: 'local' });
  });

  test('POST /api/auth/login accepts login by user id', async ({ orpc }) => {
    const result = await orpc.auth.login({ body: { username: 'test-admin', password: 'TestPassword123!' } });
    expect(result).toMatchObject({
      token_type: 'Bearer',
      access_token: expect.any(String),
      refresh_token: expect.any(String),
      expires_in: expect.any(Number)
    });
  });

  test('POST /api/auth/login accepts login by email', async ({ orpc }) => {
    const result = await orpc.auth.login({ body: { username: 'admin@e2e.test', password: 'TestPassword123!' } });
    expect(result).toMatchObject({ token_type: 'Bearer' });
  });

  test('POST /api/auth/login returns 401 for invalid password', async ({ orpc }) => {
    await expect(
      orpc.auth.login({ body: { username: 'test-admin', password: 'wrong-password' } })
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED', message: 'Invalid username or password' });
  });

  test('POST /api/auth/login returns 403 for inactive users', async ({ server, orpc }) => {
    const { password } = await createLocalUser(server.db, {
      id: 'inactive-user',
      email: 'inactive@e2e.test',
      is_active: false
    });

    await expect(
      orpc.auth.login({ body: { username: 'inactive-user', password } })
    ).rejects.toMatchObject({ code: 'FORBIDDEN', message: 'User account is inactive' });
  });

  test('GET /api/auth/oidc/authorize returns 400 in local mode', async ({ orpc }) => {
    await expect(orpc.auth.oidcAuthorize(undefined)).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: 'OIDC authentication is not enabled'
    });
  });

  test('POST /api/auth/refresh accepts refresh token from the request body', async ({ server, orpc }) => {
    const user = await server.db.auth.getUser('test-admin');
    expect(user).toBeTruthy();

    const tokens = generateTokenPair(user!);
    const result = await orpc.auth.refresh({ body: { refresh_token: tokens.refresh_token } });
    expect(result).toMatchObject({
      token_type: 'Bearer',
      access_token: expect.any(String),
      refresh_token: expect.any(String)
    });
  });

  test('POST /api/auth/refresh returns 401 for an access token', async ({ server, orpc }) => {
    const user = await server.db.auth.getUser('test-admin');
    expect(user).toBeTruthy();

    const tokens = generateTokenPair(user!);
    await expect(
      orpc.auth.refresh({ body: { refresh_token: tokens.access_token } })
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED', message: 'Invalid token type' });
  });

  test('POST /api/auth/logout clears auth state', async ({ orpc }) => {
    const result = await orpc.auth.logout(undefined);
    expect(result).toEqual({ ok: true });
  });
});

test.describe('auth protected routes', () => {
  test('GET /api/auth/me returns the authenticated user profile', async ({ orpc }) => {
    const result = await orpc.authProtected.me(undefined);
    expect(result).toMatchObject({
      id: 'test-admin',
      email: 'admin@e2e.test',
      display_name: 'E2E Admin',
      auth_provider: 'local',
      global_roles: ['global_admin'],
      workspace_roles: { [seedIds.workspace.default]: 'admin' }
    });
  });

  test('GET /api/auth/me returns 401 without authentication', async ({ server }) => {
    const anonOrpc = createTestORPCClient(server.baseUrl);
    await expect(anonOrpc.authProtected.me(undefined)).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  test('PATCH /api/users/:id updates the current user settings', async ({ orpc }) => {
    const result = await orpc.authProtected.updateUser({
      params: { id: 'test-admin' },
      body: { display_name: 'Admin Renamed', color: '#336699' }
    });
    expect(result).toMatchObject({ id: 'test-admin', display_name: 'Admin Renamed', color: '#336699' });
  });

  test('PATCH /api/users/:id rejects updates to a different user', async ({ orpc }) => {
    await expect(
      orpc.authProtected.updateUser({ params: { id: 'someone-else' }, body: { display_name: 'Nope' } })
    ).rejects.toMatchObject({ code: 'FORBIDDEN', message: 'You can only update your own account settings' });
  });

  test('GET /api/auth/users lists users for a global admin', async ({ orpc }) => {
    const users = await orpc.authProtected.listUsers(undefined);
    expect(users).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'test-admin', email: 'admin@e2e.test', auth_provider: 'local', is_active: true })
      ])
    );
  });

  test('GET and PUT /api/auth/users/:id/global-roles manage global role assignments', async ({ server, orpc }) => {
    await createLocalUser(server.db, { id: 'roles-user', email: 'roles@e2e.test' });

    const putResult = await orpc.authProtected.replaceGlobalRoles({
      params: { id: 'roles-user' },
      body: { roles: ['workspace_admin'] }
    });
    expect(putResult).toEqual([expect.objectContaining({ user_id: 'roles-user', role: 'workspace_admin' })]);

    const getResult = await orpc.authProtected.getGlobalRoles({ params: { id: 'roles-user' } });
    expect(getResult).toEqual([expect.objectContaining({ user_id: 'roles-user', role: 'workspace_admin' })]);
  });

  test('PUT /api/auth/users/:id/global-roles rejects invalid role values', async ({ server, orpc }) => {
    await createLocalUser(server.db, { id: 'roles-invalid-user', email: 'roles-invalid@e2e.test' });

    await expect(
      orpc.authProtected.replaceGlobalRoles({
        params: { id: 'roles-invalid-user' },
        body: { roles: ['not-a-real-role'] }
      })
    ).rejects.toMatchObject({ code: 'BAD_REQUEST', message: 'roles contains invalid values' });
  });
});
