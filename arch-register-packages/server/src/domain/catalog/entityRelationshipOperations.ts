import type { DatabaseAdapter } from '../../db/database';
import type { AuthorizationContext } from '@arch-register/permissions';
import { PermissionChecker } from '@arch-register/permissions';

import { httpAssert } from '../../utils/httpAssert';

import { requireEntityAction } from '../auth/authorization';

import { handleError, buildEntityRelations, buildEntityDependents } from './dataHelpers';

import { EntityDependents, EntityRelations } from '@arch-register/api-types/entityContract';

import { listAllCatalogEntities } from './entityLoader';

const checker = new PermissionChecker();

export const getEntityRelations = async (
  db: DatabaseAdapter,
  workspace: string,
  id: string,
  authCtx: AuthorizationContext | null
): Promise<EntityRelations> => {
  try {
    const [entity, schemas, entitiesRaw] = await Promise.all([
      db.catalog.getEntity(workspace, id),
      db.catalog.listSchemas(workspace),
      listAllCatalogEntities(db, workspace)
    ]);
    httpAssert.present(entity, { status: 404, message: `Data record '${id}' not found` });
    if (authCtx)
      requireEntityAction(
        authCtx,
        entity,
        'view_entity',
        'You do not have access to view this entity'
      );
    const entities = authCtx
      ? entitiesRaw.filter(row => checker.hasEntityPermission(authCtx, row, 'view_entity'))
      : entitiesRaw;
    return buildEntityRelations(entity, schemas, entities);
  } catch (error) {
    return handleError(error, 'Failed to retrieve data relations');
  }
};

export const getBatchEntityRelations = async (
  db: DatabaseAdapter,
  workspace: string,
  ids: string[],
  authCtx: AuthorizationContext | null
): Promise<Record<string, EntityRelations>> => {
  try {
    const [schemas, entitiesRaw] = await Promise.all([
      db.catalog.listSchemas(workspace),
      listAllCatalogEntities(db, workspace)
    ]);
    const entities = authCtx
      ? entitiesRaw.filter(row => checker.hasEntityPermission(authCtx, row, 'view_entity'))
      : entitiesRaw;
    const entityLookup = new Map(entities.map(e => [e.id, e]));
    const result: Record<string, EntityRelations> = {};
    for (const id of ids) {
      const entity = entityLookup.get(id);
      if (!entity) continue;
      result[id] = buildEntityRelations(entity, schemas, entities);
    }
    return result;
  } catch (error) {
    return handleError(error, 'Failed to retrieve batch entity relations');
  }
};

export const getEntityDependents = async (
  db: DatabaseAdapter,
  workspace: string,
  id: string,
  options: { transitive: boolean; maxDepth?: number },
  authCtx: AuthorizationContext | null
): Promise<EntityDependents> => {
  try {
    const [entity, schemas, entitiesRaw] = await Promise.all([
      db.catalog.getEntity(workspace, id),
      db.catalog.listSchemas(workspace),
      listAllCatalogEntities(db, workspace)
    ]);
    httpAssert.present(entity, { status: 404, message: `Data record '${id}' not found` });
    if (authCtx)
      requireEntityAction(
        authCtx,
        entity,
        'view_entity',
        'You do not have access to view this entity'
      );
    const entities = authCtx
      ? entitiesRaw.filter(row => checker.hasEntityPermission(authCtx, row, 'view_entity'))
      : entitiesRaw;
    return buildEntityDependents(entity.id, entities, schemas, options);
  } catch (error) {
    return handleError(error, 'Failed to retrieve entity dependents');
  }
};
