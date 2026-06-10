import { defineHandler } from 'h3';
import { implement, ORPCError } from '@orpc/server';
import { orpcAssert } from '../../utils/orpcAssert';
import { OpenAPIHandler } from '@orpc/openapi/fetch';
import type { H3Event } from 'h3';
import type { DatabaseAdapter } from '../../db/database';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { toORPCError, orpcErrorInterceptors } from '../../utils/orpcErrors';
import { verifyPassword } from '../../utils/password';
import { generateTokenPair, verifyToken } from '../../utils/jwt';
import { generateAuthUrl } from './oidcClient';
import { clearAuthCookies, setAuthCookies } from '../../utils/cookies';
import { getCookie } from 'h3';
import type { JWTPayload } from '../../types';
import { buildApiAuthCtx, GLOBAL_WS, requireGlobalPermission } from './authorization';
import {
  buildAuthMeResponse,
  buildUserUpdateInput,
  parseRequestedGlobalRoles,
  selectRefreshToken
} from './authRoutes';
import { resolveWorkspaceRoleDefinitions } from '@arch-register/permissions';
import type { TeamRole } from '@arch-register/permissions';
import type { UserDbResult } from './db/authDatabase';
import { authProtectedContract, authPublicContract } from '@arch-register/api-types/authContract';

const getAuthMode = () => process.env['AUTH_MODE'] ?? 'local';

// ── Public ORPC (no auth required) ───────────────────────────

type PublicORPCContext = {
  db: DatabaseAdapter;
  event: H3Event;
};

const publicRouter = implement(authPublicContract).$context<PublicORPCContext>();

export const authPublicORPCRouter = publicRouter.router({
  auth: {
    config: publicRouter.auth.config.handler(async () => {
      try {
        return { mode: getAuthMode() };
      } catch (error) {
        return toORPCError(error);
      }
    }),

    login: publicRouter.auth.login.handler(async ({ input, context }) => {
      try {
        const authMode = getAuthMode();
        orpcAssert.true(authMode === 'local', {
          code: 'BAD_REQUEST',
          message: 'Username/password authentication is not enabled'
        });

        let user = await context.db.auth.getUserByUserId(input.body.username);
        if (!user && input.body.username.includes('@')) {
          user = await context.db.auth.getUserByEmail(input.body.username);
        }
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

        const isValid = await verifyPassword(user.password_hash, input.body.password);
        orpcAssert.true(isValid, { code: 'UNAUTHORIZED', message: 'Invalid username or password' });

        await context.db.auth.updateUserLastLogin(user.id, new Date());
        const tokens = generateTokenPair(user);
        setAuthCookies(context.event, tokens.access_token, tokens.refresh_token, tokens.expires_in);
        return tokens;
      } catch (error) {
        return toORPCError(error);
      }
    }),

    oidcAuthorize: publicRouter.auth.oidcAuthorize.handler(async ({ context }) => {
      try {
        const authMode = getAuthMode();
        orpcAssert.true(authMode === 'oidc', {
          code: 'BAD_REQUEST',
          message: 'OIDC authentication is not enabled'
        });

        const { url, state, nonce, codeVerifier } = await generateAuthUrl();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
        await context.db.auth.storeOidcAuthState(state, nonce, codeVerifier, expiresAt);
        return { query: { authorization_url: url } };
      } catch (error) {
        return toORPCError(error);
      }
    }),

    refresh: publicRouter.auth.refresh.handler(async ({ input, context }) => {
      try {
        const cookieToken = getCookie(
          context.event as Parameters<typeof getCookie>[0],
          'ar_refresh_token'
        );
        const refreshToken = selectRefreshToken(cookieToken, input.body);
        orpcAssert.present(refreshToken, { code: 'UNAUTHORIZED', message: 'Refresh token is required' });

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

        const tokens = generateTokenPair(user);
        setAuthCookies(context.event, tokens.access_token, tokens.refresh_token, tokens.expires_in);
        return tokens;
      } catch (error) {
        return toORPCError(error);
      }
    }),

    logout: publicRouter.auth.logout.handler(async ({ context }) => {
      try {
        clearAuthCookies(context.event);
        return { ok: true };
      } catch (error) {
        return toORPCError(error);
      }
    })
  }
});

