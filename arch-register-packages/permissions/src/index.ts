// Export all types
export type {
  GlobalRole,
  GlobalPermission,
  WorkspaceRole,
  WorkspaceCapability,
  WorkspaceMember,
  EntityRole,
  EntityAction,
  ProjectAction,
  EntityGrantScope,
  VisibilityMode,
  EntityCapabilities,
  ProjectCapabilities,
  EntityLink,
  TextField,
  BooleanField,
  SelectField,
  ReferenceField,
  ContainmentField,
  SchemaField,
  EntitySchema,
  Entity,
  EntityGrant,
  WorkspaceOwnerOption,
  AuthorizationContext,
} from './types.js';

// Export utility functions
// biome-ignore lint/performance/noBarrelFile: This is a package entry point that needs to export its public API
export { encodeRefs, decodeRefs } from './utils.js';

// Export constants and helper functions
export {
  ROLE_ACTIONS,
  GLOBAL_ROLES,
  GLOBAL_ROLE_PERMISSIONS,
  WORKSPACE_ROLE_CAPABILITIES,
  WORKSPACE_ROLES,
  WORKSPACE_CAPABILITY_GROUPS,
  getGlobalPermissionsForRoles,
  workspaceRoleHasCapability,
} from './constants.js';

// Export authorization context builder helpers
export {
  buildAuthorizationContext,
  fetchAuthorizationContextData,
  type AuthorizationContextData,
  type PermissionDataProvider
} from './AuthorizationContextBuilder.js';

// Export permission checker and capability evaluator
export { PermissionChecker } from './PermissionChecker.js';
export { CapabilityEvaluator } from './CapabilityEvaluator.js';
