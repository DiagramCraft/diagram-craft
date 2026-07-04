import { oc } from '@orpc/contract';
import { z } from 'zod';
import { ws, wsAndUUID, teamRoleSchema, workspaceCapabilitySchema } from '@arch-register/api-types/common';

const timestampOutputSchema = z
  .union([z.string(), z.date()])
  .transform(value => (typeof value === 'string' ? value : value.toISOString()));

// ── Sub-schemas ───────────────────────────────────────────────

export const projectEntityTypeSchema = z.object({
  id: z.string().describe('Unique type identifier'),
  label: z.string().describe('Display label for the entity type'),
  sort_order: z.number().int().describe('Display order (0-based)')
});

const lifecycleStateSchema = z.object({
  id: z.string().describe('Unique lifecycle state identifier'),
  workspace: z.string().describe('Parent workspace identifier'),
  label: z.string().describe('Display label for the lifecycle state'),
  color: z.string().describe('Color code (hex format)'),
  sort_order: z.number().int().describe('Display order (0-based)'),
  created_at: timestampOutputSchema.describe('ISO 8601 creation timestamp')
});

const lifecycleStateInputSchema = z.object({
  id: z.string().optional().describe('Optional ID for updating existing state'),
  label: z.string().describe('Display label for the lifecycle state'),
  color: z.string().describe('Color code (hex format)'),
  sort_order: z.number().int().optional().describe('Display order (defaults to end of list)')
});

const teamSchema = z.object({
  id: z.string().describe('Unique team identifier'),
  workspace: z.string().describe('Parent workspace identifier'),
  name: z.string().describe('Team name'),
  sort_order: z.number().int().describe('Display order (0-based)'),
  color: z.string().nullable().describe('Optional team color (hex format)'),
  description: z.string().describe('Team description'),
  created_at: timestampOutputSchema.describe('ISO 8601 creation timestamp')
});

const teamInputSchema = z.object({
  id: z.string().optional().describe('Optional ID for updating existing team'),
  name: z.string().describe('Team name'),
  sort_order: z.number().int().optional().describe('Display order (defaults to end of list)'),
  color: z.string().nullable().optional().describe('Optional team color (hex format)'),
  description: z.string().optional().describe('Team description')
});

const teamAssignmentSchema = z.object({
  workspace: z.string().describe('Workspace identifier'),
  team_id: z.string().describe('Team identifier'),
  user_id: z.string().describe('User identifier'),
  role: teamRoleSchema.describe('User role within the team'),
  created_at: timestampOutputSchema.describe('ISO 8601 assignment timestamp')
});

const teamAssignmentInputSchema = z.object({
  team_id: z.string().describe('Team identifier'),
  user_id: z.string().describe('User identifier'),
  role: teamRoleSchema.describe('User role within the team')
});

const roleDefinitionSchema = z.object({
  id: z.string().describe('Unique role identifier'),
  name: z.string().describe('Role name'),
  description: z.string().describe('Role description'),
  tone: z.string().describe('Role tone/style indicator'),
  builtin: z.boolean().describe('Whether this is a built-in system role'),
  capabilities: z.array(workspaceCapabilitySchema).describe('List of capabilities granted by this role'),
  created_at: timestampOutputSchema.optional().describe('ISO 8601 creation timestamp'),
  updated_at: timestampOutputSchema.optional().describe('ISO 8601 last update timestamp')
});

const roleDefinitionDbSchema = z.object({
  id: z.string().describe('Unique role identifier'),
  workspace: z.string().describe('Parent workspace identifier'),
  name: z.string().describe('Role name'),
  description: z.string().describe('Role description'),
  tone: z.string().describe('Role tone/style indicator'),
  builtin: z.boolean().describe('Whether this is a built-in system role'),
  capabilities: z.array(workspaceCapabilitySchema).describe('List of capabilities granted by this role'),
  created_at: timestampOutputSchema.describe('ISO 8601 creation timestamp'),
  updated_at: timestampOutputSchema.describe('ISO 8601 last update timestamp')
});

const roleInputSchema = z.object({
  name: z.string().describe('Role name'),
  description: z.string().optional().describe('Role description'),
  tone: z.string().optional().describe('Role tone/style indicator'),
  capabilities: z.array(workspaceCapabilitySchema).describe('List of capabilities to grant')
});

