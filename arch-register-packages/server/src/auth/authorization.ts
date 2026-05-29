import type { AuthenticatedEvent } from '../middleware/auth.js';
import type { DatabaseAdapter } from '../db/database.js';
import { type Entity, type GlobalPermission } from '../types.js';
import {
  buildAuthorizationContext,
  fetchAuthorizationContextData,
  type AuthorizationContext,
  type EntityAction,
  PermissionEvaluator,
  ProjectAction
} from '@arch-register/permissions';
import { ServerDataProvider } from './ServerAuthorizationDataProvider.js';
import { httpAssert } from '../utils/httpAssert';

export const GLOBAL_WS = '__global__';

/**
 * Require a specific entity action, throw 403 if not allowed
 */
export const requireEntityAction = (
  context: AuthorizationContext,
  entity: Entity,
  action: EntityAction,
  message?: string
) => {
  const evaluator = new PermissionEvaluator();
  httpAssert.true(evaluator.hasEntityPermission(context, entity, action), {
    status: 403,
    statusText: 'Forbidden',
    message: message ?? 'Insufficient entity permissions'
  });
};

/**
 * Require a global permission, throw 403 if not allowed
 */
export const requireGlobalPermission = (
  context: AuthorizationContext,
  permission: GlobalPermission,
  message?: string
) => {
  const evaluator = new PermissionEvaluator();
  httpAssert.true(evaluator.hasGlobalPermission(context, permission), {
    status: 403,
    statusText: 'Forbidden',
    message: message ?? 'Insufficient permissions'
  });
};

/**
 * Require project edit permission, throw 403 if not allowed
 */
export const requireProjectAction = (
  context: AuthorizationContext,
  ownerTeamId: string | null,
  action: ProjectAction,
  message?: string
) => {
  const evaluator = new PermissionEvaluator();
  httpAssert.true(evaluator.hasProjectPermission(context, ownerTeamId, action), {
    status: 403,
    statusText: 'Forbidden',
    message: message ?? 'Insufficient project permissions'
  });
};

/**
 * Check if user can create a project with a specific owner
 */
export const canCreateProject = (
  context: AuthorizationContext,
  ownerTeamId: string | null
): boolean => {
  const evaluator = new PermissionEvaluator();
  return evaluator.canCreateProject(context, ownerTeamId);
};

/**
 * Check if user can create a top-level entity with a specific owner
 */
export const canCreateTopLevelEntity = (
  context: AuthorizationContext,
  ownerTeamId: string | null
): boolean => {
  const evaluator = new PermissionEvaluator();
  return evaluator.canCreateTopLevelEntity(context, ownerTeamId);
};

/**
 * Require project creation permission for specific owner, throw 403 if not allowed
 */
export const requireCanCreateProject = (
  context: AuthorizationContext,
  ownerTeamId: string | null,
  message?: string
) => {
  httpAssert.true(canCreateProject(context, ownerTeamId), {
    status: 403,
    statusText: 'Forbidden',
    message: message ?? 'You do not have permission to create a project for this owner team'
  });
};

/**
 * Build authorization context for an authenticated event
 */
export const buildApiAuthCtx = async (
  db: DatabaseAdapter,
  workspace: string,
  event: AuthenticatedEvent
): Promise<AuthorizationContext> => {
  const userId = event.context.user?.id;
  httpAssert.present(userId, {
    status: 401,
    statusText: 'Unauthorized',
    message: 'Authentication required'
  });

  const dataProvider = new ServerDataProvider(db);
  const contextData = await fetchAuthorizationContextData(dataProvider, workspace, userId);
  return buildAuthorizationContext(contextData);
};