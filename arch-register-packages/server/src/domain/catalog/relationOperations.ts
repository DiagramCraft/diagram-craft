import { randomUUID } from 'node:crypto';
import type { DatabaseAdapter } from '../../db/database';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { PermissionChecker } from '@arch-register/permissions';
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
  validateRelationEndpoints
} from './relationHelpers';
import type {
  RelationRecord,
  RelationListFilters,
  EntityTypedRelations
} from '@arch-register/api-types/relationContract';

const dbErrorMessages = {
  foreign: 'Relation endpoints or schema could not be resolved'
} as const;

const checker = new PermissionChecker();

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
      const { items, total } = await db.relation.listRelations(
        ws,
        {
          schemaId: filters.schemaId ?? null,
          inEntityId: filters.inEntityId ?? null,
          outEntityId: filters.outEntityId ?? null
        },
        pagination
      );
      const schemas = await db.relation.listRelationSchemas(ws);
      const schemaById = new Map(schemas.map(schema => [schema.id, schema]));
      return {
        items: items.map(row => {
          const schema = schemaById.get(row.schema_id);
          return toRedactedApiRelation(row, authCtx, schema);
        }),
        total
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
        changes: { new: flattenRelationAuditFields(row) }
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
        flattenRelationAuditFields(row)
      );
      await logAudit(db, {
        userId: authCtx.userId,
        workspace: ws,
        operation: 'update',
        entityType: 'relation',
        entityId: id,
        entityName: `${row.in_entity_name} → ${row.out_entity_name}`,
        schemaId: row.schema_id,
        changes
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
        changes: { old: flattenRelationAuditFields(row) }
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
        outgoing: outgoing.filter(row => isEntityVisible(row.out_entity_id)).map(toRecord),
        incoming: incoming.filter(row => isEntityVisible(row.in_entity_id)).map(toRecord)
      };
    }
  );
};
