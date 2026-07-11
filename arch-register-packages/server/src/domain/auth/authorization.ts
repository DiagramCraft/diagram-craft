import type { AuthenticatedEvent } from '../../middleware/auth';
import type { DatabaseAdapter } from '../../db/database';
import {
  type AuthorizationContext,
  buildAuthorizationContext,
  CapabilityEvaluator,
  type EntityAction,
  type Entity as PermissionEntity,
  fetchAuthorizationContextData,
  PermissionChecker,
  ProjectAction,
  type WorkspaceCapability
} from '@arch-register/permissions';
import { ServerDataProvider } from './ServerAuthorizationDataProvider';
import { httpAssert } from '../../utils/httpAssert';
import { Entity } from '../catalog/db/catalogDatabase';

export const GLOBAL_WS = '__global__';

// Singleton instances for performance
const checker = new PermissionChecker();
const capabilities = new CapabilityEvaluator();

type GlobalPermission = 'admin_platform' | 'create_workspaces' | 'manage_workspace_roles';

/**
 * Require a specific entity action, throw 403 if not allowed.
 *
 * This is an HTTP-specific helper that wraps PermissionChecker
 * and throws an appropriate HTTP error.
 */
export const requireEntityAction = (
  context: AuthorizationContext,
  entity: Entity,
  action: EntityAction,
  message?: string
) => {
  httpAssert.true(checker.hasEntityPermission(context, entity, action), {
    status: 403,
    statusText: 'Forbidden',
    message: message ?? 'Insufficient entity permissions'
  });
};

/**
 * Require a global permission, throw 403 if not allowed.
 *
 * This is an HTTP-specific helper that wraps PermissionChecker
 * and throws an appropriate HTTP error.
 */
export const requireGlobalPermission = (
  context: AuthorizationContext,
  permission: GlobalPermission,
  message?: string
) => {
  httpAssert.true(checker.hasGlobalPermission(context, permission), {
    status: 403,
    statusText: 'Forbidden',
    message: message ?? 'Insufficient permissions'
  });
};

/**
 * Require a workspace capability, throw 403 if not allowed.
 *
 * Checks workspace role capabilities. global_admin users implicitly
 * have all workspace capabilities.
 */
export const requireWorkspaceCapability = (
  context: AuthorizationContext,
  capability: WorkspaceCapability,
  message?: string
) => {
  httpAssert.true(checker.hasWorkspaceCapability(context, capability), {
    status: 403,
    statusText: 'Forbidden',
    message: message ?? 'Insufficient workspace permissions'
  });
};

export const requireSchemaRead = (context: AuthorizationContext, message?: string) => {
  requireWorkspaceCapability(
    context,
    'ws.view',
    message ?? 'You do not have permission to view schemas in this workspace'
  );
};

export const filterVisibleEntities = <T extends PermissionEntity>(
  context: AuthorizationContext,
  entities: T[]
): T[] => entities.filter(entity => checker.hasEntityPermission(context, entity, 'view_entity'));

/**
 * Require project action permission, throw 403 if not allowed.
 * 

/**
 * Require workspace admin role, throw 403 if not allowed.
 * 
 * Checks if user has workspace admin role or global admin permission.
 */
export const requireWorkspaceAdmin = (context: AuthorizationContext, message?: string) => {
  const isWorkspaceAdmin = checker.hasWorkspaceCapability(context, 'people.role');
  const isGlobalAdmin = checker.hasGlobalPermission(context, 'admin_platform');

  httpAssert.true(isWorkspaceAdmin || isGlobalAdmin, {
    status: 403,
    statusText: 'Forbidden',
    message: message ?? 'Workspace admin permission required'
  });
};

/**
 * Require project action permission, throw 403 if not allowed.
 *
 * This is an HTTP-specific helper that wraps PermissionChecker
 * and throws an appropriate HTTP error.
 */
export const requireProjectAction = (
  context: AuthorizationContext,
  ownerTeamId: string | null,
  action: ProjectAction,
  message?: string
) => {
  httpAssert.true(checker.hasProjectPermission(context, ownerTeamId, action), {
    status: 403,
    statusText: 'Forbidden',
    message: message ?? 'Insufficient project permissions'
  });
};

export const canAccessProject = (context: AuthorizationContext, ownerTeamId: string | null) =>
  checker.hasProjectPermission(context, ownerTeamId, 'edit_project');

export const requireProjectAccess = (
  context: AuthorizationContext,
  ownerTeamId: string | null,
  message?: string
) => {
  httpAssert.true(canAccessProject(context, ownerTeamId), {
    status: 403,
    statusText: 'Forbidden',
    message: message ?? 'You do not have permission to view this project'
  });
};

/**
 * Require project creation capability for specific owner, throw 403 if not allowed.
 *
 * This is an HTTP-specific helper that wraps CapabilityEvaluator
 * and throws an appropriate HTTP error.
 */
export const requireCanCreateProject = (
  context: AuthorizationContext,
  ownerTeamId: string | null,
  message?: string
) => {
  httpAssert.true(capabilities.canCreateProject(context, ownerTeamId), {
    status: 403,
    statusText: 'Forbidden',
    message: message ?? 'You do not have permission to create a project for this owner team'
  });
};

/**
 * Require top-level entity creation capability for specific owner, throw 403 if not allowed.
 *
 * This is an HTTP-specific helper that wraps CapabilityEvaluator
 * and throws an appropriate HTTP error.
 */
export const requireCanCreateTopLevelEntity = (
  context: AuthorizationContext,
  ownerTeamId: string | null,
  message?: string
) => {
  httpAssert.true(capabilities.canCreateTopLevelEntity(context, ownerTeamId), {
    status: 403,
    statusText: 'Forbidden',
    message:
      message ?? 'You do not have permission to create a top-level entity for this owner team'
  });
};

/**
 * Build authorization context for an authenticated event.
 *
 * This fetches all necessary permission data from the database
 * and constructs an AuthorizationContext that can be used with
 * PermissionChecker and CapabilityEvaluator.
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

  const cache = (event.context.authorizationContextCache ??= new Map<
    string,
    Promise<AuthorizationContext>
  >());
  const cached = cache.get(workspace);
  if (cached) return cached;

  const contextPromise = (async () => {
    const dataProvider = new ServerDataProvider(db);

    if (workspace === GLOBAL_WS) {
      const globalRoles = await dataProvider.getGlobalRoles(userId);
      return buildAuthorizationContext({
        userId,
        globalRoles,
        workspaceRole: null,
        schemas: [],
        entities: [],
        grants: []
      });
    }

    const contextData = await fetchAuthorizationContextData(dataProvider, workspace, userId);
    return buildAuthorizationContext(contextData);
  })();

  cache.set(workspace, contextPromise);

  try {
    return await contextPromise;
  } catch (error) {
    if (cache.get(workspace) === contextPromise) cache.delete(workspace);
    throw error;
  }
};
