import { oc } from '@orpc/contract';
import { z } from 'zod';
import {
  teamRoleSchema,
  workspaceCapabilitySchema,
  UUID_REGEX
} from '@arch-register/api-types/common';
import {
  apiTokenCreateSchema,
  apiTokenCreatedSchema,
  apiTokenSchema
} from '@arch-register/api-types/apiTokenContract';

// ── Shared sub-schemas ────────────────────────────────────────

const globalRoleSchema = z.enum(['global_admin', 'workspace_admin']).describe('Global system role');

const tokenPairSchema = z.object({
  token_type: z.string().describe('Token type (typically "Bearer")'),
  access_token: z.string().describe('JWT access token for API authentication'),
  refresh_token: z.string().describe('JWT refresh token for obtaining new access tokens'),
  expires_in: z.number().describe('Access token expiration time in seconds')
});

const teamAssignmentSchema = z.object({
  team_id: z.string().describe('Team identifier'),
  role: teamRoleSchema.describe('User role within the team')
});

const workspaceRoleDefinitionSchema = z.object({
  id: z.string().describe('Role identifier'),
  name: z.string().describe('Role name'),
  description: z.string().describe('Role description'),
  tone: z.string().describe('Role tone/style indicator'),
  builtin: z.boolean().describe('Whether this is a built-in system role'),
  capabilities: z
    .array(workspaceCapabilitySchema)
    .describe('List of capabilities granted by this role')
});

const teamSchema = z.object({
  id: z.string().describe('Team identifier'),
  name: z.string().describe('Team name'),
  type: z.literal('team').describe('Entity type indicator')
});

const authMeResponseSchema = z.object({
  id: z.string().describe('User session identifier'),
  user_id: z.string().describe('Unique user identifier'),
  email: z.string().nullable().describe('User email address (may be null for OIDC users)'),
  display_name: z.string().nullable().describe('User display name'),
  auth_provider: z.string().describe('Authentication provider (local or oidc)'),
  color: z.string().nullable().describe('User color preference (hex format)'),
  created_at: z.string().describe('ISO 8601 account creation timestamp'),
  last_login_at: z.string().nullable().describe('ISO 8601 last login timestamp'),
  global_roles: z.array(globalRoleSchema).describe('Global system roles assigned to the user'),
  global_permissions: z.array(z.string()).describe('Global permissions granted to the user'),
  team_assignments_by_workspace: z
    .record(z.string(), z.array(teamAssignmentSchema))
    .describe('Team assignments organized by workspace'),
  workspace_roles: z
    .record(z.string(), z.string())
    .describe('Workspace role assignments (workspace ID to role ID)'),
  workspace_role_definitions_by_workspace: z
    .record(z.string(), z.array(workspaceRoleDefinitionSchema))
    .describe('Role definitions for each workspace'),
  teams_by_workspace: z
    .record(z.string(), z.array(teamSchema))
    .describe('Teams organized by workspace')
});

const userSummarySchema = z.object({
  id: z.string().describe('User identifier'),
  user_id: z.string().describe('Unique user identifier'),
  email: z.string().nullable().describe('User email address (may be null)'),
  display_name: z.string().nullable().describe('User display name'),
  auth_provider: z.string().describe('Authentication provider (local or oidc)'),
  is_active: z.boolean().describe('Whether the user account is active'),
  color: z.string().nullable().describe('User color preference (hex format)')
});

const userDetailSchema = userSummarySchema.extend({
  created_at: z.string().describe('ISO 8601 account creation timestamp'),
  updated_at: z.string().describe('ISO 8601 last update timestamp'),
  last_login_at: z.string().nullable().describe('ISO 8601 last login timestamp')
});

const globalRoleAssignmentSchema = z.object({
  user_id: z.string().describe('User identifier'),
  role: globalRoleSchema.describe('Assigned global role'),
  created_at: z.string().optional().describe('ISO 8601 assignment timestamp')
});

const accountApiTokenCreateSchema = apiTokenCreateSchema.extend({
  workspace: z.string().describe('Workspace slug where the token will be valid')
});

// ── Public contract (no auth required) ───────────────────────

