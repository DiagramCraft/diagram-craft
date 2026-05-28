import { HTTPError } from 'h3';
import type { AuthenticatedEvent } from '../middleware/auth.js';
import type { DatabaseAdapter } from '../db/database.js';
import { decodeRefs, type Entity, type EntityGrant, type EntityRole, type EntitySchema, type GlobalRole, type VisibilityMode } from '../types.js';

type EntityAction = 'view_entity' | 'edit_entity' | 'create_child' | 'admin_entity';
type GlobalPermission =
  | 'view_schema'
  | 'edit_schema'
  | 'manage_users'
  | 'manage_teams'
  | 'manage_global_roles'
  | 'view_audit'
  | 'admin_platform';

export type AuthorizationContext = {
  userId: string;
  globalRoles: Set<GlobalRole>;
  globalPermissions: Set<GlobalPermission>;
  teamIds: Set<string>;
  schemas: Map<string, EntitySchema>;
  entities: Map<string, Entity>;
  grants: EntityGrant[];
};

const ROLE_ACTIONS: Record<EntityRole, EntityAction[]> = {
  viewer: ['view_entity'],
  editor: ['view_entity', 'edit_entity'],
  contributor: ['view_entity', 'edit_entity', 'create_child'],
  entity_admin: ['view_entity', 'edit_entity', 'create_child', 'admin_entity'],
};

const GLOBAL_ROLE_PERMISSIONS: Record<GlobalRole, Array<GlobalPermission | EntityAction>> = {
  platform_admin: ['view_schema', 'edit_schema', 'manage_users', 'manage_teams', 'manage_global_roles', 'view_audit', 'admin_platform', 'view_entity', 'edit_entity', 'create_child', 'admin_entity'],
  schema_admin: ['view_schema', 'edit_schema'],
  user_admin: ['manage_users', 'manage_teams', 'manage_global_roles'],
  auditor: ['view_audit'],
};

const isAuthDisabled = () => process.env['AUTH_DISABLED'] === 'true';

const getParentIds = (entity: Entity, schema: EntitySchema | undefined): string[] => {
  if (!schema) return [];
  return schema.fields
    .filter((field): field is Extract<EntitySchema['fields'][number], { type: 'containment' }> => field.type === 'containment')
    .flatMap(field => decodeRefs(entity.data[field.id]));
};

const hasApplicableGrant = (grant: EntityGrant, targetEntityId: string, ancestorIds: Set<string>) =>
  grant.entity_id === targetEntityId || (grant.applies_to === 'subtree' && ancestorIds.has(grant.entity_id));

export const buildAuthorizationContext = async (db: DatabaseAdapter, workspace: string, userId: string): Promise<AuthorizationContext> => {
  const [roleAssignments, memberships, schemas, entities, grants] = await Promise.all([
    db.listGlobalRoleAssignments(userId),
    db.listTeamMemberships(workspace),
    db.listSchemas(workspace),
    db.listEntities(workspace),
    db.listEntityGrants(workspace),
  ]);

  const globalRoles = new Set(roleAssignments.map(assignment => assignment.role));
  const globalPermissions = new Set<GlobalPermission>();
  for (const role of globalRoles) {
    for (const permission of GLOBAL_ROLE_PERMISSIONS[role]) {
      if (permission === 'view_entity' || permission === 'edit_entity' || permission === 'create_child' || permission === 'admin_entity') {
        continue;
      }
      globalPermissions.add(permission);
    }
  }

  return {
    userId,
    globalRoles,
    globalPermissions,
    teamIds: new Set(memberships.filter(membership => membership.user_id === userId).map(membership => membership.team_id)),
    schemas: new Map(schemas.map(schema => [schema.id, schema])),
    entities: new Map(entities.map(entity => [entity.id, entity])),
    grants,
  };
};

const collectAncestorIds = (context: AuthorizationContext, entity: Entity): Set<string> => {
  const ancestorIds = new Set<string>();
  const queue = [...getParentIds(entity, context.schemas.get(entity.schema_id))];
  while (queue.length > 0) {
    const currentId = queue.shift()!;
    if (ancestorIds.has(currentId)) continue;
    ancestorIds.add(currentId);
    const current = context.entities.get(currentId);
    if (!current) continue;
    queue.push(...getParentIds(current, context.schemas.get(current.schema_id)));
  }
  return ancestorIds;
};