export const authPublicOpenAPIHandler = new OpenAPIHandler(authPublicORPCRouter, {
  clientInterceptors: orpcErrorInterceptors
});

export const createPublicAuthORPCHandler = (db: DatabaseAdapter) =>
  defineHandler(async event => {
    const result = await authPublicOpenAPIHandler.handle(event.req, {
      prefix: '/api',
      context: { db, event }
    });
    if (result.matched) return result.response;
  });

// ── Protected ORPC (requires auth) ───────────────────────────

type ProtectedORPCContext = {
  db: DatabaseAdapter;
  event: AuthenticatedEvent;
};

const protectedRouter = implement(authProtectedContract).$context<ProtectedORPCContext>();

export const authProtectedORPCRouter = protectedRouter.router({
  authProtected: {
    me: protectedRouter.authProtected.me.handler(async ({ context }) => {
      try {
        const user = context.event.context.user as UserDbResult;
        const [roleAssignments, workspaces] = await Promise.all([
          context.db.auth.listGlobalRoleAssignments(user.id),
          context.db.workspace.listWorkspaces()
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
      } catch (error) {
        return toORPCError(error);
      }
    }),

    updateUser: protectedRouter.authProtected.updateUser.handler(async ({ input, context }) => {
      try {
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
          id: updatedUser.id,
          user_id: updatedUser.user_id,
          email: updatedUser.email,
          display_name: updatedUser.display_name,
          auth_provider: updatedUser.auth_provider,
          is_active: updatedUser.is_active,
          color: updatedUser.color,
          created_at: updatedUser.created_at.toISOString(),
          updated_at: updatedUser.updated_at.toISOString(),
          last_login_at: updatedUser.last_login_at?.toISOString() ?? null
        };
      } catch (error) {
        return toORPCError(error);
      }
    }),

    listUsers: protectedRouter.authProtected.listUsers.handler(async ({ context }) => {
      try {
        const authCtx = await buildApiAuthCtx(context.db, GLOBAL_WS, context.event);
        requireGlobalPermission(authCtx, 'admin_platform');
        return (await context.db.auth.listUsers()).map(user => ({
          id: user.id,
          user_id: user.user_id,
          email: user.email,
          display_name: user.display_name,
          auth_provider: user.auth_provider,
          is_active: user.is_active,
          color: user.color
        }));
      } catch (error) {
        return toORPCError(error);
      }
    }),

    getGlobalRoles: protectedRouter.authProtected.getGlobalRoles.handler(
      async ({ input, context }) => {
        try {
          const authCtx = await buildApiAuthCtx(context.db, GLOBAL_WS, context.event);
          requireGlobalPermission(authCtx, 'manage_workspace_roles');
          const assignments = await context.db.auth.listGlobalRoleAssignments(input.params.id);
          return assignments.map(a => ({
            user_id: a.user_id,
            role: a.role,
            created_at: a.created_at instanceof Date ? a.created_at.toISOString() : a.created_at
          }));
        } catch (error) {
          return toORPCError(error);
        }
      }
    ),

    replaceGlobalRoles: protectedRouter.authProtected.replaceGlobalRoles.handler(
      async ({ input, context }) => {
        try {
          const authCtx = await buildApiAuthCtx(context.db, GLOBAL_WS, context.event);
          requireGlobalPermission(authCtx, 'manage_workspace_roles');
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
        } catch (error) {
          return toORPCError(error);
        }
      }
    )
  }
});

export const authProtectedOpenAPIHandler = new OpenAPIHandler(authProtectedORPCRouter, {
  clientInterceptors: orpcErrorInterceptors
});

export const createProtectedAuthORPCHandler = (db: DatabaseAdapter) =>
  defineHandler(async event => {
    const result = await authProtectedOpenAPIHandler.handle(event.req, {
      prefix: '/api',
      context: { db, event: event as AuthenticatedEvent }
    });
    if (result.matched) return result.response;
  });
