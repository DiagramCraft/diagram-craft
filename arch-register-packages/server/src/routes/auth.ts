import type { H3Event } from 'h3';
import { defineHandler, getCookie, getQuery, H3, HTTPError, readBody, redirect } from 'h3';
import type { DatabaseAdapter } from '../db/database.js';
import { verifyPassword } from '../utils/password.js';
import { generateTokenPair, verifyToken } from '../utils/jwt.js';
import { generateAuthUrl, handleCallback } from '../auth/oidcClient.js';
import { clearAuthCookies, setAuthCookies } from '../utils/cookies.js';
import type { JWTPayload, User } from '../types.js';
import { buildApiAuthCtx, GLOBAL_WS, requireGlobalPermission } from '../auth/authorization.js';
import { getGlobalPermissionsForRoles } from '@arch-register/permissions';
import { AuthenticatedEvent } from '../middleware/auth';

// In-memory store for OIDC state (in production, use Redis or similar)
const oidcStateStore = new Map<
  string,
  {
    state: string;
    nonce: string;
    codeVerifier: string;
    expiresAt: number;
  }
>();

// Clean up expired states every 5 minutes
const cleanupTimer = setInterval(
  () => {
    const now = Date.now();
    for (const [key, value] of oidcStateStore.entries()) {
      if (value.expiresAt < now) {
        oidcStateStore.delete(key);
      }
    }
  },
  5 * 60 * 1000
);
cleanupTimer.unref();

const setTokenCookies = (event: H3Event, tokens: ReturnType<typeof generateTokenPair>) => {
  setAuthCookies(event, tokens.access_token, tokens.refresh_token, tokens.expires_in);
};

