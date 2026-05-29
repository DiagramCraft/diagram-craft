import type { EntityAction, EntityRole, GlobalPermission, GlobalRole } from './types.js';

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
 * Maps global roles to their permissions and entity actions
 */
export const GLOBAL_ROLE_PERMISSIONS: Record<GlobalRole, Array<GlobalPermission | EntityAction>> = {
  platform_admin: [
    'view_schema',
    'edit_schema',
    'manage_users',
    'manage_teams',
    'manage_global_roles',
    'view_audit',
    'admin_platform',
    'view_entity',
    'edit_entity',
    'create_child',
    'admin_entity',
  ],
  schema_admin: ['view_schema', 'edit_schema'],
  user_admin: ['manage_users', 'manage_teams', 'manage_global_roles'],
  auditor: ['view_audit'],
};

/**
 * Extracts global permissions from a set of global roles
 */
export const getGlobalPermissionsForRoles = (roles: Iterable<GlobalRole>): Set<GlobalPermission> => {
  const permissions = new Set<GlobalPermission>();
  for (const role of roles) {
    for (const permission of GLOBAL_ROLE_PERMISSIONS[role]) {
      // Filter out entity actions, only keep global permissions
      if (
        permission === 'view_entity' ||
        permission === 'edit_entity' ||
        permission === 'create_child' ||
        permission === 'admin_entity'
      ) {
        continue;
      }
      permissions.add(permission);
    }
  }
  return permissions;
};
