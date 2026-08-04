import { randomUUID } from 'node:crypto';
import type { DatabaseAdapter } from '../../db/database';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { PermissionChecker } from '@arch-register/permissions';
import { ENTITY_DEFAULTS } from '../../constants';
import { logAudit, computeChanges } from '../audit/db/auditLogging';
import {
  requireSchemaRead,
  requireWorkspaceCapability,
  buildApiEntityAuthCtx
} from '../auth/authorization';
import { defineOperation } from '../operation';
import { httpAssert } from '../../utils/httpAssert';
import { orpcAssert } from '../../utils/orpcAssert';
import { requireNoRestrictedFieldWrites } from '../auth/fieldGroupAccessControl';
import {
  extractRelationFieldData,
  flattenRelationAuditFields,
  assertRelationMutationsSupported,
  toRedactedApiRelation,
  validateRelationEndpoints,
  relationAuditContext,
  relationToBaseState,
  createRelationVersionSchemaResolver
} from './relationHelpers';
import {
  assertVersionCanBeRestored,
  assertVersionDataCanBeRestored,
  redactVersionState,
  serializeEntityVersion
} from './entityVersionOperations';

export const RELATION_AUTOSAVE_KEEP_COUNT = 50;
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

export const listWorkspaceRelations = async (
  db: DatabaseAdapter,
  workspace: string,
  filters: RelationListFilters,
  pagination: { limit?: number; offset?: number },
  event: AuthenticatedEvent
): Promise<{ items: RelationRecord[]; total: number }> => {
  return defineOperation(
    db,
    workspace,
    event,
    { fallback: 'Failed to retrieve relations', dbErrorMessages },
    async ({ ws, authCtx }) => {
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
          row.schema_id
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
  );
};

export const queryWorkspaceRelations = async (
  db: DatabaseAdapter,
  workspace: string,
  relationQuery: EntityQuery,
  options: { view?: 'summary' | 'full'; limit?: number; offset?: number },
  event: AuthenticatedEvent
): Promise<RelationListPage> => {
  return defineOperation(
    db,
    workspace,
    event,
    { fallback: 'Failed to retrieve relations', dbErrorMessages },
    async ({ ws, authCtx }) => {
      requireSchemaRead(authCtx);
      return listRelationsWithCount(db, ws, authCtx, {
        relationQuery,
        view: options.view,
        limit: options.limit,
        offset: options.offset
      });
    }
  );
};

export const getWorkspaceRelation = async (
  db: DatabaseAdapter,
  workspace: string,
  id: string,
  event: AuthenticatedEvent
): Promise<RelationRecord> => {
  return defineOperation(
    db,
    workspace,
    event,
    { fallback: 'Failed to retrieve relation', dbErrorMessages },
    async ({ ws, authCtx }) => {
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
          row.schema_id
        ),
        { status: 404, message: `Relation '${id}' not found` }
      );
      const schema = await db.relation.getRelationSchema(ws, row.schema_id);
      return toRedactedApiRelation(row, authCtx, schema);
    }
  );
};

export const createWorkspaceRelation = async (
  db: DatabaseAdapter,
  workspace: string,
  body: Record<string, unknown>,
  event: AuthenticatedEvent
): Promise<RelationRecord> => {
  return defineOperation(
    db,
    workspace,
    event,
    { fallback: 'Failed to create relation', dbErrorMessages },
    async ({ ws, authCtx }) => {
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

      const timestamp = new Date();
      const row = await db.relation.createRelation({
        id: randomUUID(),
        workspace: ws,
        schema_id: schemaId,
        in_entity_id: inEntity!.id,
        out_entity_id: outEntity!.id,
        data,
        created_at: timestamp,
        updated_at: timestamp
      });

      await logAudit(db, {
        userId: authCtx.userId,
        workspace: ws,
        operation: 'create',
        entityType: 'relation',
        entityId: row.id,
        entityName: `${row.in_entity_name} → ${row.out_entity_name}`,
        schemaId: row.schema_id,
        changes: { new: flattenRelationAuditFields(row) },
        metadata: { relation: relationAuditContext(row) }
      });

      await db.catalog.createEntityVersion({
        id: randomUUID(),
        workspace: ws,
        entity_id: row.id,
        version_number: row.version,
        kind: 'autosave',
        commit_message: null,
        created_at: timestamp,
        created_by: authCtx.userId,
        state: relationToBaseState(row),
        applied_case_revision_id: null
      });
      await db.catalog.pruneAutosaveVersions(ws, row.id, RELATION_AUTOSAVE_KEEP_COUNT);

      return toRedactedApiRelation(row, authCtx, schema);
    }
  );
};