export const createAuthRoutes = (db: DatabaseAdapter) => {
  const app = new H3();

  // GET /api/auth/config - Get authentication configuration
  app.use(
    '/api/auth/config',
    defineHandler(async event => {
      if (event.req.method !== 'GET') {
        throw new HTTPError({ status: 405, message: 'Method not allowed' });
      }

      const authMode = process.env['AUTH_MODE'] ?? 'local';
      return { mode: authMode };
    })
  );

  // POST /api/auth/login - Username/password login
  app.use(
    '/api/auth/login',
    defineHandler(async event => {
      if (event.req.method !== 'POST') {
        throw new HTTPError({ status: 405, message: 'Method not allowed' });
      }

      const authMode = process.env['AUTH_MODE'] ?? 'local';
      if (authMode !== 'local') {
        throw new HTTPError({
          status: 400,
          message: 'Username/password authentication is not enabled'
        });
      }

      const body = (await readBody(event)) as { username?: string; password?: string } | undefined;
      const username = body?.username;
      const password = body?.password;

      if (!username || !password) {
        throw new HTTPError({
          status: 400,
          message: 'Username and password are required'
        });
      }

      // Try to find user by ID first, then by email
      let user = await db.getUser(username);
      if (!user && username.includes('@')) {
        user = await db.getUserByEmail(username);
      }

      if (!user || user.auth_provider !== 'local' || !user.password_hash) {
        throw new HTTPError({
          status: 401,
          message: 'Invalid username or password'
        });
      }

      if (!user.is_active) {
        throw new HTTPError({
          status: 403,
          message: 'User account is inactive'
        });
      }

      const isValid = await verifyPassword(user.password_hash, password);

      if (!isValid) {
        throw new HTTPError({
          status: 401,
          message: 'Invalid username or password'
        });
      }

      // Update last login
      await db.updateUserLastLogin(user.id, new Date());

      const tokens = generateTokenPair(user);
      setTokenCookies(event, tokens);
      return tokens;
    })
  );

  // GET /api/auth/oidc/authorize - Initiate OIDC flow
  app.use(
    '/api/auth/oidc/authorize',
    defineHandler(async event => {
      if (event.req.method !== 'GET') {
        throw new HTTPError({ status: 405, message: 'Method not allowed' });
      }

      const authMode = process.env['AUTH_MODE'] ?? 'local';
      if (authMode !== 'oidc') {
        throw new HTTPError({
          status: 400,
          message: 'OIDC authentication is not enabled'
        });
      }

      const { url, state, nonce, codeVerifier } = await generateAuthUrl();

      // Store state for callback validation (expires in 10 minutes)
      oidcStateStore.set(state, {
        state,
        nonce,
        codeVerifier,
        expiresAt: Date.now() + 10 * 60 * 1000
      });

      return { authorization_url: url };
    })
  );

  // GET /api/auth/oidc/callback - OIDC callback
  app.use(
    '/api/auth/oidc/callback',
    defineHandler(async event => {
      if (event.req.method !== 'GET') {
        throw new HTTPError({ status: 405, message: 'Method not allowed' });
      }

      const authMode = process.env['AUTH_MODE'] ?? 'local';
      if (authMode !== 'oidc') {
        throw new HTTPError({
          status: 400,
          message: 'OIDC authentication is not enabled'
        });
      }

      const query = getQuery(event);
      const state = String(query.state ?? '');

      if (!state) {
        throw new HTTPError({
          status: 400,
          message: 'Missing state parameter'
        });
      }

      const storedState = oidcStateStore.get(state);

      if (!storedState) {
        throw new HTTPError({
          status: 400,
          message: 'Invalid or expired state'
        });
      }

      oidcStateStore.delete(state);

      const callbackParams: Record<string, string> = {};
      for (const [key, value] of Object.entries(query)) {
        callbackParams[key] = String(value);
      }

      const claims = await handleCallback(
        callbackParams,
        storedState.state,
        storedState.nonce,
        storedState.codeVerifier
      );

      // Find or create user — use issuer:sub as ID to avoid collisions across providers
      let user = await db.getUserByOidc(claims.issuer, claims.sub);

      if (!user) {
        const userId = `${claims.issuer}:${claims.sub}`;
        user = await db.createUser({
          id: userId,
          email: claims.email ?? null,
          display_name: claims.name,
          auth_provider: 'oidc',
          password_hash: null,
          oidc_issuer: claims.issuer,
          oidc_subject: claims.sub,
          is_active: true,
          created_at: new Date(),
          updated_at: new Date(),
          last_login_at: new Date()
        });
      } else {
        await db.updateUserLastLogin(user.id, new Date());
      }

      if (!user.is_active) {
        throw new HTTPError({
          status: 403,
          message: 'User account is inactive'
        });
      }

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
      if (event.req.method !== 'POST') {
        throw new HTTPError({ status: 405, message: 'Method not allowed' });
      }

      // Accept refresh token from cookie or request body
      const cookieToken = getCookie(event, 'ar_refresh_token');
      const body = (await readBody(event).catch(() => undefined)) as
        | { refresh_token?: string }
        | undefined;
      const refreshToken = cookieToken ?? body?.refresh_token;

      if (!refreshToken) {
        throw new HTTPError({
          status: 400,
          message: 'Refresh token is required'
        });
      }

      let payload: JWTPayload;
      try {
        payload = verifyToken(refreshToken);
      } catch {
        throw new HTTPError({
          status: 401,
          message: 'Invalid or expired refresh token'
        });
      }

      if (payload.type !== 'refresh') {
        throw new HTTPError({
          status: 401,
          message: 'Invalid token type'
        });
      }

      const user = await db.getUser(payload.sub);

      if (!user) {
        throw new HTTPError({
          status: 401,
          message: 'User not found'
        });
      }

      if (!user.is_active) {
        throw new HTTPError({
          status: 403,
          message: 'User account is inactive'
        });
      }

      const tokens = generateTokenPair(user);
      setTokenCookies(event, tokens);
      return tokens;
    })
  );

  // POST /api/auth/logout - Clear auth cookies
  app.use(
    '/api/auth/logout',
    defineHandler(async event => {
      if (event.req.method !== 'POST') {
        throw new HTTPError({ status: 405, message: 'Method not allowed' });
      }

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
      if (event.req.method !== 'GET') {
        throw new HTTPError({ status: 405, message: 'Method not allowed' });
      }

      const user = event.context.user as User;
      const [roleAssignments, workspaces] = await Promise.all([
        db.listGlobalRoleAssignments(user.id),
        db.listWorkspaces()
      ]);
      const globalRoles = roleAssignments.map(assignment => assignment.role);
      const globalPermissions = [...getGlobalPermissionsForRoles(globalRoles)];
      const workspaceMemberships = await Promise.all(
        workspaces.map(async workspace => ({
          workspace_id: workspace.id,
          memberships: (await db.listTeamMemberships(workspace.id))
            .filter(membership => membership.user_id === user.id)
            .map(membership => membership.team_id)
        }))
      );

      const ownerOptionsByWorkspace: Record<string, Array<{ id: string; name: string; type: 'team' }>> = {};
      for (const workspace of workspaces) {
        const owners = await db.listOwners(workspace.id);
        ownerOptionsByWorkspace[workspace.id] = owners.map(o => ({
          id: o.id,
          name: o.id,
          type: 'team' as const
        }));
      }

      return {
        id: user.id,
        email: user.email,
        display_name: user.display_name,
        auth_provider: user.auth_provider,
        created_at: user.created_at.toISOString(),
        last_login_at: user.last_login_at?.toISOString() ?? null,
        global_roles: globalRoles,
        global_permissions: globalPermissions,
        team_memberships: workspaceMemberships
          .filter(workspace => workspace.memberships.length > 0)
          .map(workspace => ({
            workspace_id: workspace.workspace_id,
            team_ids: workspace.memberships
          })),
        owner_options_by_workspace: ownerOptionsByWorkspace
      };
    })
  );

  app.use(
    '/api/auth/users',
    defineHandler(async event => {
      if (event.req.method !== 'GET') {
        throw new HTTPError({ status: 405, message: 'Method not allowed' });
      }

      const authCtx = await buildApiAuthCtx(db, GLOBAL_WS, event as AuthenticatedEvent);
      requireGlobalPermission(authCtx, 'manage_users');

      return (await db.listUsers()).map(user => ({
        id: user.id,
        email: user.email,
        display_name: user.display_name,
        auth_provider: user.auth_provider,
        is_active: user.is_active
      }));
    })
  );

  app.use(
    '/api/auth/users/:id/global-roles',
    defineHandler(async event => {
      const userId = event.context.params?.['id'];
      if (!userId) {
        throw new HTTPError({ status: 400, message: 'id is required' });
      }

      const authCtx = await buildApiAuthCtx(db, GLOBAL_WS, event as AuthenticatedEvent);
      requireGlobalPermission(authCtx, 'manage_global_roles');

      if (event.req.method === 'GET') {
        return await db.listGlobalRoleAssignments(userId);
      }

      if (event.req.method === 'PUT') {
        const body = (await readBody(event).catch(() => undefined)) as
          | { roles?: unknown }
          | undefined;
        if (!body || !Array.isArray(body.roles)) {
          throw new HTTPError({ status: 400, message: 'roles must be an array' });
        }
        const roles = body.roles.filter(
          (role): role is 'platform_admin' | 'schema_admin' | 'user_admin' | 'auditor' =>
            typeof role === 'string' &&
            ['platform_admin', 'schema_admin', 'user_admin', 'auditor'].includes(role)
        );
        if (roles.length !== body.roles.length) {
          throw new HTTPError({ status: 400, message: 'roles contains invalid values' });
        }
        return await db.replaceGlobalRoleAssignments(userId, roles, new Date());
      }

      throw new HTTPError({ status: 405, message: 'Method not allowed' });
    })
  );

  return app;
};
