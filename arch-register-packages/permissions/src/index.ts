// Export all types
export type {
  GlobalRole,
  GlobalPermission,
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
export { encodeRefs, decodeRefs } from './types.js';

// Export constants and helper functions
export { ROLE_ACTIONS, GLOBAL_ROLE_PERMISSIONS, getGlobalPermissionsForRoles } from './constants.js';

// Export authorization context builder helpers
export {
  buildAuthorizationContext,
  fetchAuthorizationContextData,
  type AuthorizationContextData,
  type PermissionDataProvider
} from './AuthorizationContextBuilder.js';

// Export the abstract permission evaluator
export { PermissionEvaluator } from './PermissionEvaluator.js';
