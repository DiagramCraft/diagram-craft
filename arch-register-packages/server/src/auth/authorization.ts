import { HTTPError } from 'h3';
import type { AuthenticatedEvent } from '../middleware/auth.js';
import type { DatabaseAdapter } from '../db/database.js';
import { type Entity, type GlobalPermission } from '../types.js';
import {
  type AuthorizationContext,
  type EntityAction,
  ProjectAction
} from '@arch-register/permissions';
import { ServerDataProvider, ServerPermissionEvaluator } from './ServerPermissionEvaluator.js';
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
  const evaluator = new ServerPermissionEvaluator();
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
  const evaluator = new ServerPermissionEvaluator();
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
  const evaluator = new ServerPermissionEvaluator();
  if (!evaluator.hasProjectPermission(context, ownerTeamId, action)) {
    throw new HTTPError({
      status: 403,
      statusText: 'Forbidden',
      message: message ?? 'Insufficient project permissions'
    });
  }
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

  const evaluator = new ServerPermissionEvaluator();
  const dataProvider = new ServerDataProvider(db);
  return evaluator.buildContext(workspace, userId, dataProvider);
};
