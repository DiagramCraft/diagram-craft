import type { AuthorizationContext } from '@arch-register/permissions';
import type { DatabaseAdapter } from '../../db/database';
import { httpAssert } from '../../utils/httpAssert';
import { requireEntityAction } from '../auth/authorization';
import { buildEntityProjection } from '../derived/entityProjection';

export const getEntityJsonProjection = async (
  db: DatabaseAdapter,
  workspace: string,
  identifier: string,
  depth: number,
  authCtx: AuthorizationContext | null
) => {
  const entity = await db.catalog.getEntity(workspace, identifier);
  httpAssert.present(entity, { status: 404, message: `Data record '${identifier}' not found` });
  if (authCtx) {
    requireEntityAction(
      authCtx,
      entity,
      'view_entity',
      'You do not have access to view this entity'
    );
  }

  const [entities, schemas, relationSchemas] = await Promise.all([
    db.catalog.listEntities(workspace),
    db.catalog.listSchemas(workspace),
    db.relation.listRelationSchemas(workspace)
  ]);
  const relationRows = await db.relation.listRelationsForEntities(
    workspace,
    entities.map(candidate => candidate.id)
  );
  const relations = [...relationRows.outgoing, ...relationRows.incoming].filter(
    (row, index, rows) => rows.findIndex(candidate => candidate.id === row.id) === index
  );

  const projection = buildEntityProjection(
    entity.id,
    entities,
    schemas,
    relations,
    relationSchemas,
    { depth, authCtx }
  );
  httpAssert.present(projection, {
    status: 404,
    message: `Data record '${identifier}' not found`
  });
  return projection;
};
