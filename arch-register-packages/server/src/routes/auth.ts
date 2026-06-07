import type { H3Event } from 'h3';
import { defineHandler, getCookie, getQuery, H3, HTTPError, readBody, redirect } from 'h3';
import type { DatabaseAdapter } from '../db/database.js';
import { verifyPassword } from '../utils/password.js';
import { generateTokenPair, verifyToken } from '../utils/jwt.js';
import { generateAuthUrl, handleCallback } from '../auth/oidcClient.js';
import { clearAuthCookies, setAuthCookies } from '../utils/cookies.js';
import type { GlobalRole, JWTPayload, User } from '../types.js';
import { buildApiAuthCtx, GLOBAL_WS, requireGlobalPermission } from '../auth/authorization.js';
import { getGlobalPermissionsForRoles, resolveWorkspaceRoleDefinitions } from '@arch-register/permissions';
import { AuthenticatedEvent } from '../middleware/auth';
import { httpAssert } from '../utils/httpAssert.js';

// Clean up expired OIDC states every 5 minutes
const cleanupTimer = setInterval(
  async () => {
    // This will be set when createAuthRoutes is called
    if (cleanupDbAdapter) {
      await cleanupDbAdapter.identityAuth.cleanupExpiredOidcAuthStates();
    }
  },
  5 * 60 * 1000
);
cleanupTimer.unref();

let cleanupDbAdapter: DatabaseAdapter | null = null;

const setTokenCookies = (event: H3Event, tokens: ReturnType<typeof generateTokenPair>) => {
  setAuthCookies(event, tokens.access_token, tokens.refresh_token, tokens.expires_in);
};

type LoginBody = {
  username?: string;
  password?: string;
};

type RefreshBody = {
  refresh_token?: string;
};

type UserUpdateBody = {
  color?: unknown;
  display_name?: unknown;
};

type WorkspaceMembershipData = {
  workspace_id: string;
  team_assignments: Array<{ team_id: string; role: string }>;
  teams: Array<{ id: string; name: string; type: 'team' }>;
  workspace_role: string | null;
  workspace_roles: ReturnType<typeof resolveWorkspaceRoleDefinitions>;
};

const getAuthMode = () => process.env['AUTH_MODE'] ?? 'local';

export const selectRefreshToken = (
  cookieToken: string | null | undefined,
  body?: RefreshBody
) => cookieToken ?? body?.refresh_token;

export const buildAuthMeResponse = (
  user: User,
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
      .filter(ws => ws.workspace_role != null)
      .map(ws => [ws.workspace_id, ws.workspace_role])
  );
  const teamsByWorkspace = Object.fromEntries(
    workspaceData.map(ws => [ws.workspace_id, ws.teams])
  );
  const workspaceRoleDefinitionsByWorkspace = Object.fromEntries(
    workspaceData.map(ws => [ws.workspace_id, ws.workspace_roles])
  );

  return {
    id: user.id,
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
    (role): role is 'global_admin' | 'workspace_admin' =>
      typeof role === 'string' &&
      ['global_admin', 'workspace_admin'].includes(role)
  );
  httpAssert.true(roles.length === requestedRoles.length, {
    message: 'roles contains invalid values'
  });
  return roles;
};

