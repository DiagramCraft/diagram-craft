import { randomUUID } from 'node:crypto';
import { implement, ORPCError } from '@orpc/server';
import { orpcAssert } from '../../utils/orpcAssert';
import type { H3Event } from 'h3';
import type { DatabaseAdapter } from '../../db/database';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { createOrpcHandler } from '../../utils/orpcHandler';
import { API_PREFIXES } from '../../constants';
import { orpcErrorMiddleware } from '../../utils/orpcErrors';
import { getTokenExpirySeconds, verifyToken } from '../../utils/jwt';
import { generateAuthUrl } from './oidcClient';
import { clearAuthCookies, setAuthCookies } from '../../utils/cookies';
import { getCookie } from 'h3';
import type { JWTPayload } from '../../types';
import { buildApiAuthCtx, GLOBAL_WS, requireGlobalPermission } from './authorization';
import {
  buildAuthMeResponse,
  buildManagedUserUpdateInput,
  buildUserUpdateInput,
  parseRequestedGlobalRoles,
  serializeUser,
  selectRefreshToken,
  verifyLoginPassword
} from './authHelpers';
import { resolveWorkspaceRoleDefinitions } from '@arch-register/permissions';
import type { TeamRole } from '@arch-register/permissions';
import type { UserDbResult } from './db/authDatabase';
import { authProtectedContract, authPublicContract } from '@arch-register/api-types/authContract';
import { createUserApiToken, listUserApiTokens, revokeUserApiToken } from './apiTokenOperations';
import { issueTokenPair, revokeRefreshToken, rotateRefreshToken } from './refreshSessions';
import { hashPassword } from '../../utils/password';

const getAuthMode = () => process.env['AUTH_MODE'] ?? 'local';

