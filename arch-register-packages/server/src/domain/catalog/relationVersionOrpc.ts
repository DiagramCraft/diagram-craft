import { defineHandler } from 'h3';
import { implement } from '@orpc/server';
import { OpenAPIHandler } from '@orpc/openapi/fetch';
import type { DatabaseAdapter } from '../../db/database';
import type { AuthenticatedEvent } from '../../middleware/auth';
import {
  entityScoped,
  orpcErrorInterceptors,
  orpcErrorMiddleware,
  workspaceScoped
} from '../../utils/orpcErrors';
import { httpAssert } from '../../utils/httpAssert';
import { orpcAssert } from '../../utils/orpcAssert';
import { redactVersionState, serializeEntityVersion } from './entityVersionOperations';
import { canViewTypedRelation } from './relationAccessControl';
import { restoreWorkspaceRelationVersion } from './relationOperations';
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

const getOwnerSchemas = async (
  db: DatabaseAdapter,
  workspace: string,
  row: { in_entity_id: string; out_entity_id: string }
) => {
  const [inEntity, outEntity, schemas] = await Promise.all([
    db.catalog.getEntity(workspace, row.in_entity_id),
    db.catalog.getEntity(workspace, row.out_entity_id),
    db.catalog.listSchemas(workspace)
  ]);
  const schemaById = new Map(schemas.map(schema => [schema.id, schema]));
  return {
    inSchema: inEntity ? schemaById.get(inEntity.schema_id) : undefined,
    outSchema: outEntity ? schemaById.get(outEntity.schema_id) : undefined
  };
};

// Redaction below is always evaluated against the relation's *current* schema — unlike entity
// version redaction, there is no historical-schema resolution wired up for relations yet, so
// `redactVersionState` is called without `historicalSchema`/`failClosedWhenHistoricalSchemaMissing`
// (the latter would zero out every relation version's data, since a historical schema never
// resolves here). Revisit once relation schema-version history informs field-group ACLs the way
// entity_schema_version does.
const relationVersionHandlers = {
  list: relationVersionRouter.relationVersions.list.handler(async ({ input, context }) => {
    const { workspace, authCtx } = context;
    const row = await context.db.relation.getRelation(workspace, input.params.id);
    httpAssert.present(row, { status: 404, message: `Relation '${input.params.id}' not found` });
    const { inSchema, outSchema } = await getOwnerSchemas(context.db, workspace, row);
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
    const schema = await context.db.relation.getRelationSchema(workspace, row.schema_id);
    const versions = await context.db.catalog.listEntityVersions(workspace, row.id);
    return versions.map(version =>
      serializeEntityVersion(redactVersionState(version, authCtx, schema))
    );
  }),

  get: relationVersionRouter.relationVersions.get.handler(async ({ input, context }) => {
    const { workspace, authCtx } = context;
    const row = await context.db.relation.getRelation(workspace, input.params.id);
    httpAssert.present(row, { status: 404, message: `Relation '${input.params.id}' not found` });
    const { inSchema, outSchema } = await getOwnerSchemas(context.db, workspace, row);
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
    const version = await context.db.catalog.getEntityVersionById(
      workspace,
      input.params.versionId
    );
    orpcAssert.present(version, { code: 'NOT_FOUND', message: 'Version not found' });
    orpcAssert.true(version.entity_id === row.id, {
      code: 'BAD_REQUEST',
      message: 'Version does not belong to this relation'
    });
    const schema = await context.db.relation.getRelationSchema(workspace, row.schema_id);
    return serializeEntityVersion(redactVersionState(version, authCtx, schema));
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

export const relationVersionOpenAPIHandler = new OpenAPIHandler(relationVersionORPCRouter, {
  clientInterceptors: orpcErrorInterceptors
});

export const createRelationVersionORPCHandler = (db: DatabaseAdapter) =>
  defineHandler(async event => {
    const result = await relationVersionOpenAPIHandler.handle(event.req, {
      prefix: '/api/application/v1',
      context: {
        db,
        event: event as AuthenticatedEvent
      }
    });

    if (result.matched) {
      return result.response;
    }
  });
