import type { RelationDbResult } from './db/relationDatabase';
import type { RelationSchemaDbResult } from './db/relationDatabase';
import type { RelationRecord } from '@arch-register/api-types/relationContract';
import type { WorkspaceAuthorizationContext } from '@arch-register/permissions';
import { httpAssert } from '../../utils/httpAssert';
import { filterRestrictedFieldGroups } from '../auth/fieldGroupAccessControl';

/** Reserved (underscore-prefixed) keys are metadata; everything else is relation field data. */
export const extractRelationFieldData = (body: Record<string, unknown>): Record<string, unknown> =>
  Object.fromEntries(Object.entries(body).filter(([key]) => !key.startsWith('_')));

/**
 * Validates that both endpoint entities exist in the workspace and match the relation schema's
 * `in`/`out` endpoint-set constraints, mirroring `normalizeEntityRelationFields` (dataHelpers.ts)
 * for generic reference/containment fields.
 */
export const validateRelationEndpoints = (
  schema: RelationSchemaDbResult,
  inEntity: { id: string; schema_id: string } | null,
  outEntity: { id: string; schema_id: string } | null
) => {
  httpAssert.present(inEntity, { status: 400, message: `"in" endpoint entity not found` });
  httpAssert.present(outEntity, { status: 400, message: `"out" endpoint entity not found` });
  httpAssert.true(schema.in_schema_ids.includes(inEntity.schema_id), {
    status: 400,
    message: `"in" endpoint entity's schema is not allowed by relation schema '${schema.name}' (allowed: ${schema.in_schema_ids.join(', ')})`
  });
  httpAssert.true(schema.out_schema_ids.includes(outEntity.schema_id), {
    status: 400,
    message: `"out" endpoint entity's schema is not allowed by relation schema '${schema.name}' (allowed: ${schema.out_schema_ids.join(', ')})`
  });
  httpAssert.true(inEntity.id !== outEntity.id, {
    status: 400,
    message: 'A relation cannot connect an entity to itself'
  });
};

/** Relation approval/version workflows are implemented separately in #2574. */
export const assertRelationMutationsSupported = (schema: RelationSchemaDbResult) => {
  httpAssert.true(schema.relation_approval_policy !== 'required', {
    status: 409,
    statusText: 'Conflict',
    message:
      'This relation schema requires an approved change proposal before relation instances can be edited'
  });
};

/** Flattens relation field data to top level for audit logging, mirroring `flattenEntityAuditFields`. */
export const flattenRelationAuditFields = (row: RelationDbResult): Record<string, unknown> => ({
  _schemaId: row.schema_id,
  _inEntityId: row.in_entity_id,
  _outEntityId: row.out_entity_id,
  ...row.data
});

export const toApiRelation = (row: RelationDbResult): RelationRecord => ({
  _uid: row.id,
  _schema: { id: row.schema_id, name: row.schema_name },
  _in: { id: row.in_entity_id, name: row.in_entity_name },
  _out: { id: row.out_entity_id, name: row.out_entity_name },
  _version: row.version,
  _createdAt: row.created_at.toISOString(),
  _updatedAt: row.updated_at.toISOString(),
  // Fine-grained per-relation-instance ACL (mirroring entity_grant) is not in scope for #2569;
  // access is currently governed only by the workspace-level 'ent.edit'/'ws.view' capabilities
  // checked in relationOperations.ts, plus field-group access control on individual fields.
  canView: true,
  canEdit: true,
  canDelete: true,
  ...row.data
});

/**
 * Redacts relation instance data for an external response.
 *
 * Relation instances can outlive their schema metadata in imported or historical data. In that
 * case there is no trustworthy field definition or ACL to apply, so fail closed and expose no
 * relation field values. For a known schema, only currently declared field ids are retained before
 * applying the normal field-group access rules; this also prevents removed/unknown keys from
 * bypassing redaction.
 */
export const filterRelationFieldData = (
  authCtx: WorkspaceAuthorizationContext | null,
  schema: RelationSchemaDbResult | null | undefined,
  data: Record<string, unknown>
): Record<string, unknown> => {
  if (!schema) return {};

  const fieldIds = new Set(schema.fields.map(field => field.id));
  const declaredData = Object.fromEntries(
    Object.entries(data).filter(([fieldId]) => fieldIds.has(fieldId))
  );
  return filterRestrictedFieldGroups(authCtx, schema, declaredData);
};

export const toRedactedApiRelation = (
  row: RelationDbResult,
  authCtx: WorkspaceAuthorizationContext | null,
  schema: RelationSchemaDbResult | null | undefined
): RelationRecord =>
  toApiRelation({
    ...row,
    data: filterRelationFieldData(authCtx, schema, row.data)
  });
