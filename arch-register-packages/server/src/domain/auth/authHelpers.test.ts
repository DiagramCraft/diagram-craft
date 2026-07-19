import { describe, expect, it } from 'vitest';
import {
  buildAuthMeResponse,
  buildUserUpdateInput,
  parseRequestedGlobalRoles,
  selectRefreshToken,
  verifyLoginPassword
} from './authHelpers';
import { UserDbResult } from './db/authDatabase';

const now = new Date('2026-06-01T12:00:00.000Z');

const user: UserDbResult = {
  id: 'user-1',
  user_id: 'user-1',
  email: 'user@example.com',
  display_name: 'Test User',
  auth_provider: 'local',
  password_hash: 'hash',
  oidc_issuer: null,
  oidc_subject: null,
  is_active: true,
  color: '#123456',
  created_at: now,
  updated_at: now,
  last_login_at: now
};

describe('auth route helpers', () => {
  it('prefers refresh token from cookie over request body', () => {
    expect(selectRefreshToken('cookie-token', { refresh_token: 'body-token' })).toBe(
      'cookie-token'
    );
  });

  it('falls back to refresh token from request body', () => {
    expect(selectRefreshToken(null, { refresh_token: 'body-token' })).toBe('body-token');
  });

  it('performs a dummy password verification when the user is missing', async () => {
    await expect(verifyLoginPassword(null, 'wrong-password')).resolves.toBe(false);
  });

  it('builds the auth me response maps and filters empty memberships', () => {
    const result = buildAuthMeResponse(
      user,
      ['global_admin'],
      [
        {
          workspace_id: 'default',
          team_assignments: [{ team_id: 'Platform Engineering', role: 'team_admin' }],
          teams: [{ id: 'Platform Engineering', name: 'Platform Engineering', type: 'team' }],
          workspace_role: 'admin',
          workspace_roles: []
        },
        {
          workspace_id: 'empty',
          team_assignments: [],
          teams: [],
          workspace_role: null,
          workspace_roles: []
        }
      ]
    );

    expect(result).toMatchObject({
      id: 'user-1',
      user_id: 'user-1',
      global_roles: ['global_admin'],
      workspace_roles: { default: 'admin' },
      team_assignments_by_workspace: {
        default: [{ team_id: 'Platform Engineering', role: 'team_admin' }]
      },
      teams_by_workspace: {
        default: [{ id: 'Platform Engineering', name: 'Platform Engineering', type: 'team' }],
        empty: []
      }
    });
    expect(result.global_permissions).toContain('admin_platform');
    expect(result.team_assignments_by_workspace).not.toHaveProperty('empty');
  });

  it('builds user update input with validated fields', () => {
    expect(buildUserUpdateInput({ display_name: 'Updated User', color: '#abcdef' }, now)).toEqual({
      display_name: 'Updated User',
      color: '#abcdef',
      updated_at: now
    });
  });

  it('defaults user color to null when omitted', () => {
    expect(buildUserUpdateInput({}, now)).toEqual({
      display_name: undefined,
      color: null,
      updated_at: now
    });
  });

  it('parses valid requested global roles', () => {
    expect(parseRequestedGlobalRoles(['global_admin', 'workspace_admin'])).toEqual([
      'global_admin',
      'workspace_admin'
    ]);
  });

  it('rejects invalid requested global roles', () => {
    expect(() => parseRequestedGlobalRoles(['global_admin', 'nope'])).toThrow(
      'roles contains invalid values'
    );
  });
});
