import { randomUUID } from 'node:crypto';
import type { DatabaseAdapter } from '../../db/database';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { PermissionChecker } from '@arch-register/permissions';
import { ENTITY_DEFAULTS } from '../../constants';
import {
  requireSchemaRead,
  requireWorkspaceCapability,
  buildApiEntityAuthCtx
} from '../auth/authorization';
import { runAuthorizedOperation } from '../operation';
import { httpAssert } from '../../utils/httpAssert';
import { orpcAssert } from '../../utils/orpcAssert';
import { requireNoRestrictedFieldWrites } from '../auth/fieldGroupAccessControl';
import {
  extractRelationFieldData,
  extractRelationOwnerOrLifecycleId,
  assertRelationMutationsSupported,
  normalizeRelationEntityFields,
  toRedactedApiRelation,
  validateRelationEndpoints,
  createRelationVersionSchemaResolver
} from './relationHelpers';
import {
  createRelationWithAudit,
  deleteRelationWithAudit,
  updateRelationWithAudit
} from './relationMutations';
import { withCatalogMutationTransaction } from './mutationTransaction';
import {
  assertVersionCanBeRestored,
  assertVersionDataCanBeRestored,
  redactVersionState,
  serializeEntityVersion
} from './entityVersionOperations';
import {
  canViewTypedRelation,
  canViewTypedRelationFromEndpoint,
  requireTypedRelationEdit
} from './relationAccessControl';
import type {
  RelationRecord,
  RelationListFilters,
  EntityTypedRelations
} from '@arch-register/api-types/relationContract';
import type { EntityQuery } from '@arch-register/api-types/entityQueryIR';
import { listRelationsWithCount, type RelationListPage } from './entityQueryOperations';
import { validateSelectEnumValues } from './entityScalarValues';
import { getWorkspaceEnumDefinitions } from './enumOptions';

const dbErrorMessages = {
  foreign: 'Relation endpoints or schema could not be resolved'
} as const;

const checker = new PermissionChecker();

export const listAllRelations = async (
  db: DatabaseAdapter,
  workspace: string,
  filters: RelationListFilters
) => {
  const rows: Awaited<ReturnType<typeof db.relation.listRelations>>['items'] = [];
  const pageSize = ENTITY_DEFAULTS.PAGE_SIZE;
  let offset = 0;
  while (true) {
    const page = await db.relation.listRelations(
      workspace,
      {
        schemaId: filters.schemaId ?? null,
        inEntityId: filters.inEntityId ?? null,
        outEntityId: filters.outEntityId ?? null
      },
      { limit: pageSize, offset }
    );
    if (page.items.length === 0) break;
    rows.push(...page.items);
    if (page.items.length < pageSize || rows.length >= page.total) break;
    offset += pageSize;
  }
  return rows;
};

