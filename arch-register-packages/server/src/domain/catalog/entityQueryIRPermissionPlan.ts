import type { EntityQuery } from '@arch-register/api-types/entityQueryIR';
import type { WorkspaceAuthorizationContext } from '@arch-register/permissions';
import type { TypedRelationVisibilityPolicy } from './relationAccessControl';
import type { EntityViewPermissionScope } from './db/entityPermissionScope';

export type EntityQueryScopeOptions = {
  visibleEntityIds?: readonly string[];
  permissionScope?: EntityViewPermissionScope | null;
  collectionEntityIds?: readonly string[];
  relationVisibility?: TypedRelationVisibilityPolicy;
  limit?: number;
  offset?: number;
};

/**
 * Request-local scope information shared by row and count compilation. It contains no SQL and is
 * deliberately immutable so both output renderers consume the same authorization and temporal
 * decisions.
 */
export type EntityQueryPermissionPlan = {
  authCtx: WorkspaceAuthorizationContext | null;
  assessmentId: string | undefined;
  projectId: string | undefined;
  projectScope: 'project' | 'all';
  asOf: Date | null;
  includePlannedChanges: boolean;
  visibleEntityIds?: readonly string[];
  permissionScope?: EntityViewPermissionScope | null;
  collectionEntityIds?: readonly string[];
  relationVisibility?: TypedRelationVisibilityPolicy;
  limit?: number;
  offset?: number;
};

export const buildEntityQueryPermissionPlan = (
  query: EntityQuery,
  options: EntityQueryScopeOptions,
  authCtx: WorkspaceAuthorizationContext | null
): EntityQueryPermissionPlan => ({
  authCtx,
  assessmentId: query.assessmentId,
  projectId: query.projectId,
  projectScope: query.projectScope ?? 'all',
  asOf: query.asOf ? new Date(query.asOf) : null,
  includePlannedChanges: query.includePlannedChanges ?? true,
  visibleEntityIds: options.visibleEntityIds,
  permissionScope: options.permissionScope,
  collectionEntityIds: options.collectionEntityIds,
  relationVisibility: options.relationVisibility,
  limit: options.limit,
  offset: options.offset
});

export const requiresRecursiveEntityQueryWith = (
  plan: Pick<EntityQueryPermissionPlan, 'asOf' | 'permissionScope'>
): boolean =>
  plan.asOf != null ||
  (plan.permissionScope != null &&
    !plan.permissionScope.workspaceWide &&
    plan.permissionScope.scopedViewAllowed);
