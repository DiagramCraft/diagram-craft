import { test, expect } from '../helpers/fixtures';
import type { DatabaseAdapter } from '@arch-register/server/db/database';
import { hashPassword } from '@arch-register/server/utils/password';
import { generateTokenPair } from '@arch-register/server/utils/jwt';

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

  await db.identityAuth.createUser({
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
  test('GET /api/auth/config returns local auth mode', async ({ server }) => {
    const res = await fetch(`${server.baseUrl}/api/auth/config`);

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ mode: 'local' });
  });

  test('POST /api/auth/login accepts login by user id', async ({ server }) => {
    const res = await fetch(`${server.baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'test-admin',
        password: 'TestPassword123!'
      })
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toMatchObject({
      token_type: 'Bearer',
      access_token: expect.any(String),
      refresh_token: expect.any(String),
      expires_in: expect.any(Number)
    });
  });

  test('POST /api/auth/login accepts login by email', async ({ server }) => {
    const res = await fetch(`${server.baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'admin@e2e.test',
        password: 'TestPassword123!'
      })
    });

    expect(res.status).toBe(200);
  });

  test('POST /api/auth/login returns 401 for invalid password', async ({ server }) => {
    const res = await fetch(`${server.baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'test-admin',
        password: 'wrong-password'
      })
    });

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toMatchObject({
      message: 'Invalid username or password'
    });
  });

  test('POST /api/auth/login returns 403 for inactive users', async ({ server }) => {
    const { password } = await createLocalUser(server.db, {
      id: 'inactive-user',
      email: 'inactive@e2e.test',
      is_active: false
    });

    const res = await fetch(`${server.baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'inactive-user',
        password
      })
    });

    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toMatchObject({
      message: 'User account is inactive'
    });
  });

  test('GET /api/auth/oidc/authorize returns 400 in local mode', async ({ server }) => {
    const res = await fetch(`${server.baseUrl}/api/auth/oidc/authorize`);

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({
      message: 'OIDC authentication is not enabled'
    });
  });

  test('POST /api/auth/refresh accepts refresh token from the request body', async ({ server }) => {
    const user = await server.db.identityAuth.getUser('test-admin');
    expect(user).toBeTruthy();

    const tokens = generateTokenPair(user!);
    const res = await fetch(`${server.baseUrl}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        refresh_token: tokens.refresh_token
      })
    });

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      token_type: 'Bearer',
      access_token: expect.any(String),
      refresh_token: expect.any(String)
    });
  });

  test('POST /api/auth/refresh returns 401 for an access token', async ({ server }) => {
    const user = await server.db.identityAuth.getUser('test-admin');
    expect(user).toBeTruthy();

    const tokens = generateTokenPair(user!);
    const res = await fetch(`${server.baseUrl}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        refresh_token: tokens.access_token
      })
    });

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toMatchObject({
      message: 'Invalid token type'
    });
  });

  test('POST /api/auth/logout clears auth state', async ({ server }) => {
    const res = await fetch(`${server.baseUrl}/api/auth/logout`, {
      method: 'POST'
    });

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
  });
});

test.describe('auth protected routes', () => {
  test('GET /api/auth/me returns the authenticated user profile', async ({ server, auth }) => {
    const res = await fetch(`${server.baseUrl}/api/auth/me`, {
      headers: { Authorization: auth }
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toMatchObject({
      id: 'test-admin',
      email: 'admin@e2e.test',
      display_name: 'E2E Admin',
      auth_provider: 'local',
      global_roles: ['global_admin'],
      workspace_roles: { default: 'admin' }
    });
  });

  test('GET /api/auth/me returns 401 without authentication', async ({ server }) => {
    const res = await fetch(`${server.baseUrl}/api/auth/me`);
    expect(res.status).toBe(401);
  });

  test('PATCH /api/users/:id updates the current user settings', async ({ server, auth }) => {
    const res = await fetch(`${server.baseUrl}/api/users/test-admin`, {
      method: 'PATCH',
      headers: {
        Authorization: auth,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        display_name: 'Admin Renamed',
        color: '#336699'
      })
    });

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      id: 'test-admin',
      display_name: 'Admin Renamed',
      color: '#336699'
    });
  });

  test('PATCH /api/users/:id rejects updates to a different user', async ({ server, auth }) => {
    const res = await fetch(`${server.baseUrl}/api/users/someone-else`, {
      method: 'PATCH',
      headers: {
        Authorization: auth,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        display_name: 'Nope'
      })
    });

    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toMatchObject({
      message: 'You can only update your own account settings'
    });
  });

  test('GET /api/auth/users lists users for a global admin', async ({ server, auth }) => {
    const res = await fetch(`${server.baseUrl}/api/auth/users`, {
      headers: { Authorization: auth }
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as Array<Record<string, unknown>>;
    expect(body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'test-admin',
          email: 'admin@e2e.test',
          auth_provider: 'local',
          is_active: true
        })
      ])
    );
  });

  test('GET and PUT /api/auth/users/:id/global-roles manage global role assignments', async ({ server, auth }) => {
    await createLocalUser(server.db, {
      id: 'roles-user',
      email: 'roles@e2e.test'
    });

    const putRes = await fetch(`${server.baseUrl}/api/auth/users/roles-user/global-roles`, {
      method: 'PUT',
      headers: {
        Authorization: auth,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        roles: ['workspace_admin']
      })
    });

    expect(putRes.status).toBe(200);
    await expect(putRes.json()).resolves.toEqual([
      expect.objectContaining({
        user_id: 'roles-user',
        role: 'workspace_admin'
      })
    ]);

    const getRes = await fetch(`${server.baseUrl}/api/auth/users/roles-user/global-roles`, {
      headers: { Authorization: auth }
    });

    expect(getRes.status).toBe(200);
    await expect(getRes.json()).resolves.toEqual([
      expect.objectContaining({
        user_id: 'roles-user',
        role: 'workspace_admin'
      })
    ]);
  });

  test('PUT /api/auth/users/:id/global-roles rejects invalid role values', async ({ server, auth }) => {
    await createLocalUser(server.db, {
      id: 'roles-invalid-user',
      email: 'roles-invalid@e2e.test'
    });

    const res = await fetch(`${server.baseUrl}/api/auth/users/roles-invalid-user/global-roles`, {
      method: 'PUT',
      headers: {
        Authorization: auth,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        roles: ['not-a-real-role']
      })
    });

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({
      message: 'roles contains invalid values'
    });
  });
});