export const updateWorkspaceRelation = async (
  db: DatabaseAdapter,
  workspace: string,
  id: string,
  body: Record<string, unknown>,
  event: AuthenticatedEvent
): Promise<RelationRecord> => {
  return defineOperation(
    db,
    workspace,
    event,
    { fallback: 'Failed to update relation', dbErrorMessages },
    async ({ ws, authCtx }) => {
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
        oldRow.schema_id
      );
      assertRelationMutationsSupported(schema, oldRow);

      const data = extractRelationFieldData(body);
      const changedFieldIds = Object.keys(data).filter(
        key => JSON.stringify(oldRow.data[key] ?? null) !== JSON.stringify(data[key] ?? null)
      );
      requireNoRestrictedFieldWrites(authCtx, schema, changedFieldIds);

      const nextData = { ...oldRow.data, ...data };
      const timestamp = new Date();
      const row = await db.relation.updateRelation(ws, id, {
        data: nextData,
        version: oldRow.version + 1,
        updated_at: timestamp
      });
      httpAssert.present(row, { status: 404, message: `Relation '${id}' not found` });

      const changes = computeChanges(
        flattenRelationAuditFields(oldRow),
        flattenRelationAuditFields(row),
        { alwaysInclude: ['_inEntityId', '_outEntityId'] }
      );
      await logAudit(db, {
        userId: authCtx.userId,
        workspace: ws,
        operation: 'update',
        entityType: 'relation',
        entityId: id,
        entityName: `${row.in_entity_name} → ${row.out_entity_name}`,
        schemaId: row.schema_id,
        changes,
        metadata: { relation: relationAuditContext(row) }
      });

      await db.catalog.createEntityVersion({
        id: randomUUID(),
        workspace: ws,
        entity_id: row.id,
        version_number: row.version,
        kind: 'autosave',
        commit_message: null,
        created_at: timestamp,
        created_by: authCtx.userId,
        state: relationToBaseState(row),
        applied_case_revision_id: null
      });
      await db.catalog.pruneAutosaveVersions(ws, row.id, RELATION_AUTOSAVE_KEEP_COUNT);

      return toRedactedApiRelation(row, authCtx, schema);
    }
  );
};

export const deleteWorkspaceRelation = async (
  db: DatabaseAdapter,
  workspace: string,
  id: string,
  event: AuthenticatedEvent
): Promise<{ success: boolean; message: string }> => {
  return defineOperation(
    db,
    workspace,
    event,
    { fallback: 'Failed to delete relation', dbErrorMessages },
    async ({ ws, authCtx }) => {
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
        row.schema_id
      );
      const schema = await db.relation.getRelationSchema(ws, row.schema_id);
      httpAssert.present(schema, {
        status: 404,
        message: `Relation schema '${row.schema_id}' not found`
      });
      // Deleting a relation instance is never gated on approval policy, mirroring entity delete.

      await db.relation.deleteRelation(ws, id);

      // Soft delete (relationDatabase.ts), so the row is still there for the FK from
      // record_version — mirrors deleteEntity's nextVersionNumber computation, since deleting a
      // relation doesn't bump its own `version` counter the way create/update do.
      const existingVersions = await db.catalog.listEntityVersions(ws, row.id);
      const nextVersionNumber =
        existingVersions.reduce((max, v) => Math.max(max, v.version_number), 0) + 1;
      await db.catalog.createEntityVersion({
        id: randomUUID(),
        workspace: ws,
        entity_id: row.id,
        version_number: nextVersionNumber,
        kind: 'deleted',
        commit_message: null,
        created_at: new Date(),
        created_by: authCtx.userId,
        state: relationToBaseState(row),
        applied_case_revision_id: null
      });

      await logAudit(db, {
        userId: authCtx.userId,
        workspace: ws,
        operation: 'delete',
        entityType: 'relation',
        entityId: id,
        entityName: `${row.in_entity_name} → ${row.out_entity_name}`,
        schemaId: row.schema_id,
        changes: { old: flattenRelationAuditFields(row) },
        metadata: { relation: relationAuditContext(row) }
      });

      return { success: true, message: `Relation '${id}' deleted` };
    }
  );
};

