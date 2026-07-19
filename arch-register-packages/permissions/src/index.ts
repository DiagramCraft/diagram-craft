// Export all types
export type {
  GlobalRole,
  GlobalPermission,
  BuiltinWorkspaceRole,
  WorkspaceRole,
  WorkspaceRoleDefinition,
  TeamRole,
  WorkspaceCapability,
  TeamAssignment,
  WorkspaceMember,
  EntityRole,
  EntityAction,
  ProjectAction,
  EntityGrantScope,
  EntitySchema,
  Entity,
  EntityGrant,
  WorkspaceTeam,
  WorkspaceAuthorizationContext,
  AuthorizationContext
} from './types.js';

// Export utility functions
// biome-ignore lint/performance/noBarrelFile: This is a package entry point that needs to export its public API
export { encodeRefs, decodeRefs } from './utils.js';

// Export constants and helper functions
export {
  ROLE_ACTIONS,
  GLOBAL_ROLES,
  GLOBAL_ROLE_PERMISSIONS,
  TEAM_ROLE_PERMISSIONS,
  BUILTIN_WORKSPACE_ROLES,
  WORKSPACE_ROLE_CAPABILITIES,
  WORKSPACE_ROLES,
  WORKSPACE_CAPABILITY_GROUPS,
  getGlobalPermissionsForRoles,
  getBuiltinWorkspaceRole,
  resolveWorkspaceRoleDefinitions,
  workspaceRoleHasCapability
} from './constants.js';

// Export authorization context builder helpers
export {
  buildAuthorizationContext,
  buildWorkspaceAuthorizationContext,
  fetchAuthorizationContextData,
  type AuthorizationContextData,
  type WorkspaceAuthorizationContextData,
  type PermissionDataProvider
} from './AuthorizationContextBuilder.js';

// Export permission checker and capability evaluator
export { PermissionChecker } from './PermissionChecker.js';
export { CapabilityEvaluator } from './CapabilityEvaluator.js';

