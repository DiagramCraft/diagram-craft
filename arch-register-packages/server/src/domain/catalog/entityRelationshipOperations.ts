import type { DatabaseAdapter } from '../../db/database';
import type { AuthorizationContext } from '@arch-register/permissions';
import { PermissionChecker } from '@arch-register/permissions';

import { httpAssert } from '../../utils/httpAssert';

import { requireEntityAction } from '../auth/authorization';

import {
  handleError,
  buildEntityRelations,
  buildEntityDependents,
  buildBatchEntityDependents
} from './dataHelpers';

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
    const entity = await db.catalog.getEntity(workspace, id);
    httpAssert.present(entity, { status: 404, message: `Data record '${id}' not found` });
    if (authCtx)
      requireEntityAction(
        authCtx,
        entity,
        'view_entity',
        'You do not have access to view this entity'
      );
    const [schemas, entitiesRaw, typedRelations, relationSchemas] = await Promise.all([
      db.catalog.listSchemas(workspace),
      listAllCatalogEntities(db, workspace),
      db.relation.listRelationsForEntity(workspace, entity.id),
      db.relation.listRelationSchemas(workspace)
    ]);
    const entities = authCtx
      ? entitiesRaw.filter(row => checker.hasEntityPermission(authCtx, row, 'view_entity'))
      : entitiesRaw;
    return buildEntityRelations(
      entity,
      schemas,
      entities,
      authCtx,
      typedRelations,
      relationSchemas
    );
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
    const [schemas, entitiesRaw, typedRelationsRaw, relationSchemas] = await Promise.all([
      db.catalog.listSchemas(workspace),
      listAllCatalogEntities(db, workspace),
      db.relation.listRelationsForEntities(workspace, ids),
      db.relation.listRelationSchemas(workspace)
    ]);
    const entities = authCtx
      ? entitiesRaw.filter(row => checker.hasEntityPermission(authCtx, row, 'view_entity'))
      : entitiesRaw;
    const entityLookup = new Map(entities.map(e => [e.id, e]));
    const typedOutgoingByEntity = new Map<string, typeof typedRelationsRaw.outgoing>();
    for (const row of typedRelationsRaw.outgoing) {
      if (!typedOutgoingByEntity.has(row.in_entity_id))
        typedOutgoingByEntity.set(row.in_entity_id, []);
      typedOutgoingByEntity.get(row.in_entity_id)!.push(row);
    }
    const typedIncomingByEntity = new Map<string, typeof typedRelationsRaw.incoming>();
    for (const row of typedRelationsRaw.incoming) {
      if (!typedIncomingByEntity.has(row.out_entity_id))
        typedIncomingByEntity.set(row.out_entity_id, []);
      typedIncomingByEntity.get(row.out_entity_id)!.push(row);
    }
    const result: Record<string, EntityRelations> = {};
    for (const id of ids) {
      const entity = entityLookup.get(id);
      if (!entity) continue;
      result[id] = buildEntityRelations(
        entity,
        schemas,
        entities,
        authCtx,
        {
          outgoing: typedOutgoingByEntity.get(id) ?? [],
          incoming: typedIncomingByEntity.get(id) ?? []
        },
        relationSchemas
      );
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
    const [typedRelationsRaw, relationSchemas] = await Promise.all([
      db.relation.listRelationsForEntities(
        workspace,
        entities.map(row => row.id)
      ),
      db.relation.listRelationSchemas(workspace)
    ]);
    const typedRelations = [
      ...new Map(
        [...typedRelationsRaw.outgoing, ...typedRelationsRaw.incoming].map(row => [row.id, row])
      ).values()
    ];
    return buildEntityDependents(
      entity.id,
      entities,
      schemas,
      options,
      authCtx,
      typedRelations,
      relationSchemas
    );
  } catch (error) {
    return handleError(error, 'Failed to retrieve entity dependents');
  }
};

export const getBatchEntityDependents = async (
  db: DatabaseAdapter,
  workspace: string,
  ids: string[],
  options: { transitive: boolean; maxDepth?: number },
  authCtx: AuthorizationContext | null
): Promise<Map<string, EntityDependents>> => {
  try {
    if (ids.length === 0) return new Map();

    const [schemas, entitiesRaw] = await Promise.all([
      db.catalog.listSchemas(workspace),
      listAllCatalogEntities(db, workspace)
    ]);
    const entities = authCtx
      ? entitiesRaw.filter(row => checker.hasEntityPermission(authCtx, row, 'view_entity'))
      : entitiesRaw;
    const entityIds = entities.map(row => row.id);
    const [typedRelationsRaw, relationSchemas] = await Promise.all([
      db.relation.listRelationsForEntities(workspace, entityIds),
      db.relation.listRelationSchemas(workspace)
    ]);
    const typedRelations = [
      ...new Map(
        [...typedRelationsRaw.outgoing, ...typedRelationsRaw.incoming].map(row => [row.id, row])
      ).values()
    ];
    return buildBatchEntityDependents(
      ids,
      entities,
      schemas,
      options,
      authCtx,
      typedRelations,
      relationSchemas
    );
  } catch (error) {
    return handleError(error, 'Failed to retrieve batch entity dependents');
  }
};
