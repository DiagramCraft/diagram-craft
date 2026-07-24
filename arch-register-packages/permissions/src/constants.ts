import type {
  BuiltinWorkspaceRole,
  EntityAction,
  EntityRole,
  GlobalPermission,
  GlobalRole,
  ProjectAction,
  TeamRole,
  WorkspaceCapability,
  WorkspaceRole,
  WorkspaceRoleDefinition
} from './types.js';
import {
  AR_COLOR_GREEN,
  AR_COLOR_BLUE,
  AR_COLOR_RED,
  AR_COLOR_YELLOW,
  AR_COLOR_GREY
} from '@arch-register/api-types/colors';

/**
 * Maps entity roles to the actions they can perform
 */
export const ROLE_ACTIONS: Record<EntityRole, EntityAction[]> = {
  editor: ['view_entity', 'edit_entity'],
  contributor: ['view_entity', 'edit_entity', 'create_child'],
  entity_admin: ['view_entity', 'edit_entity', 'create_child', 'admin_entity']
};

export const TEAM_ROLE_PERMISSIONS: Record<
  TeamRole,
  {
    directEntityActions: EntityAction[];
    descendantEntityActions: EntityAction[];
    projectActions: ProjectAction[];
    canCreateProjects: boolean;
    canCreateEntities: boolean;
  }
> = {
  team_admin: {
    directEntityActions: ROLE_ACTIONS['entity_admin'],
    descendantEntityActions: ROLE_ACTIONS['contributor'],
    projectActions: ['edit_project', 'delete_project', 'manage_files'],
    canCreateProjects: true,
    canCreateEntities: true
  },
  team_editor: {
    directEntityActions: ROLE_ACTIONS['contributor'],
    descendantEntityActions: ROLE_ACTIONS['editor'],
    projectActions: ['edit_project', 'manage_files'],
    canCreateProjects: true,
    canCreateEntities: true
  },
  team_reviewer: {
    // Team ownership grants view independently of any workspace-wide capability — a
    // team_reviewer may have no general workspace role at all, so this can't be dropped in
    // favor of content.view the way the standalone 'viewer' EntityRole grant could be.
    directEntityActions: ['view_entity'],
    descendantEntityActions: ['view_entity'],
    projectActions: [],
    canCreateProjects: false,
    canCreateEntities: false
  }
};

/**
 * Maps global roles to their permissions.
 * global_admin gets everything; workspace_admin can create workspaces and manage roles.
 */
export const GLOBAL_ROLE_PERMISSIONS: Record<GlobalRole, GlobalPermission[]> = {
  global_admin: ['admin_platform', 'create_workspaces', 'manage_workspace_roles'],
  workspace_admin: ['create_workspaces', 'manage_workspace_roles']
};

export const GLOBAL_ROLES: Array<{
  id: GlobalRole;
  name: string;
  description: string;
  tone: string;
}> = [
  {
    id: 'global_admin',
    name: 'Global admin',
    description: 'Full platform access, including user administration and all global settings.',
    tone: AR_COLOR_RED
  },
  {
    id: 'workspace_admin',
    name: 'Workspace admin',
    description: 'Can create workspaces and manage global workspace-role assignments.',
    tone: AR_COLOR_BLUE
  }
];

/**
 * Maps workspace roles to capabilities within a workspace.
 */
export const WORKSPACE_ROLE_CAPABILITIES: Record<BuiltinWorkspaceRole, WorkspaceCapability[]> = {
  owner: [
    'ws.view',
    'ws.settings',
    'ws.delete',
    'ws.audit',
    'ws.manage_views',
    'people.invite',
    'people.role',
    'people.remove',
    'people.teams',
    'proj.create',
    'proj.edit',
    'proj.delete',
    'content.view',
    'content.edit',
    'ent.edit',
    'ent.propose',
    'ent.approve',
    'ent.override',
    'ent.external_update',
    'comments',
    'export',
    'schema.edit',
    'schema.publish'
  ],
  admin: [
    'ws.view',
    'ws.settings',
    'ws.audit',
    'ws.manage_views',
    'people.invite',
    'people.role',
    'people.remove',
    'people.teams',
    'proj.create',
    'proj.edit',
    'proj.delete',
    'content.view',
    'content.edit',
    'ent.edit',
    'ent.propose',
    'ent.approve',
    'ent.override',
    'ent.external_update',
    'comments',
    'export',
    'schema.edit',
    'schema.publish'
  ],
  editor: [
    'ws.view',
    'ws.manage_views',
    'proj.create',
    'proj.edit',
    'content.view',
    'content.edit',
    'ent.edit',
    'ent.propose',
    'comments',
    'export'
  ],
  reviewer: ['ws.view', 'content.view', 'ent.propose', 'comments', 'export'],
  viewer: ['ws.view', 'content.view', 'export']
};

/**
 * Metadata for workspace roles — used by the admin UI.
 */
