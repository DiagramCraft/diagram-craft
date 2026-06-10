import { oc } from '@orpc/contract';
import { z } from 'zod';

// ── Shared sub-schemas ────────────────────────────────────────

const tokenPairSchema = z.object({
  token_type: z.string(),
  access_token: z.string(),
  refresh_token: z.string(),
  expires_in: z.number()
});

const globalRoleSchema = z.enum(['global_admin', 'workspace_admin']);

const teamAssignmentSchema = z.object({
  team_id: z.string(),
  role: z.string()
});

const teamSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.literal('team')
});

export const authMeResponseSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  email: z.string().nullable(),
  display_name: z.string().nullable(),
  auth_provider: z.string(),
  color: z.string().nullable(),
  created_at: z.string(),
  last_login_at: z.string().nullable(),
  global_roles: z.array(globalRoleSchema),
  global_permissions: z.array(z.string()),
  team_assignments_by_workspace: z.record(z.string(), z.array(teamAssignmentSchema)),
  workspace_roles: z.record(z.string(), z.string()),
  workspace_role_definitions_by_workspace: z.record(z.string(), z.unknown()),
  teams_by_workspace: z.record(z.string(), z.array(teamSchema))
});

const userSummarySchema = z.object({
  id: z.string(),
  user_id: z.string(),
  email: z.string().nullable(),
  display_name: z.string().nullable(),
  auth_provider: z.string(),
  is_active: z.boolean(),
  color: z.string().nullable()
});

const userDetailSchema = userSummarySchema.extend({
  created_at: z.string(),
  updated_at: z.string(),
  last_login_at: z.string().nullable()
});

const globalRoleAssignmentSchema = z.object({
  user_id: z.string(),
  role: globalRoleSchema,
  created_at: z.string().optional()
});

// ── Public contract (no auth required) ───────────────────────

export const authPublicContract = {
  auth: {
    config: oc
      .route({ method: 'GET', path: '/auth/config' })
      .input(z.object({}))
      .output(z.object({ mode: z.string() })),
    login: oc
      .route({ method: 'POST', path: '/auth/login' })
      .input(z.object({ username: z.string(), password: z.string() }))
      .output(tokenPairSchema),
    oidcAuthorize: oc
      .route({ method: 'GET', path: '/auth/oidc/authorize' })
      .input(z.object({}))
      .output(z.object({ authorization_url: z.string() })),
    refresh: oc
      .route({ method: 'POST', path: '/auth/refresh' })
      .input(z.object({ refresh_token: z.string().optional() }).optional())
      .output(tokenPairSchema),
    logout: oc
      .route({ method: 'POST', path: '/auth/logout' })
      .input(z.object({}).optional())
      .output(z.object({ ok: z.boolean() }))
  }
};

// ── Protected contract (requires auth) ───────────────────────

export const authProtectedContract = {
  authProtected: {
    me: oc
      .route({ method: 'GET', path: '/auth/me' })
      .input(z.object({}))
      .output(authMeResponseSchema),
    updateUser: oc
      .route({ method: 'PATCH', path: '/users/{id}' })
      .input(
        z.object({
          id: z.string(),
          color: z.string().nullable().optional(),
          display_name: z.string().optional()
        })
      )
      .output(userDetailSchema),
    listUsers: oc
      .route({ method: 'GET', path: '/auth/users' })
      .input(z.object({}))
      .output(z.array(userSummarySchema)),
    getGlobalRoles: oc
      .route({ method: 'GET', path: '/auth/users/{id}/global-roles' })
      .input(z.object({ id: z.string() }))
      .output(z.array(globalRoleAssignmentSchema)),
    replaceGlobalRoles: oc
      .route({ method: 'PUT', path: '/auth/users/{id}/global-roles' })
      .input(z.object({ id: z.string(), roles: z.array(z.string()) }))
      .output(z.array(globalRoleAssignmentSchema))
  }
};