const normalizeNullableText = (value: string | null | undefined) => {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const requireUserManagementMode = () => {
  orpcAssert.true(getAuthMode() !== 'oidc', {
    code: 'BAD_REQUEST',
    message: 'User management is not available when OIDC authentication is enabled'
  });
};

const requirePlatformAdmin = async (db: DatabaseAdapter, event: AuthenticatedEvent) => {
  const authCtx = await buildApiAuthCtx(db, GLOBAL_WS, event);
  requireGlobalPermission(authCtx, 'admin_platform');
};

// ── Public ORPC (no auth required) ───────────────────────────

type PublicORPCContext = {
  db: DatabaseAdapter;
  event: H3Event;
};

const publicRouter = implement(authPublicContract)
  .$context<PublicORPCContext>()
  .use(orpcErrorMiddleware);

export const authPublicORPCRouter = publicRouter.router({
  auth: {
    config: publicRouter.auth.config.handler(async () => {
      return { mode: getAuthMode() };
    }),

    login: publicRouter.auth.login.handler(async ({ input, context }) => {
      const authMode = getAuthMode();
      orpcAssert.true(authMode === 'local', {
        code: 'BAD_REQUEST',
        message: 'Username/password authentication is not enabled'
      });

      let user = await context.db.auth.getUserByUserId(input.body.username);
      if (!user && input.body.username.includes('@')) {
        user = await context.db.auth.getUserByEmail(input.body.username);
      }
      const isValid = await verifyLoginPassword(user, input.body.password);
      orpcAssert.present(user, { code: 'UNAUTHORIZED', message: 'Invalid username or password' });
      orpcAssert.string(user.password_hash, {
        code: 'UNAUTHORIZED',
        message: 'Invalid username or password'
      });
      orpcAssert.true(user.auth_provider === 'local', {
        code: 'UNAUTHORIZED',
        message: 'Invalid username or password'
      });
      orpcAssert.true(user.is_active, {
        code: 'FORBIDDEN',
        message: 'User account is inactive'
      });

      orpcAssert.true(isValid, { code: 'UNAUTHORIZED', message: 'Invalid username or password' });

      await context.db.auth.updateUserLastLogin(user.id, new Date());
      const tokens = await issueTokenPair(context.db, user);
      setAuthCookies(
        context.event,
        tokens.access_token,
        tokens.refresh_token,
        tokens.expires_in,
        getTokenExpirySeconds('refresh')
      );
      return tokens;
    }),

    oidcAuthorize: publicRouter.auth.oidcAuthorize.handler(async ({ context }) => {
      const authMode = getAuthMode();
      orpcAssert.true(authMode === 'oidc', {
        code: 'BAD_REQUEST',
        message: 'OIDC authentication is not enabled'
      });

      const { url, state, nonce, codeVerifier } = await generateAuthUrl();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
      await context.db.auth.storeOidcAuthState(state, nonce, codeVerifier, expiresAt);
      return { query: { authorization_url: url } };
    }),

    refresh: publicRouter.auth.refresh.handler(async ({ input, context }) => {
      const cookieToken = getCookie(
        context.event as Parameters<typeof getCookie>[0],
        'ar_refresh_token'
      );
      // Cookie is preferred (browser flow). Body fallback is for non-browser API clients only.
      const refreshToken = selectRefreshToken(cookieToken, input.body);
      orpcAssert.present(refreshToken, {
        code: 'UNAUTHORIZED',
        message: 'Refresh token is required',
        data: { expected: true }
      });

      let payload: JWTPayload;
      try {
        payload = verifyToken(refreshToken);
      } catch {
        throw new ORPCError('UNAUTHORIZED', { message: 'Invalid or expired refresh token' });
      }

      orpcAssert.true(payload.type === 'refresh', {
        code: 'UNAUTHORIZED',
        message: 'Invalid token type'
      });

      const user = await context.db.auth.getUser(payload.sub);
      orpcAssert.present(user, { code: 'UNAUTHORIZED', message: 'User not found' });
      orpcAssert.true(user.is_active, { code: 'FORBIDDEN', message: 'User account is inactive' });

      const rotation = await rotateRefreshToken(context.db, refreshToken, user);
      if (rotation.status === 'reused') {
        throw new ORPCError('UNAUTHORIZED', { message: 'Invalid or expired refresh token' });
      }
      if (rotation.status === 'invalid') {
        throw new ORPCError('UNAUTHORIZED', { message: 'Invalid or expired refresh token' });
      }

      const tokens = rotation.tokens;
      setAuthCookies(
        context.event,
        tokens.access_token,
        tokens.refresh_token,
        tokens.expires_in,
        getTokenExpirySeconds('refresh')
      );
      return tokens;
    }),

    logout: publicRouter.auth.logout.handler(async ({ input, context }) => {
      const cookieToken = getCookie(
        context.event as Parameters<typeof getCookie>[0],
        'ar_refresh_token'
      );
      const refreshToken = selectRefreshToken(cookieToken, input?.body);
      if (refreshToken) {
        await revokeRefreshToken(context.db, refreshToken);
      }
      clearAuthCookies(context.event);
      return { ok: true };
    })
  }
});

export const createPublicAuthORPCHandler = (db: DatabaseAdapter) =>
  createOrpcHandler(authPublicORPCRouter, {
    prefix: API_PREFIXES.root,
    context: event => ({ db, event })
  });

// ── Protected ORPC (requires auth) ───────────────────────────

type ProtectedORPCContext = {
  db: DatabaseAdapter;
  event: AuthenticatedEvent;
};

const requireInteractiveSession = (event: AuthenticatedEvent) => {
  orpcAssert.true(!event.context.apiToken, {
    code: 'FORBIDDEN',
    message: 'API tokens cannot access user account operations'
  });
};

const protectedRouter = implement(authProtectedContract)
  .$context<ProtectedORPCContext>()
  .use(orpcErrorMiddleware);

export const authProtectedORPCRouter = protectedRouter.router({
  authProtected: {
    me: protectedRouter.authProtected.me.handler(async ({ context }) => {
      requireInteractiveSession(context.event);
      const user = context.event.context.user as UserDbResult;
      const [roleAssignments, workspaces] = await Promise.all([
        context.db.auth.listGlobalRoleAssignments(user.id),
        context.db.workspace.listWorkspacesForUser(user.id)
      ]);
      const globalRoles = roleAssignments.map(a => a.role);

      const workspaceData = await Promise.all(
        workspaces.map(async workspace => {
          const [teamAssignments, teams, workspaceRole, customRoles] = await Promise.all([
            context.db.workspace.listTeamAssignments(workspace.id),
            context.db.workspace.listTeams(workspace.id),
            context.db.workspace.getWorkspaceRole(workspace.id, user.id),
            context.db.workspace.listCustomWorkspaceRoles(workspace.id)
          ]);
          return {
            workspace_id: workspace.id,
            team_assignments: teamAssignments
              .filter(m => m.user_id === user.id)
              .map(m => ({ team_id: m.team_id, role: m.role as TeamRole })),
            teams: teams.map(team => ({ id: team.id, name: team.name, type: 'team' as const })),
            workspace_role: workspaceRole,
            workspace_roles: resolveWorkspaceRoleDefinitions(customRoles)
          };
        })
      );

      return buildAuthMeResponse(user, globalRoles, workspaceData);
    }),

    updateUser: protectedRouter.authProtected.updateUser.handler(async ({ input, context }) => {
      requireInteractiveSession(context.event);
      const authenticatedUser = context.event.context.user as UserDbResult;
      if (input.params.id !== authenticatedUser.id) {
        throw new ORPCError('FORBIDDEN', {
          message: 'You can only update your own account settings'
        });
      }
      const updatedUser = await context.db.auth.updateUser(
        input.params.id,
        buildUserUpdateInput(input.body, new Date())
      );
      orpcAssert.present(updatedUser, { code: 'NOT_FOUND', message: 'User not found' });
      return {
        ...serializeUser(updatedUser)
      };
    }),

    listUsers: protectedRouter.authProtected.listUsers.handler(async ({ context }) => {
      requireInteractiveSession(context.event);
      const authCtx = await buildApiAuthCtx(context.db, GLOBAL_WS, context.event);
      requireGlobalPermission(authCtx, 'manage_workspace_roles');
      return (await context.db.auth.listUsers()).map(user => ({
        id: user.id,
        user_id: user.user_id,
        email: user.email,
        display_name: user.display_name,
        auth_provider: user.auth_provider,
        is_active: user.is_active,
        is_system_actor: user.is_system_actor,
        color: user.color
      }));
    }),

    createUser: protectedRouter.authProtected.createUser.handler(async ({ input, context }) => {
      requireInteractiveSession(context.event);
      await requirePlatformAdmin(context.db, context.event);
      requireUserManagementMode();

      const userId = input.body.user_id.trim();
      const displayName = input.body.display_name.trim();
      orpcAssert.true(userId.length > 0, {
        code: 'BAD_REQUEST',
        message: 'Username is required'
      });
      orpcAssert.true(displayName.length > 0, {
        code: 'BAD_REQUEST',
        message: 'Display name is required'
      });

      const now = new Date();
      const user = await context.db.auth.createUser({
        id: randomUUID(),
        user_id: userId,
        email: normalizeNullableText(input.body.email),
        display_name: displayName,
        auth_provider: 'local',
        password_hash: await hashPassword(input.body.password),
        oidc_issuer: null,
        oidc_subject: null,
        is_active: input.body.is_active ?? true,
        color: input.body.color ?? null,
        created_at: now,
        updated_at: now,
        last_login_at: null
      });
      return serializeUser(user);
    }),

    getUser: protectedRouter.authProtected.getUser.handler(async ({ input, context }) => {
      requireInteractiveSession(context.event);
      await requirePlatformAdmin(context.db, context.event);
      requireUserManagementMode();

      const user = await context.db.auth.getUser(input.params.id);
      orpcAssert.present(user, { code: 'NOT_FOUND', message: 'User not found' });
      return serializeUser(user);
    }),

    updateManagedUser: protectedRouter.authProtected.updateManagedUser.handler(
      async ({ input, context }) => {
        requireInteractiveSession(context.event);
        await requirePlatformAdmin(context.db, context.event);
        requireUserManagementMode();

        const existingUser = await context.db.auth.getUser(input.params.id);
        orpcAssert.present(existingUser, { code: 'NOT_FOUND', message: 'User not found' });
        orpcAssert.true(!existingUser.is_system_actor, {
          code: 'FORBIDDEN',
          message: 'System users cannot be modified'
        });

        let passwordHash: string | undefined;
        if (input.body.password !== undefined) {
          orpcAssert.true(existingUser.auth_provider === 'local', {
            code: 'BAD_REQUEST',
            message: 'OIDC users do not have a local password'
          });
          passwordHash = await hashPassword(input.body.password);
        }

        const displayName = input.body.display_name?.trim();
        orpcAssert.true(displayName === undefined || displayName.length > 0, {
          code: 'BAD_REQUEST',
          message: 'Display name cannot be empty'
        });
        const managedUpdates = {
          ...(input.body.email !== undefined
            ? { email: normalizeNullableText(input.body.email) }
            : {}),
          ...(displayName !== undefined ? { display_name: displayName } : {}),
          ...(input.body.is_active !== undefined ? { is_active: input.body.is_active } : {}),
          ...(input.body.color !== undefined ? { color: input.body.color } : {})
        };
        const updatedUser = await context.db.auth.updateUser(
          input.params.id,
          buildManagedUserUpdateInput(managedUpdates, passwordHash, new Date())
        );
        orpcAssert.present(updatedUser, { code: 'NOT_FOUND', message: 'User not found' });
        return serializeUser(updatedUser);
      }
    ),

    deactivateUser: protectedRouter.authProtected.deactivateUser.handler(
      async ({ input, context }) => {
        requireInteractiveSession(context.event);
        await requirePlatformAdmin(context.db, context.event);
        requireUserManagementMode();

        const authenticatedUser = context.event.context.user as UserDbResult;
        orpcAssert.true(input.params.id !== authenticatedUser.id, {
          code: 'FORBIDDEN',
          message: 'You cannot deactivate your own account'
        });

        const existingUser = await context.db.auth.getUser(input.params.id);
        orpcAssert.present(existingUser, { code: 'NOT_FOUND', message: 'User not found' });
        orpcAssert.true(!existingUser.is_system_actor, {
          code: 'FORBIDDEN',
          message: 'System users cannot be modified'
        });

        const deactivatedUser = await context.db.auth.updateUser(input.params.id, {
          is_active: false,
          updated_at: new Date()
        });
        orpcAssert.present(deactivatedUser, { code: 'NOT_FOUND', message: 'User not found' });
        return serializeUser(deactivatedUser);
      }
    ),

    getGlobalRoles: protectedRouter.authProtected.getGlobalRoles.handler(
      async ({ input, context }) => {
        requireInteractiveSession(context.event);
        const authCtx = await buildApiAuthCtx(context.db, GLOBAL_WS, context.event);
        requireGlobalPermission(authCtx, 'manage_workspace_roles');
        const assignments = await context.db.auth.listGlobalRoleAssignments(input.params.id);
        return assignments.map(a => ({
          user_id: a.user_id,
          role: a.role,
          created_at: a.created_at instanceof Date ? a.created_at.toISOString() : a.created_at
        }));
      }
    ),

    replaceGlobalRoles: protectedRouter.authProtected.replaceGlobalRoles.handler(
      async ({ input, context }) => {
        requireInteractiveSession(context.event);
        const authCtx = await buildApiAuthCtx(context.db, GLOBAL_WS, context.event);
        requireGlobalPermission(authCtx, 'manage_workspace_roles');
        const targetUser = await context.db.auth.getUser(input.params.id);
        orpcAssert.present(targetUser, { code: 'NOT_FOUND', message: 'User not found' });
        orpcAssert.true(!targetUser.is_system_actor, {
          code: 'FORBIDDEN',
          message: 'System users cannot be assigned roles'
        });
        const roles = parseRequestedGlobalRoles(input.body.roles);
        const assignments = await context.db.auth.replaceGlobalRoleAssignments(
          input.params.id,
          roles,
          new Date()
        );
        return assignments.map(a => ({
          user_id: a.user_id,
          role: a.role,
          created_at: a.created_at instanceof Date ? a.created_at.toISOString() : a.created_at
        }));
      }
    ),

    apiTokens: {
      list: protectedRouter.authProtected.apiTokens.list.handler(async ({ context }) => {
        requireInteractiveSession(context.event);
        return listUserApiTokens(context.db, context.event);
      }),
      create: protectedRouter.authProtected.apiTokens.create.handler(async ({ input, context }) => {
        requireInteractiveSession(context.event);
        return createUserApiToken(context.db, input.body, context.event);
      }),
      revoke: protectedRouter.authProtected.apiTokens.revoke.handler(async ({ input, context }) => {
        requireInteractiveSession(context.event);
        return revokeUserApiToken(context.db, input.params.id, context.event);
      })
    }
  }
});

export const createProtectedAuthORPCHandler = (db: DatabaseAdapter) =>
  createOrpcHandler(authProtectedORPCRouter, {
    prefix: API_PREFIXES.root,
    context: event => ({ db, event: event as AuthenticatedEvent })
  });
