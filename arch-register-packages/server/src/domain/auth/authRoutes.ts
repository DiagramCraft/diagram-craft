import { defineHandler, getQuery, H3, redirect } from 'h3';
import { randomUUID } from 'node:crypto';
import type { DatabaseAdapter } from '../../db/database';
import { generateTokenPair } from '../../utils/jwt';
import { handleCallback } from './oidcClient';
import { setAuthCookies } from '../../utils/cookies';
import {
  getGlobalPermissionsForRoles,
  resolveWorkspaceRoleDefinitions
} from '@arch-register/permissions';
import type { TeamRole } from '@arch-register/permissions';
import { httpAssert } from '../../utils/httpAssert';
import { GlobalRole, UserDbResult } from './db/authDatabase';

// Clean up expired OIDC states every 5 minutes
const cleanupTimer = setInterval(
  async () => {
    if (cleanupDbAdapter) {
      await cleanupDbAdapter.auth.cleanupExpiredOidcAuthStates();
    }
  },
  5 * 60 * 1000
);
cleanupTimer.unref();

let cleanupDbAdapter: DatabaseAdapter | null = null;

type RefreshBody = {
  refresh_token?: string;
};

type UserUpdateBody = {
  color?: unknown;
  display_name?: unknown;
};

type WorkspaceMembershipData = {
  workspace_id: string;
  team_assignments: Array<{ team_id: string; role: TeamRole }>;
  teams: Array<{ id: string; name: string; type: 'team' }>;
  workspace_role: string | null;
  workspace_roles: ReturnType<typeof resolveWorkspaceRoleDefinitions>;
};

export const selectRefreshToken = (cookieToken: string | null | undefined, body?: RefreshBody) =>
  cookieToken ?? body?.refresh_token;

export const buildAuthMeResponse = (
  user: UserDbResult,
  globalRoles: GlobalRole[],
  workspaceData: WorkspaceMembershipData[]
) => {
  const teamAssignmentsByWorkspace = Object.fromEntries(
    workspaceData
      .filter(ws => ws.team_assignments.length > 0)
      .map(ws => [ws.workspace_id, ws.team_assignments])
  );
  const workspaceRoles = Object.fromEntries(
    workspaceData
      .filter((ws): ws is typeof ws & { workspace_role: string } => ws.workspace_role != null)
      .map(ws => [ws.workspace_id, ws.workspace_role])
  );
  const teamsByWorkspace = Object.fromEntries(workspaceData.map(ws => [ws.workspace_id, ws.teams]));
  const workspaceRoleDefinitionsByWorkspace = Object.fromEntries(
    workspaceData.map(ws => [ws.workspace_id, ws.workspace_roles])
  );

  return {
    id: user.id,
    user_id: user.user_id,
    email: user.email,
    display_name: user.display_name,
    auth_provider: user.auth_provider,
    color: user.color,
    created_at: user.created_at.toISOString(),
    last_login_at: user.last_login_at?.toISOString() ?? null,
    global_roles: globalRoles,
    global_permissions: [...getGlobalPermissionsForRoles(globalRoles)],
    team_assignments_by_workspace: teamAssignmentsByWorkspace,
    workspace_roles: workspaceRoles,
    workspace_role_definitions_by_workspace: workspaceRoleDefinitionsByWorkspace,
    teams_by_workspace: teamsByWorkspace
  };
};

export const buildUserUpdateInput = (body: UserUpdateBody, updatedAt: Date) => {
  if (body.color !== undefined && body.color !== null) {
    httpAssert.string(body.color, { message: 'color must be a string if provided' });
  }
  if (body.display_name !== undefined) {
    httpAssert.string(body.display_name, { message: 'display_name must be a string if provided' });
  }

  return {
    display_name: body.display_name as string | undefined,
    color: (body.color as string | null | undefined) ?? null,
    updated_at: updatedAt
  };
};

export const parseRequestedGlobalRoles = (requestedRoles: unknown[]) => {
  const roles = requestedRoles.filter(
    (role): role is GlobalRole =>
      typeof role === 'string' && ['global_admin', 'workspace_admin'].includes(role)
  );
  httpAssert.true(roles.length === requestedRoles.length, {
    message: 'roles contains invalid values'
  });
  return roles;
};

// GET /api/auth/oidc/callback — permanent REST route (returns 302 redirect, not JSON)
export const createOidcCallbackRoute = (db: DatabaseAdapter) => {
  cleanupDbAdapter = db;

  const app = new H3();

  app.use(
    '/api/auth/oidc/callback',
    defineHandler(async event => {
      httpAssert.true(event.req.method === 'GET', { status: 405, message: 'Method not allowed' });

      const authMode = process.env['AUTH_MODE'] ?? 'local';
      httpAssert.true(authMode === 'oidc', { message: 'OIDC authentication is not enabled' });

      const query = getQuery(event);
      const state = String(query.state ?? '');

      httpAssert.string(state, { message: 'Missing state parameter' });

      const storedState = await db.auth.getOidcAuthState(state);

      httpAssert.present(storedState, { message: 'Invalid or expired state' });

      await db.auth.deleteOidcAuthState(state);

      const redirectUri = process.env['OIDC_REDIRECT_URI'];
      if (!redirectUri) {
        throw new Error('OIDC_REDIRECT_URI not configured');
      }

      const callbackUrl = new URL(redirectUri);
      for (const [key, value] of Object.entries(query)) {
        callbackUrl.searchParams.set(key, String(value));
      }

      const claims = await handleCallback(
        callbackUrl.href,
        state,
        storedState.nonce,
        storedState.code_verifier
      );

      let user = await db.auth.getUserByOidc(claims.issuer, claims.sub);

      if (!user) {
        const userId = randomUUID();
        user = await db.auth.createUser({
          id: userId,
          user_id: `${claims.issuer}:${claims.sub}`,
          email: claims.email ?? null,
          display_name: claims.name,
          auth_provider: 'oidc',
          password_hash: null,
          oidc_issuer: claims.issuer,
          oidc_subject: claims.sub,
          is_active: true,
          color: null,
          created_at: new Date(),
          updated_at: new Date(),
          last_login_at: new Date()
        });
      } else {
        await db.auth.updateUserLastLogin(user.id, new Date());
      }

      httpAssert.true(user.is_active, {
        status: 403,
        message: 'User account is inactive'
      });

      const tokens = generateTokenPair(user);
      setAuthCookies(event, tokens.access_token, tokens.refresh_token, tokens.expires_in);

      const frontendUrl = process.env['OIDC_FRONTEND_REDIRECT_URI'] ?? '/';
      return redirect(frontendUrl, 302);
    })
  );

  return app;
};