export const memberInfoSchema = z.object({
  workspace: z.string().describe('Workspace identifier'),
  user_id: z.string().describe('User identifier'),
  role: z.string().describe('Assigned role identifier'),
  display_name: z.string().describe('User display name'),
  email: z.string().nullable().describe('User email address (may be null)'),
  created_at: timestampOutputSchema.describe('ISO 8601 membership creation timestamp')
});

const memberDbSchema = z.object({
  workspace: z.string().describe('Workspace identifier'),
  user_id: z.string().describe('User identifier'),
  role: z.string().describe('Assigned role identifier'),
  created_at: timestampOutputSchema.describe('ISO 8601 membership creation timestamp')
});

const userInfoSchema = z.object({
  id: z.string().describe('Unique user identifier'),
  email: z.string().nullable().describe('User email address (may be null for OIDC users)'),
  display_name: z.string().describe('User display name'),
  auth_provider: z.enum(['local', 'oidc']).describe('Authentication provider type'),
  is_active: z.boolean().describe('Whether the user account is active'),
  color: z.string().nullable().optional().describe('Optional user color (hex format)')
});

// ── Contract ──────────────────────────────────────────────────

export const workspaceConfigContract = oc
  .tag('Workspace Config')
  .router({
    config: {
      lifecycleStates: {
        list: oc
          .route({
            method: 'GET',
            path: '/{workspace}/config/lifecycle-states',
            inputStructure: 'detailed',
            summary: 'List lifecycle states',
            description: 'Retrieves all lifecycle states configured for the workspace. Lifecycle states represent the stages entities can be in.',
            tags: ['Workspace Config']
          })
          .input(z.object({ params: ws }))
          .output(z.array(lifecycleStateSchema)),
        replace: oc
          .route({
            method: 'PUT',
            path: '/{workspace}/config/lifecycle-states',
            inputStructure: 'detailed',
            summary: 'Replace lifecycle states',
            description: 'Replaces all lifecycle states for the workspace. This is a full replacement operation - any states not included will be removed.',
            tags: ['Workspace Config']
          })
          .input(
            z.object({
              params: ws,
              body: z.object({ states: z.array(lifecycleStateInputSchema).describe('Complete list of lifecycle states') })
            })
          )
          .output(z.array(lifecycleStateSchema))
      },
      teams: {
        list: oc
          .route({
            method: 'GET',
            path: '/{workspace}/config/teams',
            inputStructure: 'detailed',
            summary: 'List teams',
            description: 'Retrieves all teams configured for the workspace. Teams are used to organize users and assign permissions.',
            tags: ['Workspace Config']
          })
          .input(z.object({ params: ws }))
          .output(z.array(teamSchema)),
        replace: oc
          .route({
            method: 'PUT',
            path: '/{workspace}/config/teams',
            inputStructure: 'detailed',
            summary: 'Replace teams',
            description: 'Replaces all teams for the workspace. This is a full replacement operation - any teams not included will be removed.',
            tags: ['Workspace Config']
          })
          .input(
            z.object({
              params: ws,
              body: z.object({ teams: z.array(teamInputSchema).describe('Complete list of teams') })
            })
          )
          .output(z.array(teamSchema))
      },
      teamAssignments: {
        list: oc
          .route({
            method: 'GET',
            path: '/{workspace}/config/team-assignments',
            inputStructure: 'detailed',
            summary: 'List team assignments',
            description: 'Retrieves all user-to-team assignments for the workspace, including their roles within each team.',
            tags: ['Workspace Config']
          })
          .input(z.object({ params: ws }))
          .output(z.array(teamAssignmentSchema)),
        replace: oc
          .route({
            method: 'PUT',
            path: '/{workspace}/config/team-assignments',
            inputStructure: 'detailed',
            summary: 'Replace team assignments',
            description: 'Replaces all team assignments for the workspace. This is a full replacement operation - any assignments not included will be removed.',
            tags: ['Workspace Config']
          })
          .input(
            z.object({
              params: ws,
              body: z.object({
                assignments: z.array(teamAssignmentInputSchema).describe('Complete list of team assignments')
              })
            })
          )
          .output(z.array(teamAssignmentSchema))
      },
      roles: {
        list: oc
          .route({
            method: 'GET',
            path: '/{workspace}/config/roles',
            inputStructure: 'detailed',
            summary: 'List workspace roles',
            description: 'Retrieves all role definitions for the workspace, including both built-in and custom roles with their capabilities.',
            tags: ['Workspace Config']
          })
          .input(z.object({ params: ws }))
          .output(z.array(roleDefinitionSchema)),
        create: oc
          .route({
            method: 'POST',
            path: '/{workspace}/config/roles',
            inputStructure: 'detailed',
            summary: 'Create workspace role',
            description: 'Creates a new custom role definition with the specified capabilities. Built-in roles cannot be created.',
            tags: ['Workspace Config']
          })
          .input(z.object({ params: ws, body: roleInputSchema }))
          .output(roleDefinitionDbSchema),
        update: oc
          .route({
            method: 'PUT',
            path: '/{workspace}/config/roles/{id}',
            inputStructure: 'detailed',
            summary: 'Update workspace role',
            description: 'Updates an existing custom role definition. Built-in roles cannot be modified.',
            tags: ['Workspace Config']
          })
          .input(
            z.object({
              params: wsAndUUID,
              body: roleInputSchema
            })
          )
          .output(roleDefinitionDbSchema),
        remove: oc
          .route({
            method: 'DELETE',
            path: '/{workspace}/config/roles/{id}',
            inputStructure: 'detailed',
            summary: 'Delete workspace role',
            description: 'Deletes a custom role definition. Built-in roles cannot be deleted. This operation will fail if the role is currently assigned to any users.',
            tags: ['Workspace Config']
          })
          .input(z.object({ params: wsAndUUID }))
          .output(roleDefinitionDbSchema)
      },
      members: {
        list: oc
          .route({
            method: 'GET',
            path: '/{workspace}/config/members',
            inputStructure: 'detailed',
            summary: 'List workspace members',
            description: 'Retrieves all members of the workspace with their assigned roles and user information.',
            tags: ['Workspace Config']
          })
          .input(z.object({ params: ws }))
          .output(z.array(memberInfoSchema)),
        updateRole: oc
          .route({
            method: 'PUT',
            path: '/{workspace}/config/members/{id}/role',
            inputStructure: 'detailed',
            summary: 'Update member role',
            description: 'Updates the role assignment for a workspace member. Requires appropriate permissions.',
            tags: ['Workspace Config']
          })
          .input(
            z.object({
              params: wsAndUUID,
              body: z.object({ roleId: z.string().describe('New role identifier to assign') })
            })
          )
          .output(memberDbSchema),
        remove: oc
          .route({
            method: 'DELETE',
            path: '/{workspace}/config/members/{id}',
            inputStructure: 'detailed',
            summary: 'Remove workspace member',
            description: 'Removes a user from the workspace. This revokes all their permissions and access to workspace resources.',
            tags: ['Workspace Config']
          })
          .input(z.object({ params: wsAndUUID }))
          .output(memberDbSchema)
      },
      users: {
        list: oc
          .route({
            method: 'GET',
            path: '/{workspace}/config/users',
            inputStructure: 'detailed',
            summary: 'List available users',
            description: 'Retrieves all users that can be added to the workspace, including their authentication provider and status.',
            tags: ['Workspace Config']
          })
          .input(z.object({ params: ws }))
          .output(z.array(userInfoSchema))
      },
      projectEntityTypes: {
        list: oc
          .route({
            method: 'GET',
            path: '/{workspace}/config/project-entity-types',
            inputStructure: 'detailed',
            summary: 'List project entity types',
            description: 'Retrieves all entity type classifications available for project entities. These types help categorize entities within projects.',
            tags: ['Workspace Config']
          })
          .input(z.object({ params: ws }))
          .output(z.array(projectEntityTypeSchema)),
        replace: oc
          .route({
            method: 'PUT',
            path: '/{workspace}/config/project-entity-types',
            inputStructure: 'detailed',
            summary: 'Replace project entity types',
            description: 'Replaces all project entity types for the workspace. This is a full replacement operation - any types not included will be removed.',
            tags: ['Workspace Config']
          })
          .input(
            z.object({
              params: ws,
              body: z.object({
                types: z.array(z.object({
                  id: z.string().optional().describe('Optional ID for updating existing type'),
                  label: z.string().describe('Display label for the entity type'),
                  sort_order: z.number().int().optional().describe('Display order (defaults to end of list)')
                })).describe('Complete list of project entity types')
              })
            })
          )
          .output(z.array(projectEntityTypeSchema))
      }
    }
  });

export type WorkspaceMemberInfo = z.infer<typeof memberInfoSchema>;
export type WorkspaceRoleCapability = z.infer<typeof workspaceCapabilitySchema>;
export type WorkspaceTeam = z.infer<typeof teamSchema>;
export type WorkspaceTeamInput = z.infer<typeof teamInputSchema>;
export type TeamAssignmentInfo = z.infer<typeof teamAssignmentSchema>;