export const getOwnerSchemas = async (
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

export const listWorkspaceRelations = async (
  db: DatabaseAdapter,
  workspace: string,
  filters: RelationListFilters,
  pagination: { limit?: number; offset?: number },
  event: AuthenticatedEvent
): Promise<{ items: RelationRecord[]; total: number }> => {
  return runAuthorizedOperation({
    db: db,
    event: event,
    scope: { kind: 'workspace', workspace: workspace },
    fallback: 'Failed to retrieve relations',
    dbErrorMessages,
    operation: async ({ ws, authCtx }) => {
      requireSchemaRead(authCtx);
      const [rows, schemas, entities] = await Promise.all([
        listAllRelations(db, ws, filters),
        db.relation.listRelationSchemas(ws),
        db.catalog.listEntities(ws)
      ]);
      const entitySchemaIdByEntity = new Map(entities.map(entity => [entity.id, entity.schema_id]));
      const entitySchemas = await db.catalog.listSchemas(ws);
      const entitySchemaById = new Map(entitySchemas.map(schema => [schema.id, schema]));
      const schemaById = new Map(schemas.map(schema => [schema.id, schema]));
      const visibleRows = rows.filter(row =>
        canViewTypedRelation(
          authCtx,
          [
            {
              schema: entitySchemaById.get(entitySchemaIdByEntity.get(row.in_entity_id) ?? ''),
              direction: 'in'
            },
            {
              schema: entitySchemaById.get(entitySchemaIdByEntity.get(row.out_entity_id) ?? ''),
              direction: 'out'
            }
          ],
          row.schema_id,
          row.owner
        )
      );
      const offset = pagination.offset ?? 0;
      const limit = pagination.limit ?? ENTITY_DEFAULTS.PAGE_SIZE;
      return {
        items: visibleRows.slice(offset, offset + limit).map(row => {
          const schema = schemaById.get(row.schema_id);
          return toRedactedApiRelation(row, authCtx, schema);
        }),
        total: visibleRows.length
      };
    }
  });
};

export const queryWorkspaceRelations = async (
  db: DatabaseAdapter,
  workspace: string,
  relationQuery: EntityQuery,
  options: { view?: 'summary' | 'full'; limit?: number; offset?: number },
  event: AuthenticatedEvent
): Promise<RelationListPage> => {
  return runAuthorizedOperation({
    db: db,
    event: event,
    scope: { kind: 'workspace', workspace: workspace },
    fallback: 'Failed to retrieve relations',
    dbErrorMessages,
    operation: async ({ ws, authCtx }) => {
      requireSchemaRead(authCtx);
      return listRelationsWithCount(db, ws, authCtx, {
        relationQuery,
        view: options.view,
        limit: options.limit,
        offset: options.offset
      });
    }
  });
};

export const getWorkspaceRelation = async (
  db: DatabaseAdapter,
  workspace: string,
  id: string,
  event: AuthenticatedEvent
): Promise<RelationRecord> => {
  return runAuthorizedOperation({
    db: db,
    event: event,
    scope: { kind: 'workspace', workspace: workspace },
    fallback: 'Failed to retrieve relation',
    dbErrorMessages,
    operation: async ({ ws, authCtx }) => {
      requireSchemaRead(authCtx);
      const row = await db.relation.getRelation(ws, id);
      httpAssert.present(row, { status: 404, message: `Relation '${id}' not found` });
      const { inSchema, outSchema } = await getOwnerSchemas(db, ws, row);
      httpAssert.true(
        canViewTypedRelation(
          authCtx,
          [
            { schema: inSchema, direction: 'in' },
            { schema: outSchema, direction: 'out' }
          ],
          row.schema_id,
          row.owner
        ),
        { status: 404, message: `Relation '${id}' not found` }
      );
      const schema = await db.relation.getRelationSchema(ws, row.schema_id);
      return toRedactedApiRelation(row, authCtx, schema);
    }
  });
};

export const createWorkspaceRelation = async (
  db: DatabaseAdapter,
  workspace: string,
  body: Record<string, unknown>,
  event: AuthenticatedEvent
): Promise<RelationRecord> => {
  return runAuthorizedOperation({
    db: db,
    event: event,
    scope: { kind: 'workspace', workspace: workspace },
    fallback: 'Failed to create relation',
    dbErrorMessages,
    operation: async ({ ws, authCtx }) => {
      requireWorkspaceCapability(authCtx, 'ent.edit');

      const schemaId = body._schemaId;
      const inEntityId = body._inEntityId;
      const outEntityId = body._outEntityId;
      httpAssert.string(schemaId, { message: '_schemaId is required and must be a string' });
      httpAssert.string(inEntityId, { message: '_inEntityId is required and must be a string' });
      httpAssert.string(outEntityId, { message: '_outEntityId is required and must be a string' });

      const schema = await db.relation.getRelationSchema(ws, schemaId);
      httpAssert.present(schema, {
        status: 404,
        message: `Relation schema '${schemaId}' not found`
      });
      // Creating a relation instance is never gated on approval policy, mirroring entity create —
      // there is no prior approved state to protect yet.

      const [inEntity, outEntity] = await Promise.all([
        db.catalog.getEntity(ws, inEntityId),
        db.catalog.getEntity(ws, outEntityId)
      ]);
      validateRelationEndpoints(schema, inEntity, outEntity);
      const { inSchema, outSchema } = await getOwnerSchemas(db, ws, {
        in_entity_id: inEntity!.id,
        out_entity_id: outEntity!.id
      });
      requireTypedRelationEdit(
        authCtx,
        [
          { schema: inSchema, direction: 'in' },
          { schema: outSchema, direction: 'out' }
        ],
        schema.id
      );

      const data = extractRelationFieldData(body);
      requireNoRestrictedFieldWrites(authCtx, schema, Object.keys(data));

      const [entities, enumDefinitions] = await Promise.all([
        db.catalog.listEntities(ws),
        getWorkspaceEnumDefinitions(db, ws)
      ]);
      const normalizedData = normalizeRelationEntityFields({
        schema,
        workspace: ws,
        data,
        entities
      });
      validateSelectEnumValues({
        schemaFields: schema.fields.filter(field => field.type === 'select'),
        fields: normalizedData,
        enumDefinitions
      });

      // Default-copy owner/lifecycle from the "in" entity at creation time, unless the caller
      // explicitly overrides one or both — after this, ownership/lifecycle are fully independent
      // of the source entity (see #2708). Overriding to a specific owner team requires the same
      // admin_relation right as reassigning an existing relation's owner.
      const owner =
        '_owner' in body ? extractRelationOwnerOrLifecycleId(body['_owner']) : inEntity!.owner;
      const lifecycle =
        '_lifecycle' in body
          ? extractRelationOwnerOrLifecycleId(body['_lifecycle'])
          : inEntity!.lifecycle;
      if ('_owner' in body && owner !== inEntity!.owner) {
        httpAssert.true(checker.hasRelationPermission(authCtx, { owner }, 'admin_relation'), {
          status: 403,
          statusText: 'Forbidden',
          message: 'You do not have permission to assign this relation to the given owner'
        });
      }

      const row = await withCatalogMutationTransaction(db, async tx => {
        const timestamp = new Date();
        return createRelationWithAudit(tx, {
          workspace: ws,
          relation: {
            id: randomUUID(),
            workspace: ws,
            schema_id: schemaId,
            in_entity_id: inEntity!.id,
            out_entity_id: outEntity!.id,
            data: normalizedData,
            owner,
            lifecycle,
            created_at: timestamp,
            updated_at: timestamp
          },
          actor: { id: authCtx.userId }
        });
      });

      return toRedactedApiRelation(row, authCtx, schema);
    }
  });
};

export const updateWorkspaceRelation = async (
  db: DatabaseAdapter,
  workspace: string,
  id: string,
  body: Record<string, unknown>,
  event: AuthenticatedEvent
): Promise<RelationRecord> => {
  return runAuthorizedOperation({
    db: db,
    event: event,
    scope: { kind: 'workspace', workspace: workspace },
    fallback: 'Failed to update relation',
    dbErrorMessages,
    operation: async ({ ws, authCtx }) => {
      requireWorkspaceCapability(authCtx, 'ent.edit');
      const oldRow = await db.relation.getRelation(ws, id);
      httpAssert.present(oldRow, { status: 404, message: `Relation '${id}' not found` });

      const schema = await db.relation.getRelationSchema(ws, oldRow.schema_id);
      httpAssert.present(schema, {
        status: 404,
        message: `Relation schema '${oldRow.schema_id}' not found`
      });
      const { inSchema, outSchema } = await getOwnerSchemas(db, ws, oldRow);
      requireTypedRelationEdit(
        authCtx,
        [
          { schema: inSchema, direction: 'in' },
          { schema: outSchema, direction: 'out' }
        ],
        oldRow.schema_id,
        oldRow.owner
      );
      assertRelationMutationsSupported(schema, oldRow);

      const data = extractRelationFieldData(body);
      const changedFieldIds = Object.keys(data).filter(
        key => JSON.stringify(oldRow.data[key] ?? null) !== JSON.stringify(data[key] ?? null)
      );
      requireNoRestrictedFieldWrites(authCtx, schema, changedFieldIds);

      const nextOwner =
        '_owner' in body ? extractRelationOwnerOrLifecycleId(body['_owner']) : undefined;
      const nextLifecycle =
        '_lifecycle' in body ? extractRelationOwnerOrLifecycleId(body['_lifecycle']) : undefined;
      if (nextOwner !== undefined && nextOwner !== oldRow.owner) {
        httpAssert.true(checker.hasRelationPermission(authCtx, oldRow, 'admin_relation'), {
          status: 403,
          statusText: 'Forbidden',
          message: 'You do not have permission to change ownership of this relation'
        });
      }

      const [entities, enumDefinitions] = await Promise.all([
        db.catalog.listEntities(ws),
        getWorkspaceEnumDefinitions(db, ws)
      ]);
      const nextData = normalizeRelationEntityFields({
        schema,
        workspace: ws,
        data: { ...oldRow.data, ...data },
        entities
      });
      validateSelectEnumValues({
        schemaFields: schema.fields.filter(field => field.type === 'select'),
        fields: nextData,
        enumDefinitions,
        previousFields: oldRow.data
      });
      const row = await withCatalogMutationTransaction(db, async tx =>
        updateRelationWithAudit(tx, {
          workspace: ws,
          relationId: id,
          previous: oldRow,
          next: {
            data: nextData,
            owner: nextOwner,
            lifecycle: nextLifecycle,
            version: oldRow.version + 1,
            updated_at: new Date()
          },
          actor: { id: authCtx.userId }
        })
      );
      httpAssert.present(row, { status: 404, message: `Relation '${id}' not found` });

      return toRedactedApiRelation(row, authCtx, schema);
    }
  });
};

export const deleteWorkspaceRelation = async (
  db: DatabaseAdapter,
  workspace: string,
  id: string,
  event: AuthenticatedEvent
): Promise<{ success: boolean; message: string }> => {
  return runAuthorizedOperation({
    db: db,
    event: event,
    scope: { kind: 'workspace', workspace: workspace },
    fallback: 'Failed to delete relation',
    dbErrorMessages,
    operation: async ({ ws, authCtx }) => {
      requireWorkspaceCapability(authCtx, 'ent.edit');
      const row = await db.relation.getRelation(ws, id);
      httpAssert.present(row, { status: 404, message: `Relation '${id}' not found` });
      const { inSchema, outSchema } = await getOwnerSchemas(db, ws, row);
      requireTypedRelationEdit(
        authCtx,
        [
          { schema: inSchema, direction: 'in' },
          { schema: outSchema, direction: 'out' }
        ],
        row.schema_id,
        row.owner
      );
      const schema = await db.relation.getRelationSchema(ws, row.schema_id);
      httpAssert.present(schema, {
        status: 404,
        message: `Relation schema '${row.schema_id}' not found`
      });
      // Deleting a relation instance is never gated on approval policy, mirroring entity delete.

      await withCatalogMutationTransaction(db, async tx => {
        // Soft delete (relationDatabase.ts), so the row is still there for the FK from
        // record_version — mirrors deleteEntity's nextVersionNumber computation, since deleting
        // a relation doesn't bump its own `version` counter the way create/update do.
        const existingVersions = await tx.catalog.listEntityVersions(ws, row.id);
        const nextVersionNumber =
          existingVersions.reduce((max, v) => Math.max(max, v.version_number), 0) + 1;
        await deleteRelationWithAudit(tx, {
          workspace: ws,
          relation: row,
          actor: { id: authCtx.userId },
          versionNumber: nextVersionNumber
        });
      });

      return { success: true, message: `Relation '${id}' deleted` };
    }
  });
};

export const restoreWorkspaceRelationVersion = async (
  db: DatabaseAdapter,
  workspace: string,
  id: string,
  versionId: string,
  commitMessage: string | null,
  event: AuthenticatedEvent
): Promise<ReturnType<typeof serializeEntityVersion>> => {
  return runAuthorizedOperation({
    db: db,
    event: event,
    scope: { kind: 'workspace', workspace: workspace },
    fallback: 'Failed to restore relation version',
    dbErrorMessages,
    operation: async ({ ws, authCtx }) => {
      requireWorkspaceCapability(authCtx, 'ent.edit');
      const row = await db.relation.getRelation(ws, id);
      httpAssert.present(row, { status: 404, message: `Relation '${id}' not found` });

      const schema = await db.relation.getRelationSchema(ws, row.schema_id);
      httpAssert.present(schema, {
        status: 404,
        message: `Relation schema '${row.schema_id}' not found`
      });
      const { inSchema, outSchema } = await getOwnerSchemas(db, ws, row);
      requireTypedRelationEdit(
        authCtx,
        [
          { schema: inSchema, direction: 'in' },
          { schema: outSchema, direction: 'out' }
        ],
        row.schema_id,
        row.owner
      );
      assertRelationMutationsSupported(schema, row);

      const version = await db.catalog.getEntityVersionById(ws, versionId);
      orpcAssert.present(version, { code: 'NOT_FOUND', message: 'Version not found' });
      assertVersionCanBeRestored(version, row.id);

      const restoredData = version.state['data'];
      httpAssert.true(restoredData != null && typeof restoredData === 'object', {
        status: 400,
        message: 'Relation version does not contain a valid data state'
      });
      const resolveVersionSchemas = createRelationVersionSchemaResolver(db, ws);
      const { historicalSchema } = await resolveVersionSchemas(version, row.schema_id);
      assertVersionDataCanBeRestored(
        authCtx,
        schema,
        historicalSchema,
        row.data,
        restoredData as Record<string, unknown>,
        { failClosedWhenHistoricalSchemaMissing: true }
      );

      await withCatalogMutationTransaction(db, async tx => {
        const timestamp = new Date();
        const nextRow = await updateRelationWithAudit(tx, {
          workspace: ws,
          relationId: id,
          previous: row,
          next: {
            data: restoredData as Record<string, unknown>,
            version: row.version + 1,
            updated_at: timestamp
          },
          actor: { id: authCtx.userId },
          versionKind: 'restored',
          commitMessage,
          auditMetadata: {
            restore_from_version_id: version.id,
            restore_from_version_created_at: version.created_at.toISOString(),
            restore_commit_message: commitMessage
          }
        });
        httpAssert.present(nextRow, { status: 404, message: `Relation '${id}' not found` });
      });

      return serializeEntityVersion(
        redactVersionState(version, authCtx, schema, historicalSchema, {
          failClosedWhenHistoricalSchemaMissing: true
        })
      );
    }
  });
};

export const listTypedRelationsForEntity = async (
  db: DatabaseAdapter,
  workspace: string,
  entityId: string,
  event: AuthenticatedEvent
): Promise<EntityTypedRelations> => {
  return runAuthorizedOperation({
    db: db,
    event: event,
    scope: { kind: 'workspace', workspace: workspace },
    fallback: 'Failed to retrieve typed relations',
    dbErrorMessages,
    operation: async ({ ws, authCtx }) => {
      requireSchemaRead(authCtx);
      const entity = await db.catalog.getEntity(ws, entityId);
      httpAssert.present(entity, { status: 404, message: `Entity '${entityId}' not found` });
      const entitySchema = await db.catalog.getSchema(ws, entity.schema_id);

      const [{ outgoing, incoming }, schemas, entityAuthCtx] = await Promise.all([
        db.relation.listRelationsForEntity(ws, entity.id),
        db.relation.listRelationSchemas(ws),
        // Endpoint visibility spans a second entity authorization context; keep it separate from
        // the outer workspace-scoped operation so endpoint grants are evaluated independently.
        buildApiEntityAuthCtx(db, ws, event)
      ]);
      const endpointEntityIds = new Set([
        ...outgoing.map(row => row.out_entity_id),
        ...incoming.map(row => row.in_entity_id)
      ]);
      const endpointSchemas = new Map<string, Awaited<ReturnType<typeof db.catalog.getSchema>>>();
      await Promise.all(
        [...endpointEntityIds].map(async endpointEntityId => {
          const endpoint = await db.catalog.getEntity(ws, endpointEntityId);
          endpointSchemas.set(
            endpointEntityId,
            endpoint ? await db.catalog.getSchema(ws, endpoint.schema_id) : null
          );
        })
      );
      // Drop relations pointing at an entity the caller can't view, mirroring the equivalent
      // entity-visibility filtering already applied to generic reference/containment relations
      // in buildEntityRelations (dataHelpers.ts).
      const isEntityVisible = (id: string) => {
        const row = entityAuthCtx.entities.get(id);
        return row != null && checker.hasEntityPermission(entityAuthCtx, row, 'view_entity');
      };
      const schemaById = new Map(schemas.map(schema => [schema.id, schema]));
      const toRecord = (row: (typeof outgoing)[number]) => {
        const schema = schemaById.get(row.schema_id);
        return toRedactedApiRelation(row, authCtx, schema);
      };
      return {
        outgoing: outgoing
          .filter(
            row =>
              isEntityVisible(row.out_entity_id) &&
              canViewTypedRelation(
                authCtx,
                [
                  { schema: entitySchema, direction: 'in' },
                  { schema: endpointSchemas.get(row.out_entity_id), direction: 'out' }
                ],
                row.schema_id,
                row.owner
              ) &&
              canViewTypedRelationFromEndpoint(authCtx, entitySchema, row.schema_id, 'in')
          )
          .map(toRecord),
        incoming: incoming
          .filter(
            row =>
              isEntityVisible(row.in_entity_id) &&
              canViewTypedRelation(
                authCtx,
                [
                  { schema: endpointSchemas.get(row.in_entity_id), direction: 'in' },
                  { schema: entitySchema, direction: 'out' }
                ],
                row.schema_id,
                row.owner
              ) &&
              canViewTypedRelationFromEndpoint(authCtx, entitySchema, row.schema_id, 'out')
          )
          .map(toRecord)
      };
    }
  });
};
