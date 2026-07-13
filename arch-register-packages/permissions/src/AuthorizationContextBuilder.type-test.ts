import { buildWorkspaceAuthorizationContext } from './AuthorizationContextBuilder.js';
import { PermissionChecker } from './PermissionChecker.js';
import type { Entity } from './types.js';

const workspaceContext = buildWorkspaceAuthorizationContext({
  userId: 'user-1',
  globalRoles: [],
  workspaceRole: null
});
declare const entity: Entity;

// @ts-expect-error Entity checks require schemas, entities, and grants.
new PermissionChecker().hasEntityPermission(workspaceContext, entity, 'view_entity');
