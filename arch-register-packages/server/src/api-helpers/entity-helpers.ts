import type { EntityRecord, EntitySummary } from '@arch-register/api-types';
import type { Entity } from '../types';
import type { AuthorizationContext } from '@arch-register/permissions';
import { PermissionChecker } from '@arch-register/permissions';

const checker = new PermissionChecker();

const getEntityCapabilities = (context: AuthorizationContext | null, entity: Entity) => {
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
  entity: Entity,
  authCtx: AuthorizationContext | null,
  completeness: number | null = null
): EntityRecord => ({
  _uid: entity.id,
  _workspace: entity.workspace,
  _schemaId: entity.schema_id,
  _name: entity.name,
  _slug: entity.slug,
  _namespace: entity.namespace,
  _description: entity.description,
  _owner: entity.owner,
  _lifecycle: entity.lifecycle,
  _tags: entity.tags,
  _links: entity.links,
  _visibilityMode: entity.visibility_mode,
  _completeness: completeness,
  ...getEntityCapabilities(authCtx, entity),
  ...entity.data
});

export const toApiEntitySummary = (
  entity: Entity,
  authCtx: AuthorizationContext | null,
  completeness: number | null = null
): EntitySummary => ({
  _uid: entity.id,
  _workspace: entity.workspace,
  _schemaId: entity.schema_id,
  _name: entity.name,
  _slug: entity.slug,
  _namespace: entity.namespace,
  _description: entity.description,
  _owner: entity.owner,
  _lifecycle: entity.lifecycle,
  _tags: entity.tags,
  _links: entity.links,
  _visibilityMode: entity.visibility_mode,
  _completeness: completeness,
  ...getEntityCapabilities(authCtx, entity)
});
