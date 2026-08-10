import { implement } from '@orpc/server';
import type { DatabaseAdapter } from '../../db/database';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { createOrpcHandler } from '../../utils/orpcHandler';
import { entityScoped, orpcErrorMiddleware, workspaceScoped } from '../../utils/orpcErrors';
import { httpAssert } from '../../utils/httpAssert';
import { orpcAssert } from '../../utils/orpcAssert';
import { redactVersionState, serializeEntityVersion } from './entityVersionOperations';
import { canViewTypedRelation } from './relationAccessControl';
import { createRelationVersionSchemaResolver } from './relationHelpers';
import { restoreWorkspaceRelationVersion } from './relationOperations';
import { getEntitySchemaAt } from './schemaHistory';
import { relationVersionContract } from '@arch-register/api-types/relationVersionContract';

type ORPCContext = {
  db: DatabaseAdapter;
  event: AuthenticatedEvent;
};

const relationVersionRouter = implement(relationVersionContract)
  .$context<ORPCContext>()
  .use(orpcErrorMiddleware)
  .use(workspaceScoped)
  .use(entityScoped);

const createOwnerSchemaResolver = (
  db: DatabaseAdapter,
  workspace: string,
  row: { in_entity_id: string; out_entity_id: string }
) => {
  const endpointEntities = Promise.all([
    db.catalog.getEntity(workspace, row.in_entity_id),
    db.catalog.getEntity(workspace, row.out_entity_id)
  ]);
  return async (at: Date) => {
    const [inEntity, outEntity] = await endpointEntities;
    const [inSchema, outSchema] = await Promise.all([
      inEntity ? getEntitySchemaAt(db, workspace, inEntity.schema_id, at) : null,
      outEntity ? getEntitySchemaAt(db, workspace, outEntity.schema_id, at) : null
    ]);
    return { inSchema, outSchema };
  };
};

const relationVersionHandlers = {
  list: relationVersionRouter.relationVersions.list.handler(async ({ input, context }) => {
    const { workspace, authCtx } = context;
    const row = await context.db.relation.getRelation(workspace, input.params.id);
    httpAssert.present(row, { status: 404, message: `Relation '${input.params.id}' not found` });
    const versions = await context.db.catalog.listEntityVersions(workspace, row.id);
    const resolveOwnerSchemas = createOwnerSchemaResolver(context.db, workspace, row);
    const resolveVersionSchemas = createRelationVersionSchemaResolver(context.db, workspace);
    const visibleVersions = await Promise.all(
      versions.map(async version => {
        const { inSchema, outSchema } = await resolveOwnerSchemas(version.created_at);
        if (
          !canViewTypedRelation(
            authCtx,
            [
              { schema: inSchema, direction: 'in' },
              { schema: outSchema, direction: 'out' }
            ],
            row.schema_id
          )
        ) {
          return null;
        }

        const { schema, historicalSchema } = await resolveVersionSchemas(version, row.schema_id);
        return serializeEntityVersion(
          redactVersionState(version, authCtx, schema, historicalSchema, {
            failClosedWhenHistoricalSchemaMissing: true
          })
        );
      })
    );
    return visibleVersions.filter(version => version != null);
  }),

  get: relationVersionRouter.relationVersions.get.handler(async ({ input, context }) => {
    const { workspace, authCtx } = context;
    const row = await context.db.relation.getRelation(workspace, input.params.id);
    httpAssert.present(row, { status: 404, message: `Relation '${input.params.id}' not found` });
    const version = await context.db.catalog.getEntityVersionById(
      workspace,
      input.params.versionId
    );
    orpcAssert.present(version, { code: 'NOT_FOUND', message: 'Version not found' });
    orpcAssert.true(version.record_id === row.id, {
      code: 'BAD_REQUEST',
      message: 'Version does not belong to this relation'
    });
    const resolveOwnerSchemas = createOwnerSchemaResolver(context.db, workspace, row);
    const { inSchema, outSchema } = await resolveOwnerSchemas(version.created_at);
    httpAssert.true(
      canViewTypedRelation(
        authCtx,
        [
          { schema: inSchema, direction: 'in' },
          { schema: outSchema, direction: 'out' }
        ],
        row.schema_id
      ),
      { status: 404, message: `Relation '${input.params.id}' not found` }
    );
    const resolveVersionSchemas = createRelationVersionSchemaResolver(context.db, workspace);
    const { schema, historicalSchema } = await resolveVersionSchemas(version, row.schema_id);
    return serializeEntityVersion(
      redactVersionState(version, authCtx, schema, historicalSchema, {
        failClosedWhenHistoricalSchemaMissing: true
      })
    );
  }),

  restore: relationVersionRouter.relationVersions.restore.handler(async ({ input, context }) =>
    restoreWorkspaceRelationVersion(
      context.db,
      input.params.workspace,
      input.params.id,
      input.params.versionId,
      input.body.commitMessage ?? null,
      context.event
    )
  )
};

export const relationVersionORPCRouter = relationVersionRouter.router({
  relationVersions: relationVersionHandlers
});

export const createRelationVersionORPCHandler = (db: DatabaseAdapter) =>
  createOrpcHandler(relationVersionORPCRouter, {
    context: event => ({ db, event: event as AuthenticatedEvent })
  });
