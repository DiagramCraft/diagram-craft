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
  AuthorizationContext,
} from './types.js';

// Export utility functions
export { encodeRefs, decodeRefs } from './types.js';

// Export constants and helper functions
export { ROLE_ACTIONS, GLOBAL_ROLE_PERMISSIONS, getGlobalPermissionsForRoles } from './constants.js';

// Export the abstract permission evaluator and its data provider interface
export { PermissionEvaluator, type PermissionDataProvider } from './PermissionEvaluator.js';