export const createAuthRoutes = (db: DatabaseAdapter) => {
  // Set the cleanup adapter for the timer
  cleanupDbAdapter = db;
  
  const app = new H3();

  // GET /api/auth/config - Get authentication configuration
  app.use(
    '/api/auth/config',
    defineHandler(async event => {
      httpAssert.true(event.req.method === 'GET', { status: 405, message: 'Method not allowed' });

      const authMode = getAuthMode();
      return { mode: authMode };
    })
  );

  // POST /api/auth/login - Username/password login
  app.use(
    '/api/auth/login',
    defineHandler(async event => {
      httpAssert.true(event.req.method === 'POST', { status: 405, message: 'Method not allowed' });

      const authMode = getAuthMode();
      httpAssert.true(authMode === 'local', {
        message: 'Username/password authentication is not enabled'
      });

      const body = (await readBody(event)) as LoginBody | undefined;
      const username = body?.username;
      const password = body?.password;

      httpAssert.string(username, { message: 'Username and password are required' });
      httpAssert.string(password, { message: 'Username and password are required' });

      // Try to find user by ID first, then by email
      let user = await db.identityAuth.getUser(username);

      if (!user && username.includes('@')) {
        user = await db.identityAuth.getUserByEmail(username);
      }

      httpAssert.present(user, { status: 401, message: 'Invalid username or password' });

      httpAssert.present(user.password_hash, {
        status: 401,
        message: 'Invalid username or password'
      });

      httpAssert.true(user.auth_provider === 'local', {
        status: 401,
        message: 'Invalid username or password'
      });

      httpAssert.true(user.is_active, {
        status: 403,
        message: 'User account is inactive'
      });

      const isValid = await verifyPassword(user.password_hash, password);

      httpAssert.true(isValid, {
        status: 401,
        message: 'Invalid username or password'
      });

      // Update last login
      await db.identityAuth.updateUserLastLogin(user.id, new Date());

      const tokens = generateTokenPair(user);
      setTokenCookies(event, tokens);
      return tokens;
    })
  );

  // GET /api/auth/oidc/authorize - Initiate OIDC flow
  app.use(
    '/api/auth/oidc/authorize',
    defineHandler(async event => {
      httpAssert.true(event.req.method === 'GET', { status: 405, message: 'Method not allowed' });

      const authMode = getAuthMode();
      httpAssert.true(authMode === 'oidc', { message: 'OIDC authentication is not enabled' });

      const { url, state, nonce, codeVerifier } = await generateAuthUrl();

      // Store state for callback validation (expires in 10 minutes)
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
      await db.identityAuth.storeOidcAuthState(state, nonce, codeVerifier, expiresAt);

      return { authorization_url: url };
    })
  );

  // GET /api/auth/oidc/callback - OIDC callback
  app.use(
    '/api/auth/oidc/callback',
    defineHandler(async event => {
      httpAssert.true(event.req.method === 'GET', { status: 405, message: 'Method not allowed' });

      const authMode = getAuthMode();
      httpAssert.true(authMode === 'oidc', { message: 'OIDC authentication is not enabled' });

      const query = getQuery(event);
      const state = String(query.state ?? '');

      httpAssert.string(state, { message: 'Missing state parameter' });

      const storedState = await db.identityAuth.getOidcAuthState(state);

      httpAssert.present(storedState, { message: 'Invalid or expired state' });

      await db.identityAuth.deleteOidcAuthState(state);

      // Construct the full callback URL with query parameters
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

      // Find or create user — use issuer:sub as ID to avoid collisions across providers
      let user = await db.identityAuth.getUserByOidc(claims.issuer, claims.sub);

      if (!user) {
        const userId = `${claims.issuer}:${claims.sub}`;
        user = await db.identityAuth.createUser({
          id: userId,
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
        await db.identityAuth.updateUserLastLogin(user.id, new Date());
      }

      httpAssert.true(user.is_active, {
        status: 403,
        message: 'User account is inactive'
      });

      const tokens = generateTokenPair(user);
      setTokenCookies(event, tokens);

      // Redirect to frontend — the cookies carry the auth state
      const frontendUrl = process.env['OIDC_FRONTEND_REDIRECT_URI'] ?? '/';
      return redirect(frontendUrl, 302);
    })
  );

  // POST /api/auth/refresh - Refresh access token
  app.use(
    '/api/auth/refresh',
    defineHandler(async event => {
      httpAssert.true(event.req.method === 'POST', { status: 405, message: 'Method not allowed' });

      // Accept refresh token from cookie or request body
      const cookieToken = getCookie(event, 'ar_refresh_token');
      const body = (await readBody(event).catch(() => undefined)) as RefreshBody | undefined;
      const refreshToken = selectRefreshToken(cookieToken, body);

      httpAssert.string(refreshToken, { message: 'Refresh token is required' });

      let payload: JWTPayload;
      try {
        payload = verifyToken(refreshToken);
      } catch {
        throw new HTTPError({
          status: 401,
          message: 'Invalid or expired refresh token'
        });
      }

      httpAssert.true(payload.type === 'refresh', {
        status: 401,
        message: 'Invalid token type'
      });

      const user = await db.identityAuth.getUser(payload.sub);

      httpAssert.present(user, {
        status: 401,
        message: 'User not found'
      });

      httpAssert.true(user.is_active, {
        status: 403,
        message: 'User account is inactive'
      });

      const tokens = generateTokenPair(user);
      setTokenCookies(event, tokens);
      return tokens;
    })
  );

  // POST /api/auth/logout - Clear auth cookies
  app.use(
    '/api/auth/logout',
    defineHandler(async event => {
      httpAssert.true(event.req.method === 'POST', { status: 405, message: 'Method not allowed' });

      clearAuthCookies(event);
      return { ok: true };
    })
  );

  return app;
};

// Protected auth routes — mounted after auth middleware
export const createAuthProtectedRoutes = (db: DatabaseAdapter) => {
  const app = new H3();

  // GET /api/auth/me - Get current user info
  app.use(
    '/api/auth/me',
    defineHandler(async event => {
      httpAssert.true(event.req.method === 'GET', { status: 405, message: 'Method not allowed' });

      const user = event.context.user as User;
      const [roleAssignments, workspaces] = await Promise.all([
        db.identityAuth.listGlobalRoleAssignments(user.id),
        db.workspaceAdmin.listWorkspaces()
      ]);
      const globalRoles = roleAssignments.map(assignment => assignment.role);

      const workspaceData = await Promise.all(
        workspaces.map(async workspace => {
          const [teamAssignments, teams, workspaceRole, customRoles] = await Promise.all([
            db.workspaceAdmin.listTeamAssignments(workspace.id),
            db.workspaceAdmin.listTeams(workspace.id),
            db.workspaceAdmin.getWorkspaceRole(workspace.id, user.id),
            db.workspaceAdmin.listCustomWorkspaceRoles(workspace.id),
          ]);
          return {
            workspace_id: workspace.id,
            team_assignments: teamAssignments
              .filter(m => m.user_id === user.id)
              .map(m => ({ team_id: m.team_id, role: m.role })),
            teams: teams.map(team => ({
              id: team.id,
              name: team.id,
              type: 'team' as const,
            })),
            workspace_role: workspaceRole,
            workspace_roles: resolveWorkspaceRoleDefinitions(customRoles),
          };
        })
      );

      return buildAuthMeResponse(user, globalRoles, workspaceData);
    })
  );

  // PATCH /api/users/:id - Update current user's own account settings
  app.patch(
    '/api/users/:id',
    defineHandler(async event => {
      const authenticatedUser = event.context.user as User;
      const id = event.context.params?.['id'];
      httpAssert.string(id, { message: 'id is required' });
      httpAssert.true(id === authenticatedUser.id, {
        status: 403,
        message: 'You can only update your own account settings'
      });

      const body = (await readBody(event).catch(() => undefined)) as UserUpdateBody | undefined;
      httpAssert.json(body, { message: 'Request body must be a JSON object' });

      const updatedUser = await db.identityAuth.updateUser(
        id,
        buildUserUpdateInput(body, new Date())
      );

      httpAssert.present(updatedUser, { status: 404, message: 'User not found' });

      return {
        id: updatedUser.id,
        email: updatedUser.email,
        display_name: updatedUser.display_name,
        auth_provider: updatedUser.auth_provider,
        is_active: updatedUser.is_active,
        color: updatedUser.color,
        created_at: updatedUser.created_at.toISOString(),
        updated_at: updatedUser.updated_at.toISOString(),
        last_login_at: updatedUser.last_login_at?.toISOString() ?? null,
      };
    })
  );

  app.get(
    '/api/auth/users',
    defineHandler(async event => {
      const authCtx = await buildApiAuthCtx(db, GLOBAL_WS, event as AuthenticatedEvent);
      requireGlobalPermission(authCtx, 'admin_platform');

      return (await db.identityAuth.listUsers()).map(user => ({
        id: user.id,
        email: user.email,
        display_name: user.display_name,
        auth_provider: user.auth_provider,
        is_active: user.is_active
      }));
    })
  );

  app.get(
    '/api/auth/users/:id/global-roles',
    defineHandler(async event => {
      const userId = event.context.params?.['id'];
      httpAssert.string(userId, { message: 'id is required' });

      const authCtx = await buildApiAuthCtx(db, GLOBAL_WS, event as AuthenticatedEvent);
      requireGlobalPermission(authCtx, 'manage_workspace_roles');
      return await db.identityAuth.listGlobalRoleAssignments(userId);
    })
  );

  app.put(
    '/api/auth/users/:id/global-roles',
    defineHandler(async event => {
      const userId = event.context.params?.['id'];
      httpAssert.string(userId, { message: 'id is required' });

      const authCtx = await buildApiAuthCtx(db, GLOBAL_WS, event as AuthenticatedEvent);
      requireGlobalPermission(authCtx, 'manage_workspace_roles');

      const body = (await readBody(event).catch(() => undefined)) as
        | { roles?: unknown }
        | undefined;
      httpAssert.array(body?.roles, { message: 'roles must be an array' });
      const roles = parseRequestedGlobalRoles(body.roles);
      return await db.identityAuth.replaceGlobalRoleAssignments(userId, roles, new Date());
    })
  );

  return app;
};
