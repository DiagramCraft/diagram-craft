import type { RelationDbResult } from './db/relationDatabase';
import type { RelationSchemaDbResult, RelationSchemaVersionDbResult } from './db/relationDatabase';
import type { RelationRecord } from '@arch-register/api-types/relationContract';
import { PermissionChecker, type WorkspaceAuthorizationContext } from '@arch-register/permissions';
import type { DatabaseAdapter } from '../../db/database';
import { httpAssert } from '../../utils/httpAssert';
import { filterRestrictedFieldGroups } from '../auth/fieldGroupAccessControl';
import { requireTypedRelationEdit } from './relationAccessControl';

const checker = new PermissionChecker();

/**
 * Resolves a relation's endpoint entities' schemas, needed by requireTypedRelationEdit's
 * OR-across-endpoints permission model. Shared by every surface that needs to authorize editing
 * an *existing* relation instance without already having its owner schemas to hand (relationOperations.ts
 * has its own copy fetched inline where it already has other schema lookups in flight; this one is
 * for callers — changeCaseOperations.ts, relationChangeOperations.ts — that don't).
 */
export const getRelationOwnerSchemas = async (
  db: DatabaseAdapter,
  workspace: string,
  relation: { in_entity_id: string; out_entity_id: string }
) => {
  const [inEntity, outEntity, schemas] = await Promise.all([
    db.catalog.getEntity(workspace, relation.in_entity_id),
    db.catalog.getEntity(workspace, relation.out_entity_id),
    db.catalog.listSchemas(workspace)
  ]);
  const schemaById = new Map(schemas.map(schema => [schema.id, schema]));
  return {
    inSchema: inEntity ? schemaById.get(inEntity.schema_id) : undefined,
    outSchema: outEntity ? schemaById.get(outEntity.schema_id) : undefined
  };
};

/**
 * Relation endpoints are immutable outside a proposal too (see the endpoint-immutability
 * regression tests in relationOperations.test.ts) — delete-and-recreate is the only supported way
 * to re-point a relation. Both change-case surfaces (the single-relation approval workflow in
 * relationChangeOperations.ts and the multi-record planned-change workflow in
 * changeCaseOperations.ts) build their proposed state from an arbitrary caller-supplied
 * `proposedState` object, so both need this same guard — otherwise an endpoint change is either
 * silently dropped or silently applied depending on which surface reads it.
 */
export const assertRelationProposalEndpointsUnchanged = (
  relation: { in_entity_id: string; out_entity_id: string },
  proposedState: Record<string, unknown>
) => {
  const proposedInEntityId = String(proposedState['in_entity_id'] ?? relation.in_entity_id);
  const proposedOutEntityId = String(proposedState['out_entity_id'] ?? relation.out_entity_id);
  httpAssert.true(
    proposedInEntityId === relation.in_entity_id && proposedOutEntityId === relation.out_entity_id,
    {
      status: 400,
      message: 'Changing a relation endpoint is not supported by a relation change proposal'
    }
  );
};

export const requireRelationCaseMemberEditAccess = async (
  db: DatabaseAdapter,
  workspace: string,
  authCtx: WorkspaceAuthorizationContext,
  relation: RelationDbResult
) => {
  const { inSchema, outSchema } = await getRelationOwnerSchemas(db, workspace, relation);
  requireTypedRelationEdit(
    authCtx,
    [
      { schema: inSchema, direction: 'in' },
      { schema: outSchema, direction: 'out' }
    ],
    relation.schema_id,
    relation.owner
  );
};

/**
 * Resolves the relation schema (and, for a given version's created_at, the relation_schema_version
 * that was live at that time) so version redaction can apply the field-group ACL that actually
 * applied when the version was recorded — mirroring entityVersionOrpc.ts's
 * createVersionSchemaResolver, simplified because a relation's schema_id never changes after
 * creation (RelationDbUpdate has no schema_id field), unlike an entity's.
 */
export const createRelationVersionSchemaResolver = (db: DatabaseAdapter, workspace: string) => {
  const lookups = new Map<
    string,
    Promise<{
      schema: RelationSchemaDbResult | null;
      schemaVersions: RelationSchemaVersionDbResult[];
    }>
  >();

  const getSchemaLookup = (schemaId: string) => {
    const existing = lookups.get(schemaId);
    if (existing) return existing;
    const lookup = Promise.all([
      db.relation.getRelationSchema(workspace, schemaId),
      db.relation.listRelationSchemaVersions(workspace, schemaId)
    ]).then(([schema, schemaVersions]) => ({ schema, schemaVersions }));
    lookups.set(schemaId, lookup);
    return lookup;
  };

  return async (
    version: { state: Record<string, unknown>; created_at: Date },
    fallbackSchemaId?: string
  ) => {
    const schemaId = String(version.state['schema_id'] ?? fallbackSchemaId ?? '');
    const { schema, schemaVersions } = schemaId
      ? await getSchemaLookup(schemaId)
      : { schema: null, schemaVersions: [] as RelationSchemaVersionDbResult[] };

    const historicalSchema =
      [...schemaVersions]
        .filter(schemaVersion => schemaVersion.created_at <= version.created_at)
        .sort((left, right) => right.created_at.getTime() - left.created_at.getTime())[0] ?? null;

    return { schema, historicalSchema };
  };
};

/** Reserved (underscore-prefixed) keys are metadata; everything else is relation field data. */
export const extractRelationFieldData = (body: Record<string, unknown>): Record<string, unknown> =>
  Object.fromEntries(Object.entries(body).filter(([key]) => !key.startsWith('_')));

