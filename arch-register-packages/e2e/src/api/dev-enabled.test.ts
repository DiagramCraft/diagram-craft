process.env['DEV_USER_SWITCHER_ENABLED'] = 'true';

import { test, expect } from '../helpers/fixtures';
import { hashPassword } from '@arch-register/server/utils/password';
import { TEST_ADMIN } from '../helpers/seedHelper';
import { INACTIVE_USER_ID } from '../helpers/testIds';

test.describe('dev user switcher (enabled)', () => {
  test('GET /api/dev/config reports enabled', async ({ orpc }) => {
    const result = await orpc.dev.config(undefined);
    expect(result).toEqual({ enabled: true });
  });

  test('GET /api/dev/users lists seeded users', async ({ orpc }) => {
    const users = await orpc.dev.listUsers(undefined);
    expect(users).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: TEST_ADMIN.id, is_active: true })])
    );
  });

  test('POST /api/dev/switch-user issues cookies that authenticate as the target user', async ({
    server
  }) => {
    const switchResponse = await fetch(`${server.baseUrl}/api/dev/switch-user`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: TEST_ADMIN.id })
    });
    expect(switchResponse.ok).toBe(true);
    expect(await switchResponse.json()).toEqual({ ok: true });

    const cookies = switchResponse.headers
      .getSetCookie()
      .map(cookie => cookie.split(';')[0])
      .join('; ');
    expect(cookies).toContain('ar_access_token=');

    const meResponse = await fetch(`${server.baseUrl}/api/auth/me`, {
      headers: { Cookie: cookies }
    });
    expect(meResponse.ok).toBe(true);
    const me = await meResponse.json();
    expect(me).toMatchObject({ id: TEST_ADMIN.id, email: TEST_ADMIN.email });
  });

  test('POST /api/dev/switch-user rejects inactive users', async ({ server }) => {
    const now = new Date();
    await server.db.auth.createUser({
      id: INACTIVE_USER_ID,
      user_id: 'inactive-dev-switch',
      email: 'inactive-dev-switch@e2e.test',
      display_name: 'Inactive',
      auth_provider: 'local',
      password_hash: await hashPassword('TestPassword123!'),
      oidc_issuer: null,
      oidc_subject: null,
      is_active: false,
      color: null,
      created_at: now,
      updated_at: now,
      last_login_at: null
    });

    const response = await fetch(`${server.baseUrl}/api/dev/switch-user`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: INACTIVE_USER_ID })
    });
    expect(response.status).toBe(403);
  });
});
