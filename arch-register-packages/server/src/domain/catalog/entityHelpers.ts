import type { EntityDbResult } from './db/catalogDatabase';
import type { AuthorizationContext } from '@arch-register/permissions';
import { PermissionChecker } from '@arch-register/permissions';
import { EntityRecord, EntitySummary } from '@arch-register/api-types/entityContract';

const checker = new PermissionChecker();

const getEntityCapabilities = (context: AuthorizationContext | null, entity: EntityDbResult) => {
  if (!context) {
    return {
      canView: true,
      canEdit: true,
      canDelete: true,
      canAdmin: true,
      canCreateChild: true
    };
  }

  return {
    canView: checker.hasEntityPermission(context, entity, 'view_entity'),
    canEdit: checker.hasEntityPermission(context, entity, 'edit_entity'),
    canDelete: checker.hasEntityPermission(context, entity, 'admin_entity'),
    canAdmin: checker.hasEntityPermission(context, entity, 'admin_entity'),
    canCreateChild: checker.hasEntityPermission(context, entity, 'create_child')
  };
};

export const toApiEntity = (
  entity: EntityDbResult,
  authCtx: AuthorizationContext | null,
  completeness: number | null = null
): EntityRecord => ({
  _uid: entity.id,
  _publicId: entity.public_id ?? entity.id,
  _schema: { id: entity.schema_id, name: entity.schema_name },
  _name: entity.name,
  _slug: entity.slug,
  _namespace: entity.namespace,
  _description: entity.description,
  _owner: entity.owner ? { id: entity.owner, name: entity.owner_name ?? entity.owner } : null,
  _lifecycle: entity.lifecycle
    ? { id: entity.lifecycle, name: entity.lifecycle_label ?? entity.lifecycle }
    : null,
  _targetLifecycle: entity.target_lifecycle
    ? {
        id: entity.target_lifecycle,
        name: entity.target_lifecycle_label ?? entity.target_lifecycle
      }
    : null,
  _targetLifecycleDate: entity.target_lifecycle_date,
  _tags: entity.tags,
  _links: entity.links,
  _updatedAt: entity.updated_at.toISOString(),
  _version: entity.version ?? 1,
  _approvalPolicyOverride: entity.approval_policy_override ?? null,
  _visibilityMode: entity.visibility_mode,
  _completeness: completeness,
  ...getEntityCapabilities(authCtx, entity),
  ...entity.data
});

export const toApiEntitySummary = (
  entity: EntityDbResult,
  authCtx: AuthorizationContext | null,
  completeness: number | null = null
): EntitySummary => ({
  _uid: entity.id,
  _publicId: entity.public_id ?? entity.id,
  _schema: { id: entity.schema_id, name: entity.schema_name },
  _name: entity.name,
  _slug: entity.slug,
  _namespace: entity.namespace,
  _description: entity.description,
  _owner: entity.owner ? { id: entity.owner, name: entity.owner_name ?? entity.owner } : null,
  _lifecycle: entity.lifecycle
    ? { id: entity.lifecycle, name: entity.lifecycle_label ?? entity.lifecycle }
    : null,
  _targetLifecycle: entity.target_lifecycle
    ? {
        id: entity.target_lifecycle,
        name: entity.target_lifecycle_label ?? entity.target_lifecycle
      }
    : null,
  _targetLifecycleDate: entity.target_lifecycle_date,
  _tags: entity.tags,
  _links: entity.links,
  _updatedAt: entity.updated_at.toISOString(),
  _version: entity.version ?? 1,
  _approvalPolicyOverride: entity.approval_policy_override ?? null,
  _visibilityMode: entity.visibility_mode,
  _completeness: completeness,
  ...getEntityCapabilities(authCtx, entity)
});
