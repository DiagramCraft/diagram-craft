import { oc } from '@orpc/contract';
import { z } from 'zod';

const timestampOutputSchema = z
  .union([z.string(), z.date()])
  .transform(value => (typeof value === 'string' ? value : value.toISOString()));

const teamRoleSchema = z.enum(['team_admin', 'team_editor', 'team_reviewer']);

// ── Sub-schemas ───────────────────────────────────────────────

const lifecycleStateSchema = z.object({
  id: z.string(),
  workspace: z.string(),
  label: z.string(),
  color: z.string(),
  sort_order: z.number().int(),
  created_at: timestampOutputSchema
});

const lifecycleStateInputSchema = z.object({
  id: z.string().optional(),
  label: z.string(),
  color: z.string(),
  sort_order: z.number().int().optional()
});

const teamSchema = z.object({
  id: z.string(),
  workspace: z.string(),
  name: z.string(),
  sort_order: z.number().int(),
  color: z.string().nullable(),
  description: z.string(),
  created_at: timestampOutputSchema
});

const teamInputSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  sort_order: z.number().int().optional(),
  color: z.string().nullable().optional(),
  description: z.string().optional()
});

const teamAssignmentSchema = z.object({
  workspace: z.string(),
  team_id: z.string(),
  user_id: z.string(),
  role: teamRoleSchema,
  created_at: timestampOutputSchema
});

const teamAssignmentInputSchema = z.object({
  team_id: z.string(),
  user_id: z.string(),
  role: teamRoleSchema
});

const workspaceCapabilitySchema = z.string();

const roleDefinitionSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  tone: z.string(),
  builtin: z.boolean(),
  capabilities: z.array(workspaceCapabilitySchema),
  created_at: timestampOutputSchema.optional(),
  updated_at: timestampOutputSchema.optional()
});

const roleDefinitionDbSchema = z.object({
  id: z.string(),
  workspace: z.string(),
  name: z.string(),
  description: z.string(),
  tone: z.string(),
  builtin: z.boolean(),
  capabilities: z.array(workspaceCapabilitySchema),
  created_at: timestampOutputSchema,
  updated_at: timestampOutputSchema
});

const roleInputSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  tone: z.string().optional(),
  capabilities: z.array(z.string())
});

export const memberInfoSchema = z.object({
  workspace: z.string(),
  user_id: z.string(),
  role: z.string(),
  display_name: z.string(),
  email: z.string().nullable(),
  created_at: timestampOutputSchema
});

const memberDbSchema = z.object({
  workspace: z.string(),
  user_id: z.string(),
  role: z.string(),
  created_at: timestampOutputSchema
});

const userInfoSchema = z.object({
  id: z.string(),
  email: z.string().nullable(),
  display_name: z.string(),
  auth_provider: z.enum(['local', 'oidc']),
  is_active: z.boolean(),
  color: z.string().nullable().optional()
});

// ── Contract ──────────────────────────────────────────────────

export const workspaceConfigContract = {
  config: {
    lifecycleStates: {
      list: oc
        .route({ method: 'GET', path: '/{workspace}/config/lifecycle-states' })
        .input(z.object({ workspace: z.string() }))
        .output(z.array(lifecycleStateSchema)),
      replace: oc
        .route({ method: 'PUT', path: '/{workspace}/config/lifecycle-states' })
        .input(z.object({ workspace: z.string(), states: z.array(lifecycleStateInputSchema) }))
        .output(z.array(lifecycleStateSchema))
    },
    teams: {
      list: oc
        .route({ method: 'GET', path: '/{workspace}/config/teams' })
        .input(z.object({ workspace: z.string() }))
        .output(z.array(teamSchema)),
      replace: oc
        .route({ method: 'PUT', path: '/{workspace}/config/teams' })
        .input(z.object({ workspace: z.string(), teams: z.array(teamInputSchema) }))
        .output(z.array(teamSchema))
    },
    teamAssignments: {
      list: oc
        .route({ method: 'GET', path: '/{workspace}/config/team-assignments' })
        .input(z.object({ workspace: z.string() }))
        .output(z.array(teamAssignmentSchema)),
      replace: oc
        .route({ method: 'PUT', path: '/{workspace}/config/team-assignments' })
        .input(
          z.object({
            workspace: z.string(),
            assignments: z.array(teamAssignmentInputSchema)
          })
        )
        .output(z.array(teamAssignmentSchema))
    },
    roles: {
      list: oc
        .route({ method: 'GET', path: '/{workspace}/config/roles' })
        .input(z.object({ workspace: z.string() }))
        .output(z.array(roleDefinitionSchema)),
      create: oc
        .route({ method: 'POST', path: '/{workspace}/config/roles' })
        .input(z.object({ workspace: z.string() }).merge(roleInputSchema))
        .output(roleDefinitionDbSchema),
      update: oc
        .route({ method: 'PUT', path: '/{workspace}/config/roles/{roleId}' })
        .input(z.object({ workspace: z.string(), roleId: z.string() }).merge(roleInputSchema))
        .output(roleDefinitionDbSchema),
      remove: oc
        .route({ method: 'DELETE', path: '/{workspace}/config/roles/{roleId}' })
        .input(z.object({ workspace: z.string(), roleId: z.string() }))
        .output(roleDefinitionDbSchema)
    },
    members: {
      list: oc
        .route({ method: 'GET', path: '/{workspace}/config/members' })
        .input(z.object({ workspace: z.string() }))
        .output(z.array(memberInfoSchema)),
      updateRole: oc
        .route({ method: 'PUT', path: '/{workspace}/config/members/{userId}/role' })
        .input(z.object({ workspace: z.string(), userId: z.string(), role: z.string() }))
        .output(memberDbSchema),
      remove: oc
        .route({ method: 'DELETE', path: '/{workspace}/config/members/{userId}' })
        .input(z.object({ workspace: z.string(), userId: z.string() }))
        .output(memberDbSchema)
    },
    users: {
      list: oc
        .route({ method: 'GET', path: '/{workspace}/config/users' })
        .input(z.object({ workspace: z.string() }))
        .output(z.array(userInfoSchema))
    }
  }
};

export type WorkspaceMemberInfo = z.infer<typeof memberInfoSchema>;
