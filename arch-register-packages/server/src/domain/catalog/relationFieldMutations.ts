import { randomUUID } from 'node:crypto';
import type { DatabaseAdapter } from '../../db/database';
import { PermissionChecker, type AuthorizationContext } from '@arch-register/permissions';
import { httpAssert } from '../../utils/httpAssert';
import { requireNoRestrictedFieldWrites } from '../auth/fieldGroupAccessControl';
import { assertNoDerivedFieldWrites } from '../derived/derivedFields';
import {
  extractRelationOwnerOrLifecycleId,
  assertRelationMutationsSupported,
  toRedactedApiRelation,
  validateRelationEndpoints,
  assertTypedRelationCardinality,
  type TypedRelationCardinalityChange
} from './relationHelpers';
import { requireTypedRelationEdit, requireTypedRelationFieldEdit } from './relationAccessControl';
import {
  createRelationWithAudit,
  deleteRelationWithAudit,
  updateRelationWithAudit
} from './relationMutations';
import type { TypedRelationField } from '@arch-register/api-types/schemaContract';
import type { RelationFieldDelta } from '@arch-register/api-types/entityContract';
import type { RelationRecord } from '@arch-register/api-types/relationContract';
import type { SchemaDbResult } from './db/catalogDatabase';
import type { RelationSchemaDbResult } from './db/relationDatabase';

export type RelationMutationActor = { id: string; displayName: string | null };

const checker = new PermissionChecker();

type RelationFieldCardinalityParams = {
  workspace: string;
  ownerEntityId: string;
  field: TypedRelationField;
  delta: RelationFieldDelta;
};

const resolveRelationFieldCardinalityChangesWithSchema = async (
  db: DatabaseAdapter,
  params: RelationFieldCardinalityParams,
  schema: RelationSchemaDbResult
): Promise<TypedRelationCardinalityChange[]> => {
  const { workspace, ownerEntityId, field, delta } = params;
  const changes: TypedRelationCardinalityChange[] = [];

  for (const draft of delta.create ?? []) {
    const inEntityId = field.direction === 'in' ? ownerEntityId : draft.otherEntityId;
    const outEntityId = field.direction === 'out' ? ownerEntityId : draft.otherEntityId;
    const [inEntity, outEntity] = await Promise.all([
      db.catalog.getEntity(workspace, inEntityId),
      db.catalog.getEntity(workspace, outEntityId)
    ]);
    validateRelationEndpoints(schema, inEntity, outEntity);
    changes.push({
      relationSchemaId: field.relationSchemaId,
      inEntityId,
      outEntityId,
      delta: 1
    });
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
    changes.push({
      relationSchemaId: oldRow.schema_id,
      inEntityId: oldRow.in_entity_id,
      outEntityId: oldRow.out_entity_id,
      delta: -1
    });
  }

  return changes;
};

/** Resolves the endpoint deltas for one typedRelation field before any rows are written. */
export const resolveTypedRelationFieldCardinalityChanges = async (
  db: DatabaseAdapter,
  params: RelationFieldCardinalityParams
): Promise<TypedRelationCardinalityChange[]> => {
  const schema = await db.relation.getRelationSchema(
    params.workspace,
    params.field.relationSchemaId
  );
  httpAssert.present(schema, {
    status: 404,
    message: `Relation schema '${params.field.relationSchemaId}' not found`
  });
  return resolveRelationFieldCardinalityChangesWithSchema(db, params, schema);
};

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
    unbound?: boolean;
    skipTypedRelationCardinalityValidation?: boolean;
  }
): Promise<RelationRecord[]> => {
  const {
    workspace,
    ownerEntityId,
    ownerSchema,
    field,
    delta,
    authCtx,
    actor,
    unbound = false,
    skipTypedRelationCardinalityValidation = false
  } = params;
  if (unbound) {
    if (authCtx) {
      requireTypedRelationEdit(
        authCtx,
        [{ schema: ownerSchema, direction: field.direction }],
        field.relationSchemaId
      );
    }
  } else {
    requireTypedRelationFieldEdit(authCtx, ownerSchema, field);
  }
  const schema = await db.relation.getRelationSchema(workspace, field.relationSchemaId);
  httpAssert.present(schema, {
    status: 404,
    message: `Relation schema '${field.relationSchemaId}' not found`
  });

  if (!skipTypedRelationCardinalityValidation) {
    const changes = await resolveRelationFieldCardinalityChangesWithSchema(
      db,
      { workspace, ownerEntityId, field, delta },
      schema
    );
    await assertTypedRelationCardinality(db, workspace, changes);
  }
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

    assertNoDerivedFieldWrites(schema.fields, createFieldData);
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
    const row = await createRelationWithAudit(db, {
      workspace,
      actor,
      relation: {
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
      },
      skipTypedRelationCardinalityValidation: true
    });

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

    assertNoDerivedFieldWrites(schema.fields, fieldData);
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
    const row = await updateRelationWithAudit(db, {
      workspace,
      relationId: update.id,
      previous: oldRow,
      next: {
        data: nextData,
        owner: nextOwner,
        lifecycle: nextLifecycle,
        version: oldRow.version + 1,
        updated_at: timestamp
      },
      actor
    });
    httpAssert.present(row, { status: 404, message: `Relation '${update.id}' not found` });

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

    const existingVersions = await db.catalog.listEntityVersions(workspace, id);
    const nextVersionNumber =
      existingVersions.reduce((max, v) => Math.max(max, v.version_number), 0) + 1;
    await deleteRelationWithAudit(db, {
      workspace,
      relation: oldRow,
      actor,
      versionNumber: nextVersionNumber,
      skipTypedRelationCardinalityValidation: true
    });
  }

  return results;
};