export const restoreWorkspaceRelationVersion = async (
  db: DatabaseAdapter,
  workspace: string,
  id: string,
  versionId: string,
  commitMessage: string | null,
  event: AuthenticatedEvent
): Promise<ReturnType<typeof serializeEntityVersion>> => {
  return defineOperation(
    db,
    workspace,
    event,
    { fallback: 'Failed to restore relation version', dbErrorMessages },
    async ({ ws, authCtx }) => {
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
        row.schema_id
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

      const timestamp = new Date();
      const nextRow = await db.relation.updateRelation(ws, id, {
        data: restoredData as Record<string, unknown>,
        version: row.version + 1,
        updated_at: timestamp
      });
      httpAssert.present(nextRow, { status: 404, message: `Relation '${id}' not found` });

      const changes = computeChanges(
        flattenRelationAuditFields(row),
        flattenRelationAuditFields(nextRow),
        { alwaysInclude: ['_inEntityId', '_outEntityId'] }
      );
      await logAudit(db, {
        userId: authCtx.userId,
        workspace: ws,
        operation: 'update',
        entityType: 'relation',
        entityId: id,
        entityName: `${nextRow.in_entity_name} → ${nextRow.out_entity_name}`,
        schemaId: nextRow.schema_id,
        changes,
        metadata: {
          relation: relationAuditContext(nextRow),
          restore_from_version_id: version.id,
          restore_from_version_created_at: version.created_at.toISOString(),
          restore_commit_message: commitMessage
        }
      });

      await db.catalog.createEntityVersion({
        id: randomUUID(),
        workspace: ws,
        entity_id: nextRow.id,
        version_number: nextRow.version,
        kind: 'restored',
        commit_message: commitMessage,
        created_at: timestamp,
        created_by: authCtx.userId,
        state: relationToBaseState(nextRow),
        applied_case_revision_id: null
      });
      await db.catalog.pruneAutosaveVersions(ws, nextRow.id, RELATION_AUTOSAVE_KEEP_COUNT);

      return serializeEntityVersion(
        redactVersionState(version, authCtx, schema, historicalSchema, {
          failClosedWhenHistoricalSchemaMissing: true
        })
      );
    }
  );
};

export const listTypedRelationsForEntity = async (
  db: DatabaseAdapter,
  workspace: string,
  entityId: string,
  event: AuthenticatedEvent
): Promise<EntityTypedRelations> => {
  return defineOperation(
    db,
    workspace,
    event,
    { fallback: 'Failed to retrieve typed relations', dbErrorMessages },
    async ({ ws, authCtx }) => {
      requireSchemaRead(authCtx);
      const entity = await db.catalog.getEntity(ws, entityId);
      httpAssert.present(entity, { status: 404, message: `Entity '${entityId}' not found` });
      const entitySchema = await db.catalog.getSchema(ws, entity.schema_id);

      const [{ outgoing, incoming }, schemas, entityAuthCtx] = await Promise.all([
        db.relation.listRelationsForEntity(ws, entity.id),
        db.relation.listRelationSchemas(ws),
        buildApiEntityAuthCtx(db, ws, event)
      ]);
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
              canViewTypedRelationFromEndpoint(authCtx, entitySchema, row.schema_id, 'in')
          )
          .map(toRecord),
        incoming: incoming
          .filter(
            row =>
              isEntityVisible(row.in_entity_id) &&
              canViewTypedRelationFromEndpoint(authCtx, entitySchema, row.schema_id, 'out')
          )
          .map(toRecord)
      };
    }
  );
};