export const resolveEntityVisibility = (context: AuthorizationContext, entity: Entity): VisibilityMode => {
  if (entity.visibility_mode) return entity.visibility_mode;
  const queue = [...getParentIds(entity, context.schemas.get(entity.schema_id))];
  const visited = new Set<string>();
  while (queue.length > 0) {
    const currentId = queue.shift()!;
    if (visited.has(currentId)) continue;
    visited.add(currentId);
    const current = context.entities.get(currentId);
    if (!current) continue;
    if (current.visibility_mode) return current.visibility_mode;
    queue.push(...getParentIds(current, context.schemas.get(current.schema_id)));
  }
  return 'public';
};

export const getEntityActions = (context: AuthorizationContext, entity: Entity): Set<EntityAction> => {
  const actions = new Set<EntityAction>();
  for (const role of context.globalRoles) {
    for (const permission of GLOBAL_ROLE_PERMISSIONS[role]) {
      if (permission === 'view_entity' || permission === 'edit_entity' || permission === 'create_child' || permission === 'admin_entity') {
        actions.add(permission);
      }
    }
  }

  if (resolveEntityVisibility(context, entity) === 'public') {
    actions.add('view_entity');
  }

  if (entity.owner && context.teamIds.has(entity.owner)) {
    ROLE_ACTIONS['entity_admin'].forEach(action => actions.add(action));
  }

  const ancestorIds = collectAncestorIds(context, entity);
  for (const grant of context.grants) {
    const principalMatches =
      (grant.principal_type === 'user' && grant.principal_id === context.userId) ||
      (grant.principal_type === 'team' && context.teamIds.has(grant.principal_id));
    if (!principalMatches) continue;
    if (!hasApplicableGrant(grant, entity.id, ancestorIds)) continue;
    ROLE_ACTIONS[grant.role].forEach(action => actions.add(action));
  }

  return actions;
};

export const canReadEntity = (context: AuthorizationContext, entity: Entity) => getEntityActions(context, entity).has('view_entity');

export const requireEntityAction = (context: AuthorizationContext, entity: Entity, action: EntityAction, message?: string) => {
  if (!getEntityActions(context, entity).has(action)) {
    throw new HTTPError({ status: 403, statusText: 'Forbidden', message: message ?? 'Insufficient entity permissions' });
  }
};

export const requireGlobalPermission = (context: AuthorizationContext, permission: GlobalPermission, message?: string) => {
  if (isAuthDisabled()) return;
  if (!context.globalPermissions.has(permission) && !context.globalPermissions.has('admin_platform')) {
    throw new HTTPError({ status: 403, statusText: 'Forbidden', message: message ?? 'Insufficient permissions' });
  }
};

export const getRequestUserId = (event: AuthenticatedEvent): string => {
  const userId = event.context.user?.id;
  if (!userId) {
    throw new HTTPError({ status: 401, statusText: 'Unauthorized', message: 'Authentication required' });
  }
  return userId;
};

export const buildAuthorizationContextForEvent = async (
  db: DatabaseAdapter,
  workspace: string,
  event: AuthenticatedEvent,
): Promise<AuthorizationContext | null> => {
  if (isAuthDisabled()) return null;
  return buildAuthorizationContext(db, workspace, getRequestUserId(event));
};

export const resolveCreateOwner = (
  explicitOwner: string | null,
  parentEntities: Entity[],
  schema: EntitySchema,
  ownerValues: Set<string>,
  fallbackOwner: string | null,
) => {
  if (explicitOwner && ownerValues.has(explicitOwner)) return explicitOwner;
  const inheritedOwner = parentEntities.find(parent => parent.owner && ownerValues.has(parent.owner))?.owner ?? null;
  if (inheritedOwner) return inheritedOwner;
  if (schema.default_owner && ownerValues.has(schema.default_owner)) return schema.default_owner;
  if (fallbackOwner && ownerValues.has(fallbackOwner)) return fallbackOwner;
  return null;
};

export const getEntityParentsFromPayload = (
  schema: EntitySchema,
  payload: Record<string, unknown>,
  entityLookup: Map<string, Entity>,
) => {
  const parentIds = schema.fields
    .filter((field): field is Extract<EntitySchema['fields'][number], { type: 'containment' }> => field.type === 'containment')
    .flatMap(field => decodeRefs(payload[field.id]));
  return parentIds.map(parentId => entityLookup.get(parentId)).filter((entity): entity is Entity => entity != null);
};
