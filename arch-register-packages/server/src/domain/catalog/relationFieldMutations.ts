import { randomUUID } from 'node:crypto';
import type { DatabaseAdapter } from '../../db/database';
import { PermissionChecker, type AuthorizationContext } from '@arch-register/permissions';
import { httpAssert } from '../../utils/httpAssert';
import { logAudit, computeChanges } from '../audit/db/auditLogging';
import { requireNoRestrictedFieldWrites } from '../auth/fieldGroupAccessControl';
import {
  extractRelationOwnerOrLifecycleId,
  flattenRelationAuditFields,
  assertRelationMutationsSupported,
  toRedactedApiRelation,
  validateRelationEndpoints,
  relationAuditContext,
  relationToBaseState
} from './relationHelpers';
import { requireTypedRelationFieldEdit } from './relationAccessControl';
import { RELATION_AUTOSAVE_KEEP_COUNT } from './relationOperations';
import type { TypedRelationField } from '@arch-register/api-types/schemaContract';
import type { RelationFieldDelta } from '@arch-register/api-types/entityContract';
import type { RelationRecord } from '@arch-register/api-types/relationContract';
import type { SchemaDbResult } from './db/catalogDatabase';

export type RelationMutationActor = { id: string; displayName: string | null };

const checker = new PermissionChecker();

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
    ownerSchema: SchemaDbResult;
    field: TypedRelationField;
    delta: RelationFieldDelta;
    authCtx: AuthorizationContext | null;
    actor: RelationMutationActor;
  }
): Promise<RelationRecord[]> => {
  const { workspace, ownerEntityId, ownerSchema, field, delta, authCtx, actor } = params;
  requireTypedRelationFieldEdit(authCtx, ownerSchema, field);
  const schema = await db.relation.getRelationSchema(workspace, field.relationSchemaId);
  httpAssert.present(schema, {
    status: 404,
    message: `Relation schema '${field.relationSchemaId}' not found`
  });
  // Only updates to an *existing* relation are gated on approval policy, mirroring the standalone
  // /relations endpoints (relationOperations.ts) — create/delete are never gated.

  const results: RelationRecord[] = [];

  for (const draft of delta.create ?? []) {
    const inEntityId = field.direction === 'in' ? ownerEntityId : draft.otherEntityId;
    const outEntityId = field.direction === 'out' ? ownerEntityId : draft.otherEntityId;

    const [inEntity, outEntity] = await Promise.all([
      db.catalog.getEntity(workspace, inEntityId),
      db.catalog.getEntity(workspace, outEntityId)
    ]);
    validateRelationEndpoints(schema, inEntity, outEntity);

    // `_owner`/`_lifecycle` are reserved metadata keys, not schema field data — same convention
    // as extractRelationFieldData for the standalone /relations endpoints.
    const {
      _owner: createOwnerRaw,
      _lifecycle: createLifecycleRaw,
      ...createFieldData
    } = draft.data;

    if (authCtx) requireNoRestrictedFieldWrites(authCtx, schema, Object.keys(createFieldData));

    // Default-copy owner/lifecycle from the "in" entity, matching createWorkspaceRelation
    // (relationOperations.ts), unless the caller explicitly overrides one or both.
    const owner =
      '_owner' in draft.data ? extractRelationOwnerOrLifecycleId(createOwnerRaw) : inEntity!.owner;
    const lifecycle =
      '_lifecycle' in draft.data
        ? extractRelationOwnerOrLifecycleId(createLifecycleRaw)
        : inEntity!.lifecycle;
    if (authCtx && '_owner' in draft.data && owner !== inEntity!.owner) {
      httpAssert.true(checker.hasRelationPermission(authCtx, { owner }, 'admin_relation'), {
        status: 403,
        statusText: 'Forbidden',
        message: 'You do not have permission to assign this relation to the given owner'
      });
    }

    const timestamp = new Date();
    const row = await db.relation.createRelation({
      id: randomUUID(),
      workspace,
      schema_id: schema.id,
      in_entity_id: inEntity!.id,
      out_entity_id: outEntity!.id,
      data: createFieldData,
      owner,
      lifecycle,
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
      changes: { new: flattenRelationAuditFields(row) },
      metadata: { relation: relationAuditContext(row) }
    });

    await db.catalog.createEntityVersion({
      id: randomUUID(),
      workspace,
      entity_id: row.id,
      version_number: row.version,
      kind: 'autosave',
      commit_message: null,
      created_at: timestamp,
      created_by: actor.id,
      state: relationToBaseState(row),
      applied_case_revision_id: null
    });
    await db.catalog.pruneAutosaveVersions(workspace, row.id, RELATION_AUTOSAVE_KEEP_COUNT);

    results.push(toRedactedApiRelation(row, authCtx, schema));
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
    assertRelationMutationsSupported(schema, oldRow);

    // `_owner`/`_lifecycle` are reserved metadata keys, not schema field data — same convention
    // as extractRelationFieldData for the standalone /relations endpoints.
    const { _owner: ownerRaw, _lifecycle: lifecycleRaw, ...fieldData } = update.data;

    const changedFieldIds = Object.keys(fieldData).filter(
      key => JSON.stringify(oldRow.data[key] ?? null) !== JSON.stringify(fieldData[key] ?? null)
    );
    if (authCtx) requireNoRestrictedFieldWrites(authCtx, schema, changedFieldIds);

    const nextOwner =
      '_owner' in update.data ? extractRelationOwnerOrLifecycleId(ownerRaw) : undefined;
    const nextLifecycle =
      '_lifecycle' in update.data ? extractRelationOwnerOrLifecycleId(lifecycleRaw) : undefined;
    if (authCtx && nextOwner !== undefined && nextOwner !== oldRow.owner) {
      httpAssert.true(checker.hasRelationPermission(authCtx, oldRow, 'admin_relation'), {
        status: 403,
        statusText: 'Forbidden',
        message: 'You do not have permission to change ownership of this relation'
      });
    }

    const nextData = { ...oldRow.data, ...fieldData };
    const timestamp = new Date();
    const row = await db.relation.updateRelation(workspace, update.id, {
      data: nextData,
      owner: nextOwner,
      lifecycle: nextLifecycle,
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
      changes: computeChanges(flattenRelationAuditFields(oldRow), flattenRelationAuditFields(row), {
        alwaysInclude: ['_inEntityId', '_outEntityId']
      }),
      metadata: { relation: relationAuditContext(row) }
    });

    await db.catalog.createEntityVersion({
      id: randomUUID(),
      workspace,
      entity_id: row.id,
      version_number: row.version,
      kind: 'autosave',
      commit_message: null,
      created_at: timestamp,
      created_by: actor.id,
      state: relationToBaseState(row),
      applied_case_revision_id: null
    });
    await db.catalog.pruneAutosaveVersions(workspace, row.id, RELATION_AUTOSAVE_KEEP_COUNT);

    results.push(toRedactedApiRelation(row, authCtx, schema));
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
      changes: { old: flattenRelationAuditFields(oldRow) },
      metadata: { relation: relationAuditContext(oldRow) }
    });

    const existingVersions = await db.catalog.listEntityVersions(workspace, id);
    const nextVersionNumber =
      existingVersions.reduce((max, v) => Math.max(max, v.version_number), 0) + 1;
    await db.catalog.createEntityVersion({
      id: randomUUID(),
      workspace,
      entity_id: id,
      version_number: nextVersionNumber,
      kind: 'deleted',
      commit_message: null,
      created_at: new Date(),
      created_by: actor.id,
      state: relationToBaseState(oldRow),
      applied_case_revision_id: null
    });
  }

  return results;
};
