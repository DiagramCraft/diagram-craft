import type { AuthenticatedEvent } from '../../middleware/auth';
import type { DatabaseAdapter } from '../../db/database';
import {
  type AuthorizationContext,
  buildEntityAuthorizationContext,
  buildWorkspaceAuthorizationContext,
  CapabilityEvaluator,
  type EntityAction,
  type Entity as PermissionEntity,
  fetchEntityAuthorizationContextData,
  fetchWorkspaceAuthorizationContextData,
  PermissionChecker,
  ProjectAction,
  type WorkspaceAuthorizationContext,
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
  context: WorkspaceAuthorizationContext,
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
  context: WorkspaceAuthorizationContext,
  capability: WorkspaceCapability,
  message?: string
) => {
  httpAssert.true(checker.hasWorkspaceCapability(context, capability), {
    status: 403,
    statusText: 'Forbidden',
    message: message ?? 'Insufficient workspace permissions'
  });
};

export const requireSchemaRead = (context: WorkspaceAuthorizationContext, message?: string) => {
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
export const requireWorkspaceAdmin = (context: WorkspaceAuthorizationContext, message?: string) => {
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
  context: WorkspaceAuthorizationContext,
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

export const canAccessProject = (
  context: WorkspaceAuthorizationContext,
  ownerTeamId: string | null
) => checker.hasProjectPermission(context, ownerTeamId, 'edit_project');

export const canAccessNonProjectContent = (
  context: WorkspaceAuthorizationContext,
  action: 'read' | 'edit'
) => checker.hasWorkspaceCapability(context, action === 'read' ? 'content.view' : 'content.edit');

export const requireProjectAccess = (
  context: WorkspaceAuthorizationContext,
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
  context: WorkspaceAuthorizationContext,
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
  context: WorkspaceAuthorizationContext,
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
 * Build workspace-level authorization context for an authenticated event.
 *
 * Entity schemas, entities, and grants are loaded only by buildApiEntityAuthCtx.
 */
export const buildApiAuthCtx = async (
  db: DatabaseAdapter,
  workspace: string,
  event: AuthenticatedEvent
): Promise<WorkspaceAuthorizationContext> => {
  const userId = event.context.user?.id;
  httpAssert.present(userId, {
    status: 401,
    statusText: 'Unauthorized',
    message: 'Authentication required'
  });

  const apiToken = event.context.apiToken;
  if (apiToken) {
    httpAssert.true(workspace !== GLOBAL_WS, {
      status: 403,
      statusText: 'Forbidden',
      message: 'API tokens cannot access global operations'
    });
    httpAssert.true(apiToken.workspace === workspace, {
      status: 403,
      statusText: 'Forbidden',
      message: 'API token is not valid for this workspace'
    });
  }

  const cache = (event.context.authorizationContextCache ??= new Map());
  const cached = cache.get(workspace);
  if (cached) return cached;

  const contextPromise = (async () => {
    const dataProvider = new ServerDataProvider(db);

    if (workspace === GLOBAL_WS) {
      const globalRoles = await dataProvider.getGlobalRoles(userId);
      return buildWorkspaceAuthorizationContext({
        userId,
        globalRoles,
        workspaceRole: null
      });
    }

    const contextData = await fetchWorkspaceAuthorizationContextData(
      dataProvider,
      workspace,
      userId
    );
    if (apiToken) {
      return buildWorkspaceAuthorizationContext({
        ...contextData,
        // API tokens are workspace-scoped and the ceiling limits every
        // permission source, including workspace roles, team roles, and grants.
        workspaceCapabilityCeiling: apiToken.capabilities
      });
    }
    return buildWorkspaceAuthorizationContext(contextData);
  })();

  cache.set(workspace, contextPromise);

  try {
    return await contextPromise;
  } catch (error) {
    if (cache.get(workspace) === contextPromise) cache.delete(workspace);
    throw error;
  }
};

/**
 * Build a full authorization context for an authenticated event.
 *
 * This upgrades the request's workspace context with schemas, entities, and
 * grants for operations that perform entity-scoped permission checks.
 */
export const buildApiEntityAuthCtx = async (
  db: DatabaseAdapter,
  workspace: string,
  event: AuthenticatedEvent
): Promise<AuthorizationContext> => {
  const cache = (event.context.entityAuthorizationContextCache ??= new Map());
  const cached = cache.get(workspace);
  if (cached) return cached;

  const contextPromise = (async () => {
    const workspaceContext = await buildApiAuthCtx(db, workspace, event);
    if (workspace === GLOBAL_WS) {
      return buildEntityAuthorizationContext(workspaceContext, {
        schemas: [],
        entities: [],
        grants: []
      });
    }

    const entityData = await fetchEntityAuthorizationContextData(
      new ServerDataProvider(db),
      workspace
    );
    return buildEntityAuthorizationContext(workspaceContext, entityData);
  })();

  cache.set(workspace, contextPromise);

  try {
    return await contextPromise;
  } catch (error) {
    if (cache.get(workspace) === contextPromise) cache.delete(workspace);
    throw error;
  }
};
