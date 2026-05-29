import type { EntityAction, EntityRole, GlobalPermission, GlobalRole, WorkspaceCapability, WorkspaceRole } from './types.js';

/**
 * Maps entity roles to the actions they can perform
 */
export const ROLE_ACTIONS: Record<EntityRole, EntityAction[]> = {
  viewer: ['view_entity'],
  editor: ['view_entity', 'edit_entity'],
  contributor: ['view_entity', 'edit_entity', 'create_child'],
  entity_admin: ['view_entity', 'edit_entity', 'create_child', 'admin_entity'],
};

/**
 * Maps global roles to their permissions.
 * global_admin gets everything; workspace_admin can create workspaces and manage roles.
 */
export const GLOBAL_ROLE_PERMISSIONS: Record<GlobalRole, GlobalPermission[]> = {
  global_admin: [
    'admin_platform',
    'create_workspaces',
    'manage_workspace_roles',
  ],
  workspace_admin: [
    'create_workspaces',
    'manage_workspace_roles',
  ],
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
    tone: 'var(--danger)',
  },
  {
    id: 'workspace_admin',
    name: 'Workspace admin',
    description: 'Can create workspaces and manage global workspace-role assignments.',
    tone: 'var(--accent)',
  },
];

/**
 * Maps workspace roles to capabilities within a workspace.
 */
export const WORKSPACE_ROLE_CAPABILITIES: Record<WorkspaceRole, WorkspaceCapability[]> = {
  owner: [
    'ws.view', 'ws.settings', 'ws.delete', 'ws.audit',
    'people.invite', 'people.role', 'people.remove', 'people.teams',
    'proj.create', 'proj.edit', 'ent.edit', 'ent.propose', 'comments', 'export',
    'schema.edit', 'schema.publish',
  ],
  admin: [
    'ws.view', 'ws.settings', 'ws.audit',
    'people.invite', 'people.role', 'people.remove', 'people.teams',
    'proj.create', 'proj.edit', 'ent.edit', 'ent.propose', 'comments', 'export',
    'schema.edit', 'schema.publish',
  ],
  editor: [
    'ws.view',
    'proj.create', 'proj.edit', 'ent.edit', 'ent.propose', 'comments', 'export',
  ],
  reviewer: [
    'ws.view',
    'ent.propose', 'comments', 'export',
  ],
  viewer: [
    'ws.view',
    'export',
  ],
};

/**
 * Metadata for workspace roles — used by the admin UI.
 */
export const WORKSPACE_ROLES: Array<{
  id: WorkspaceRole;
  name: string;
  description: string;
  tone: string;
  builtin: boolean;
}> = [
  {
    id: 'owner',
    name: 'Owner',
    description: 'Full access to everything, including billing and workspace deletion.',
    tone: 'var(--tag-system)',
    builtin: true,
  },
  {
    id: 'admin',
    name: 'Admin',
    description: 'Manage members, teams, integrations and the data model.',
    tone: 'var(--accent)',
    builtin: true,
  },
  {
    id: 'editor',
    name: 'Editor',
    description: 'Create and edit diagrams, entities and projects.',
    tone: 'var(--tag-component)',
    builtin: true,
  },
  {
    id: 'reviewer',
    name: 'Reviewer',
    description: 'Comment on diagrams and propose changes — read-only otherwise.',
    tone: 'var(--tag-api)',
    builtin: true,
  },
  {
    id: 'viewer',
    name: 'Viewer',
    description: 'Read-only access to all content in the workspace.',
    tone: 'var(--fg-3)',
    builtin: true,
  },
];

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
      { id: 'ws.audit', name: 'View audit log' },
    ],
  },
  {
    label: 'People',
    caps: [
      { id: 'people.invite', name: 'Invite members' },
      { id: 'people.role', name: 'Change member roles' },
      { id: 'people.remove', name: 'Remove members' },
      { id: 'people.teams', name: 'Create & edit teams' },
    ],
  },
  {
    label: 'Content',
    caps: [
      { id: 'proj.create', name: 'Create projects' },
      { id: 'proj.edit', name: 'Edit projects & diagrams' },
      { id: 'ent.edit', name: 'Edit entities' },
      { id: 'ent.propose', name: 'Propose entity changes' },
      { id: 'comments', name: 'Comment & discuss' },
      { id: 'export', name: 'Export schema / CSV' },
    ],
  },
  {
    label: 'Schema',
    caps: [
      { id: 'schema.edit', name: 'Edit data model' },
      { id: 'schema.publish', name: 'Publish breaking changes' },
    ],
  },
];

/**
 * Extracts global permissions from a set of global roles
 */
export const getGlobalPermissionsForRoles = (roles: Iterable<GlobalRole>): Set<GlobalPermission> => {
  const permissions = new Set<GlobalPermission>();
  for (const role of roles) {
    for (const permission of GLOBAL_ROLE_PERMISSIONS[role]) {
      permissions.add(permission);
    }
  }
  return permissions;
};

/**
 * Check if a workspace role has a specific capability
 */
export const workspaceRoleHasCapability = (
  role: WorkspaceRole,
  capability: WorkspaceCapability
): boolean => WORKSPACE_ROLE_CAPABILITIES[role].includes(capability);
