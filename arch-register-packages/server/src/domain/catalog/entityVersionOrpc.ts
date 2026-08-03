import { defineHandler } from 'h3';
import { implement } from '@orpc/server';
import { OpenAPIHandler } from '@orpc/openapi/fetch';
import type { DatabaseAdapter, EntityDbUpdate } from '../../db/database';
import type { AuthenticatedEvent } from '../../middleware/auth';
import {
  entityScoped,
  orpcErrorInterceptors,
  orpcErrorMiddleware,
  workspaceScoped
} from '../../utils/orpcErrors';
import { httpAssert } from '../../utils/httpAssert';
import { orpcAssert } from '../../utils/orpcAssert';
import { requireEntityAction } from '../auth/authorization';
import { updateEntityWithAudit } from './entityMutations';
import { entityRequiresApproval } from './entityChangeOperations';
import {
  assertVersionCanBeRestored,
  assertVersionDataCanBeRestored,
  redactVersionState,
  serializeEntityVersion
} from './entityVersionOperations';
import { entityVersionContract } from '@arch-register/api-types/entityVersionContract';
import type { SchemaDbResult, SchemaVersionDbResult } from './db/catalogDatabase';

type ORPCContext = {
  db: DatabaseAdapter;
  event: AuthenticatedEvent;
};

const entityVersionRouter = implement(entityVersionContract)
  .$context<ORPCContext>()
  .use(orpcErrorMiddleware)
  .use(workspaceScoped)
  .use(entityScoped);

type SchemaLookup = {
  schema: SchemaDbResult | null;
  schemaVersions: SchemaVersionDbResult[];
};

const createVersionSchemaResolver = (db: DatabaseAdapter, workspace: string) => {
  const lookups = new Map<string, Promise<SchemaLookup>>();

  const getSchemaLookup = (schemaId: string): Promise<SchemaLookup> => {
    const existing = lookups.get(schemaId);
    if (existing) return existing;

    const lookup = Promise.all([
      db.catalog.getSchema(workspace, schemaId),
      db.catalog.listSchemaVersions(workspace, schemaId)
    ]).then(([schema, schemaVersions]) => ({ schema, schemaVersions }));
    lookups.set(schemaId, lookup);
    return lookup;
  };

  return async (
    version: { state: Record<string, unknown>; created_at: Date },
    fallbackSchemaId?: string,
    useFallbackSchema = false
  ) => {
    const schemaId = String(version.state['schema_id'] ?? fallbackSchemaId ?? '');
    const [versionLookup, fallbackSchema] = await Promise.all([
      schemaId
        ? getSchemaLookup(schemaId)
        : Promise.resolve({ schema: null, schemaVersions: [] as SchemaVersionDbResult[] }),
      useFallbackSchema && fallbackSchemaId && fallbackSchemaId !== schemaId
        ? db.catalog.getSchema(workspace, fallbackSchemaId)
        : Promise.resolve(null)
    ]);

    const historicalSchema =
      [...versionLookup.schemaVersions]
        .filter(schemaVersion => schemaVersion.created_at <= version.created_at)
        .sort((left, right) => right.created_at.getTime() - left.created_at.getTime())[0] ?? null;

    return {
      schema: versionLookup.schema ?? fallbackSchema,
      historicalSchema
    };
  };
};

const getVersionSchemas = async (
  db: DatabaseAdapter,
  workspace: string,
  version: { state: Record<string, unknown>; created_at: Date },
  fallbackSchemaId?: string
) => {
  return createVersionSchemaResolver(db, workspace)(version, fallbackSchemaId, true);
};