export const BUILTIN_WORKSPACE_ROLES: WorkspaceRoleDefinition[] = [
  {
    id: 'owner',
    name: 'Owner',
    description: 'Full access to everything, including billing and workspace deletion.',
    tone: AR_COLOR_YELLOW,
    builtin: true,
    capabilities: WORKSPACE_ROLE_CAPABILITIES['owner']
  },
  {
    id: 'admin',
    name: 'Admin',
    description: 'Manage members, teams, integrations and the data model.',
    tone: AR_COLOR_BLUE,
    builtin: true,
    capabilities: WORKSPACE_ROLE_CAPABILITIES['admin']
  },
  {
    id: 'editor',
    name: 'Editor',
    description: 'Create and edit diagrams, entities and projects.',
    tone: AR_COLOR_GREEN,
    builtin: true,
    capabilities: WORKSPACE_ROLE_CAPABILITIES['editor']
  },
  {
    id: 'reviewer',
    name: 'Reviewer',
    description: 'Comment on diagrams and propose changes — read-only otherwise.',
    tone: AR_COLOR_BLUE,
    builtin: true,
    capabilities: WORKSPACE_ROLE_CAPABILITIES['reviewer']
  },
  {
    id: 'viewer',
    name: 'Viewer',
    description: 'Read-only access to all content in the workspace.',
    tone: AR_COLOR_GREY,
    builtin: true,
    capabilities: WORKSPACE_ROLE_CAPABILITIES['viewer']
  }
];

export const WORKSPACE_ROLES = BUILTIN_WORKSPACE_ROLES;

/**
 * Capability groups for the permission matrix UI.
 */
export const WORKSPACE_CAPABILITY_GROUPS: Array<{
  label: string;
  caps: Array<{
    id: WorkspaceCapability;
    name: string;
  }>;
}> = [
  {
    label: 'Workspace',
    caps: [
      { id: 'ws.view', name: 'View workspace' },
      { id: 'ws.settings', name: 'Edit workspace settings' },
      { id: 'ws.delete', name: 'Delete or transfer workspace' },
      { id: 'ws.audit', name: 'View audit log' }
    ]
  },
  {
    label: 'People',
    caps: [
      { id: 'people.invite', name: 'Invite members' },
      { id: 'people.role', name: 'Change member roles' },
      { id: 'people.remove', name: 'Remove members' },
      { id: 'people.teams', name: 'Create & edit teams' }
    ]
  },
  {
    label: 'Content',
    caps: [
      { id: 'proj.create', name: 'Create projects' },
      { id: 'proj.edit', name: 'Edit projects & diagrams' },
      { id: 'proj.delete', name: 'Delete projects' },
      { id: 'content.view', name: 'View entity & workspace content' },
      { id: 'content.edit', name: 'Edit entity & workspace content' },
      { id: 'ent.edit', name: 'Edit entities' },
      { id: 'ws.manage_views', name: 'Manage views' },
      { id: 'ent.propose', name: 'Propose entity changes' },
      { id: 'ent.approve', name: 'Approve entity changes' },
      { id: 'ent.override', name: 'Bypass entity approval' },
      { id: 'comments', name: 'Comment & discuss' },
      { id: 'export', name: 'Export schema / CSV' }
    ]
  },
  {
    label: 'Schema',
    caps: [
      { id: 'schema.edit', name: 'Edit data model' },
      { id: 'schema.publish', name: 'Publish breaking changes' }
    ]
  }
];

/**
 * Extracts global permissions from a set of global roles
 */
export const getGlobalPermissionsForRoles = (
  roles: Iterable<GlobalRole>
): Set<GlobalPermission> => {
  const permissions = new Set<GlobalPermission>();
  for (const role of roles) {
    for (const permission of GLOBAL_ROLE_PERMISSIONS[role]) {
      permissions.add(permission);
    }
  }
  return permissions;
};

export const getBuiltinWorkspaceRole = (roleId: WorkspaceRole): WorkspaceRoleDefinition | null =>
  BUILTIN_WORKSPACE_ROLES.find(role => role.id === roleId) ?? null;

export const resolveWorkspaceRoleDefinitions = (
  customRoles: WorkspaceRoleDefinition[] = []
): WorkspaceRoleDefinition[] => {
  const roles = [...BUILTIN_WORKSPACE_ROLES];
  const reservedIds = new Set(BUILTIN_WORKSPACE_ROLES.map(role => role.id));

  for (const role of customRoles) {
    if (reservedIds.has(role.id)) continue;
    roles.push({
      ...role,
      builtin: false
    });
  }

  return roles;
};

/**
 * Check if a workspace role has a specific capability
 */
export const workspaceRoleHasCapability = (
  role: WorkspaceRole,
  capability: WorkspaceCapability,
  roles: Iterable<WorkspaceRoleDefinition> = BUILTIN_WORKSPACE_ROLES
): boolean =>
  Array.from(roles)
    .find(roleDefinition => roleDefinition.id === role)
    ?.capabilities.includes(capability) ?? false;
