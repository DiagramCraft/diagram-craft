import { randomUUID } from 'node:crypto';
import type { DatabaseAdapter } from '../../db/database';
import type { AuthorizationContext } from '@arch-register/permissions';
import { httpAssert } from '../../utils/httpAssert';
import { logAudit, computeChanges } from '../audit/db/auditLogging';
import { requireNoRestrictedFieldWrites } from '../auth/fieldGroupAccessControl';
import {
  flattenRelationAuditFields,
  toApiRelation,
  validateRelationEndpoints
} from './relationHelpers';
import type { TypedRelationField } from '@arch-register/api-types/schemaContract';
import type { RelationFieldDelta } from '@arch-register/api-types/entityContract';
import type { RelationRecord } from '@arch-register/api-types/relationContract';

export type RelationMutationActor = { id: string; displayName: string | null };

/**
 * Applies one typedRelation field's create/update/delete delta as part of the owning entity's
 * mutation, in the same transaction. Reuses the same endpoint/field-group validation as the
 * standalone `/relations` endpoints (relationOperations.ts) so the two paths cannot drift.
 */
export const applyRelationFieldDelta = async (
  db: DatabaseAdapter,
  params: {
    workspace: string;
    ownerEntityId: string;
    field: TypedRelationField;
    delta: RelationFieldDelta;
    authCtx: AuthorizationContext | null;
    actor: RelationMutationActor;
  }
): Promise<RelationRecord[]> => {
  const { workspace, ownerEntityId, field, delta, authCtx, actor } = params;
  const schema = await db.relation.getRelationSchema(workspace, field.relationSchemaId);
  httpAssert.present(schema, {
    status: 404,
    message: `Relation schema '${field.relationSchemaId}' not found`
  });

  const results: RelationRecord[] = [];

  for (const draft of delta.create ?? []) {
    const inEntityId = field.direction === 'in' ? ownerEntityId : draft.otherEntityId;
    const outEntityId = field.direction === 'out' ? ownerEntityId : draft.otherEntityId;

    const [inEntity, outEntity] = await Promise.all([
      db.catalog.getEntity(workspace, inEntityId),
      db.catalog.getEntity(workspace, outEntityId)
    ]);
    validateRelationEndpoints(schema, inEntity, outEntity);

    if (authCtx) requireNoRestrictedFieldWrites(authCtx, schema, Object.keys(draft.data));

    const timestamp = new Date();
    const row = await db.relation.createRelation({
      id: randomUUID(),
      workspace,
      schema_id: schema.id,
      in_entity_id: inEntity!.id,
      out_entity_id: outEntity!.id,
      data: draft.data,
      created_at: timestamp,
      updated_at: timestamp
    });

    await logAudit(db, {
      userId: actor.id,
      userDisplayName: actor.displayName,
      workspace,
      operation: 'create',
      entityType: 'relation',
      entityId: row.id,
      entityName: `${row.in_entity_name} → ${row.out_entity_name}`,
      schemaId: row.schema_id,
      changes: { new: flattenRelationAuditFields(row) }
    });

    results.push(toApiRelation(row));
  }

  for (const update of delta.update ?? []) {
    const oldRow = await db.relation.getRelation(workspace, update.id);
    httpAssert.present(oldRow, { status: 404, message: `Relation '${update.id}' not found` });
    httpAssert.true(oldRow.schema_id === field.relationSchemaId, {
      status: 400,
      message: `Relation '${update.id}' does not belong to relation schema '${field.relationSchemaId}'`
    });
    const ownerEndpointId = field.direction === 'in' ? oldRow.in_entity_id : oldRow.out_entity_id;
    httpAssert.true(ownerEndpointId === ownerEntityId, {
      status: 400,
      message: `Relation '${update.id}' is not connected to this entity`
    });

    const changedFieldIds = Object.keys(update.data).filter(
      key => JSON.stringify(oldRow.data[key] ?? null) !== JSON.stringify(update.data[key] ?? null)
    );
    if (authCtx) requireNoRestrictedFieldWrites(authCtx, schema, changedFieldIds);

    const nextData = { ...oldRow.data, ...update.data };
    const timestamp = new Date();
    const row = await db.relation.updateRelation(workspace, update.id, {
      data: nextData,
      version: oldRow.version + 1,
      updated_at: timestamp
    });
    httpAssert.present(row, { status: 404, message: `Relation '${update.id}' not found` });

    await logAudit(db, {
      userId: actor.id,
      userDisplayName: actor.displayName,
      workspace,
      operation: 'update',
      entityType: 'relation',
      entityId: update.id,
      entityName: `${row.in_entity_name} → ${row.out_entity_name}`,
      schemaId: row.schema_id,
      changes: computeChanges(flattenRelationAuditFields(oldRow), flattenRelationAuditFields(row))
    });

    results.push(toApiRelation(row));
  }

  for (const id of delta.delete ?? []) {
    const oldRow = await db.relation.getRelation(workspace, id);
    httpAssert.present(oldRow, { status: 404, message: `Relation '${id}' not found` });
    httpAssert.true(oldRow.schema_id === field.relationSchemaId, {
      status: 400,
      message: `Relation '${id}' does not belong to relation schema '${field.relationSchemaId}'`
    });
    const ownerEndpointId = field.direction === 'in' ? oldRow.in_entity_id : oldRow.out_entity_id;
    httpAssert.true(ownerEndpointId === ownerEntityId, {
      status: 400,
      message: `Relation '${id}' is not connected to this entity`
    });

    await db.relation.deleteRelation(workspace, id);

    await logAudit(db, {
      userId: actor.id,
      userDisplayName: actor.displayName,
      workspace,
      operation: 'delete',
      entityType: 'relation',
      entityId: id,
      entityName: `${oldRow.in_entity_name} → ${oldRow.out_entity_name}`,
      schemaId: oldRow.schema_id,
      changes: { old: flattenRelationAuditFields(oldRow) }
    });
  }

  return results;
};
