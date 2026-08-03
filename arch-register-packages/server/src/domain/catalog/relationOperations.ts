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
import { requireNoRestrictedFieldWrites } from '../auth/fieldGroupAccessControl';
import {
  extractRelationFieldData,
  flattenRelationAuditFields,
  assertRelationMutationsSupported,
  toRedactedApiRelation,
  validateRelationEndpoints,
  relationAuditContext
} from './relationHelpers';
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

const dbErrorMessages = {
  foreign: 'Relation endpoints or schema could not be resolved'
} as const;

const checker = new PermissionChecker();

const listAllRelations = async (
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
      assertRelationMutationsSupported(schema);

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
      assertRelationMutationsSupported(schema);

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
      assertRelationMutationsSupported(schema);

      await db.relation.deleteRelation(ws, id);

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