export const authPublicContract = oc.tag('Auth').router({
  auth: {
    config: oc
      .route({
        method: 'GET',
        path: '/auth/config',
        inputStructure: 'detailed',
        summary: 'Get authentication configuration',
        description:
          'Retrieves the authentication mode configuration (local or OIDC). Used by clients to determine which authentication flow to use.',
        tags: ['Auth']
      })
      .output(z.object({ mode: z.string().describe('Authentication mode (local or oidc)') })),
    login: oc
      .route({
        method: 'POST',
        path: '/auth/login',
        inputStructure: 'detailed',
        summary: 'Login with credentials',
        description:
          'Authenticates a user with username and password (local authentication only). Returns JWT tokens for subsequent API requests.',
        tags: ['Auth']
      })
      .input(
        z.object({
          body: z.object({
            username: z.string().describe('Username or email address'),
            password: z.string().describe('User password')
          })
        })
      )
      .output(tokenPairSchema),
    oidcAuthorize: oc
      .route({
        method: 'GET',
        path: '/auth/oidc/authorize',
        inputStructure: 'detailed',
        summary: 'Get OIDC authorization URL',
        description:
          'Retrieves the OIDC provider authorization URL for initiating the OAuth2 flow. Client should redirect user to this URL.',
        tags: ['Auth']
      })
      .output(
        z.object({
          query: z.object({
            authorization_url: z.string().describe('OIDC authorization URL to redirect user to')
          })
        })
      ),
    refresh: oc
      .route({
        method: 'POST',
        path: '/auth/refresh',
        inputStructure: 'detailed',
        summary: 'Refresh access token',
        description:
          'Obtains a new access token using a refresh token. Used when the current access token has expired.',
        tags: ['Auth']
      })
      .input(
        z.object({
          body: z
            .object({
              refresh_token: z
                .string()
                .optional()
                .describe('Refresh token (can also be provided via cookie)')
            })
            .optional()
        })
      )
      .output(tokenPairSchema),
    logout: oc
      .route({
        method: 'POST',
        path: '/auth/logout',
        summary: 'Logout user',
        description: 'Invalidates the current user session and clears authentication cookies.',
        tags: ['Auth']
      })
      .output(z.object({ ok: z.boolean().describe('Whether logout was successful') }))
  }
});

// ── Protected contract (requires auth) ───────────────────────

export const authProtectedContract = oc.tag('Auth').router({
  authProtected: {
    me: oc
      .route({
        method: 'GET',
        path: '/auth/me',
        summary: 'Get current user profile',
        description:
          "Retrieves the authenticated user's profile, including roles, permissions, team assignments, and workspace memberships.",
        tags: ['Auth']
      })
      .output(authMeResponseSchema),
    updateUser: oc
      .route({
        method: 'PATCH',
        path: '/users/{id}',
        inputStructure: 'detailed',
        summary: 'Update user profile',
        description:
          'Updates user profile information such as display name and color preference. Users can only update their own profile unless they have admin permissions.',
        tags: ['Auth']
      })
      .input(
        z.object({
          params: z.object({ id: z.string().regex(UUID_REGEX).describe('User identifier (UUID)') }),
          body: z.object({
            color: z.string().nullable().optional().describe('User color preference (hex format)'),
            display_name: z.string().optional().describe('User display name')
          })
        })
      )
      .output(userDetailSchema),
    listUsers: oc
      .route({
        method: 'GET',
        path: '/auth/users',
        summary: 'List all users',
        description: 'Retrieves a list of all users in the system. Requires admin permissions.',
        tags: ['Auth']
      })
      .output(z.array(userSummarySchema)),
    getGlobalRoles: oc
      .route({
        method: 'GET',
        path: '/auth/users/{id}/global-roles',
        inputStructure: 'detailed',
        summary: 'Get user global roles',
        description:
          'Retrieves the global role assignments for a specific user. Requires admin permissions.',
        tags: ['Auth']
      })
      .input(
        z.object({
          params: z.object({ id: z.string().regex(UUID_REGEX).describe('User identifier (UUID)') })
        })
      )
      .output(z.array(globalRoleAssignmentSchema)),
    replaceGlobalRoles: oc
      .route({
        method: 'PUT',
        path: '/auth/users/{id}/global-roles',
        inputStructure: 'detailed',
        summary: 'Update user global roles',
        description:
          'Replaces all global role assignments for a user. This is a full replacement operation. Requires global admin permissions.',
        tags: ['Auth']
      })
      .input(
        z.object({
          params: z.object({ id: z.string().regex(UUID_REGEX).describe('User identifier (UUID)') }),
          body: z.object({
            roles: z.array(globalRoleSchema).describe('Complete list of global roles to assign')
          })
        })
      )
      .output(z.array(globalRoleAssignmentSchema)),
    apiTokens: {
      list: oc
        .route({
          method: 'GET',
          path: '/auth/api-tokens',
          summary: 'List current user API tokens',
          description: 'Lists API tokens created by the current user across workspaces.',
          tags: ['Auth']
        })
        .output(z.array(apiTokenSchema)),
      create: oc
        .route({
          method: 'POST',
          path: '/auth/api-tokens',
          inputStructure: 'detailed',
          summary: 'Create current user API token',
          description: 'Creates a workspace-scoped API token for the current user.',
          tags: ['Auth']
        })
        .input(z.object({ body: accountApiTokenCreateSchema }))
        .output(apiTokenCreatedSchema),
      revoke: oc
        .route({
          method: 'DELETE',
          path: '/auth/api-tokens/{id}',
          inputStructure: 'detailed',
          summary: 'Revoke current user API token',
          description: 'Revokes an API token created by the current user.',
          tags: ['Auth']
        })
        .input(z.object({ params: z.object({ id: z.string().regex(UUID_REGEX) }) }))
        .output(apiTokenSchema)
    }
  }
});