/** Normalizes a relation's `_owner`/`_lifecycle` mutation input (id string or `{ id }` object) to
 *  a plain id, mirroring dataHelpers.ts's extractId for the analogous entity mutation fields. */
export const extractRelationOwnerOrLifecycleId = (value: unknown): string | null => {
  if (typeof value === 'string') return value.trim() === '' ? null : value;
  if (
    value != null &&
    typeof value === 'object' &&
    'id' in value &&
    typeof (value as Record<string, unknown>)['id'] === 'string'
  ) {
    return (value as Record<string, unknown>)['id'] as string;
  }
  return null;
};

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

/**
 * Mirrors `entityRequiresApproval` (entityChangeOperations.ts): an instance-level override always
 * wins; absent an override, the schema's policy decides. Relation schemas/instances already carry
 * `relation_approval_policy`/`approval_policy_override` (same columns as entities), but until this
 * fix the columns were only half-consulted — see `assertRelationMutationsSupported` below.
 */
export const relationRequiresApproval = (
  schema: { relation_approval_policy?: 'required' | 'disabled' },
  relation: { approval_policy_override: 'required' | 'disabled' | null }
) =>
  relation.approval_policy_override === 'required' ||
  (relation.approval_policy_override !== 'disabled' &&
    (schema.relation_approval_policy ?? 'disabled') === 'required');

/**
 * Gates direct edits to an *existing* relation instance the same way `entityRequiresApproval`
 * gates entity update/restore (entityMutationOperations.ts, entityVersionOrpc.ts) — create and
 * delete are deliberately never gated here either, matching entity semantics: creating something
 * new has no prior approved state to protect, and deleting doesn't either. Change-case/proposal
 * support for relations (#2693) is still not implemented — today this only blocks a direct edit,
 * it does not offer a proposal path, same as it did before this fix.
 */
export const assertRelationMutationsSupported = (
  schema: RelationSchemaDbResult,
  relation: { approval_policy_override: 'required' | 'disabled' | null }
) => {
  httpAssert.true(!relationRequiresApproval(schema, relation), {
    status: 409,
    statusText: 'Conflict',
    message: 'This relation instance requires an approved change proposal before it can be edited'
  });
};

/**
 * Snapshot of relation instance state written to record_version on create/update, mirroring
 * `entityToBaseState` (entityMutations.ts). Endpoint ids are part of a relation's identity (there
 * is no slug/namespace/name to snapshot instead).
 */
export const relationToBaseState = (row: RelationDbResult): Record<string, unknown> => ({
  id: row.id,
  workspace: row.workspace,
  schema_id: row.schema_id,
  in_entity_id: row.in_entity_id,
  out_entity_id: row.out_entity_id,
  data: row.data,
  owner: row.owner,
  lifecycle: row.lifecycle,
  version: row.version,
  approval_policy_override: row.approval_policy_override,
  created_at: row.created_at,
  updated_at: row.updated_at
});

/** Flattens relation field data to top level for audit logging, mirroring `flattenEntityAuditFields`. */
export const flattenRelationAuditFields = (row: RelationDbResult): Record<string, unknown> => ({
  _schemaId: row.schema_id,
  _inEntityId: row.in_entity_id,
  _outEntityId: row.out_entity_id,
  _owner: row.owner,
  _lifecycle: row.lifecycle,
  ...row.data
});

/** Stable relation identity used by asynchronous audit consumers, including deleted relations. */
export type RelationAuditContext = {
  id: string;
  schema: { id: string; name: string };
  in: { id: string; name: string };
  out: { id: string; name: string };
};

export const relationAuditContext = (row: RelationDbResult): RelationAuditContext => ({
  id: row.id,
  schema: { id: row.schema_id, name: row.schema_name },
  in: { id: row.in_entity_id, name: row.in_entity_name },
  out: { id: row.out_entity_id, name: row.out_entity_name }
});

export const toApiRelation = (
  row: RelationDbResult,
  authCtx: WorkspaceAuthorizationContext | null = null
): RelationRecord => ({
  _uid: row.id,
  _schema: { id: row.schema_id, name: row.schema_name },
  _in: { id: row.in_entity_id, name: row.in_entity_name },
  _out: { id: row.out_entity_id, name: row.out_entity_name },
  _owner: row.owner ? { id: row.owner, name: row.owner_name ?? row.owner } : null,
  _lifecycle: row.lifecycle
    ? { id: row.lifecycle, name: row.lifecycle_label ?? row.lifecycle }
    : null,
  _version: row.version,
  _createdAt: row.created_at.toISOString(),
  _updatedAt: row.updated_at.toISOString(),
  // canView/canEdit/canDelete stay permissive placeholders (fine-grained per-relation-instance
  // ACL mirroring entity_grant is not in scope for #2569) — access is actually governed by the
  // workspace-level 'ent.edit'/'ws.view' capabilities checked in relationOperations.ts, plus
  // field-group access control on individual fields. canAdmin is new with #2708 and can be
  // computed directly from the relation's own owner team, mirroring getEntityCapabilities.
  canView: true,
  canEdit: true,
  canDelete: true,
  canAdmin: authCtx == null || checker.hasRelationPermission(authCtx, row, 'admin_relation'),
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
  toApiRelation(
    {
      ...row,
      data: filterRelationFieldData(authCtx, schema, row.data)
    },
    authCtx
  );