const entityVersionHandlers = {
  list: entityVersionRouter.entityVersions.list.handler(async ({ input, context }) => {
    const { workspace, authCtx } = context;
    const entity = await context.db.catalog.getEntity(workspace, input.params.id);
    httpAssert.present(entity, {
      status: 404,
      message: `Data record '${input.params.id}' not found`
    });
    requireEntityAction(
      authCtx,
      entity,
      'view_entity',
      'You do not have access to view this entity'
    );
    const versions = await context.db.catalog.listEntityVersions(workspace, entity.id);
    const resolveVersionSchemas = createVersionSchemaResolver(context.db, workspace);
    return Promise.all(
      versions.map(async version => {
        const { schema, historicalSchema } = await resolveVersionSchemas(version, entity.schema_id);
        return serializeEntityVersion(
          redactVersionState(version, authCtx, schema, historicalSchema, {
            failClosedWhenHistoricalSchemaMissing: true
          })
        );
      })
    );
  }),

  get: entityVersionRouter.entityVersions.get.handler(async ({ input, context }) => {
    const { workspace, authCtx } = context;
    const entity = await context.db.catalog.getEntity(workspace, input.params.id);
    httpAssert.present(entity, {
      status: 404,
      message: `Data record '${input.params.id}' not found`
    });
    requireEntityAction(
      authCtx,
      entity,
      'view_entity',
      'You do not have access to view this entity'
    );
    const version = await context.db.catalog.getEntityVersionById(
      workspace,
      input.params.versionId
    );
    orpcAssert.present(version, { code: 'NOT_FOUND', message: 'Version not found' });
    orpcAssert.true(version.entity_id === entity.id, {
      code: 'BAD_REQUEST',
      message: 'Version does not belong to this entity'
    });
    const resolveVersionSchemas = createVersionSchemaResolver(context.db, workspace);
    const { schema, historicalSchema } = await resolveVersionSchemas(version, entity.schema_id);
    return serializeEntityVersion(
      redactVersionState(version, authCtx, schema, historicalSchema, {
        failClosedWhenHistoricalSchemaMissing: true
      })
    );
  }),

  promote: entityVersionRouter.entityVersions.promote.handler(async ({ input, context }) => {
    const { workspace, authCtx } = context;
    const entity = await context.db.catalog.getEntity(workspace, input.params.id);
    httpAssert.present(entity, {
      status: 404,
      message: `Data record '${input.params.id}' not found`
    });
    requireEntityAction(
      authCtx,
      entity,
      'edit_entity',
      'You do not have permission to edit this entity'
    );
    const existing = await context.db.catalog.getEntityVersionById(
      workspace,
      input.params.versionId
    );
    orpcAssert.present(existing, { code: 'NOT_FOUND', message: 'Version not found' });
    orpcAssert.true(existing.entity_id === entity.id, {
      code: 'BAD_REQUEST',
      message: 'Version does not belong to this entity'
    });
    orpcAssert.true(existing.kind === 'autosave', {
      code: 'BAD_REQUEST',
      message: 'Only an autosave version can be promoted'
    });
    const updated = await context.db.catalog.updateEntityVersionKind(
      workspace,
      input.params.versionId,
      'saved_version',
      input.body.commitMessage ?? null
    );
    orpcAssert.present(updated, { code: 'NOT_FOUND', message: 'Version not found' });
    const { schema, historicalSchema } = await getVersionSchemas(
      context.db,
      workspace,
      updated,
      entity.schema_id
    );
    return serializeEntityVersion(redactVersionState(updated, authCtx, schema, historicalSchema));
  }),

  restore: entityVersionRouter.entityVersions.restore.handler(async ({ input, context }) => {
    const { workspace, authCtx } = context;

    const entity = await context.db.catalog.getEntity(workspace, input.params.id);
    orpcAssert.present(entity, { code: 'NOT_FOUND', message: 'Entity not found' });

    if (authCtx) {
      requireEntityAction(
        authCtx,
        entity,
        'edit_entity',
        'You do not have permission to restore this entity'
      );
    }
    const schema = await context.db.catalog.getSchema(workspace, entity.schema_id);
    httpAssert.present(schema, { status: 404, message: 'Entity schema not found' });
    httpAssert.true(!entityRequiresApproval(schema, entity), {
      status: 409,
      statusText: 'Conflict',
      message: 'This entity requires an approved change proposal before it can be restored'
    });

    const version = await context.db.catalog.getEntityVersionById(
      workspace,
      input.params.versionId
    );
    orpcAssert.present(version, { code: 'NOT_FOUND', message: 'Version not found' });
    assertVersionCanBeRestored(version, entity.id);

    const { schema: versionSchema, historicalSchema } = await getVersionSchemas(
      context.db,
      workspace,
      version,
      entity.schema_id
    );
    const restoredData = version.state['data'];
    httpAssert.true(restoredData != null && typeof restoredData === 'object', {
      status: 400,
      message: 'Entity version does not contain a valid data state'
    });
    assertVersionDataCanBeRestored(
      authCtx,
      schema,
      historicalSchema,
      entity.data,
      restoredData as Record<string, unknown>
    );

    const auditUser = context.event.context.user;
    await updateEntityWithAudit(context.db, {
      workspace,
      entityId: entity.id,
      previous: entity,
      next: {
        ...version.state,
        // Older versions predating #2346 have no frozen completeness in state; fall back to the
        // entity's current value rather than writing an undefined column.
        completeness:
          typeof version.state['completeness'] === 'number'
            ? version.state['completeness']
            : entity.completeness,
        updated_at: new Date()
      } as EntityDbUpdate,
      actor: { id: auditUser.id, displayName: auditUser.display_name },
      auditMetadata: {
        restore_from_version_id: version.id,
        restore_from_version_created_at: version.created_at.toISOString(),
        restore_commit_message: input.body.commitMessage ?? null
      }
    });

    return serializeEntityVersion(
      redactVersionState(version, authCtx, versionSchema, historicalSchema)
    );
  })
};

export const entityVersionORPCRouter = entityVersionRouter.router({
  entityVersions: entityVersionHandlers
});

export const entityVersionOpenAPIHandler = new OpenAPIHandler(entityVersionORPCRouter, {
  clientInterceptors: orpcErrorInterceptors
});

export const createEntityVersionORPCHandler = (db: DatabaseAdapter) =>
  defineHandler(async event => {
    const result = await entityVersionOpenAPIHandler.handle(event.req, {
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
