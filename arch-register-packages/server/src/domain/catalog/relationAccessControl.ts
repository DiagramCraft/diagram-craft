import { PermissionChecker, type WorkspaceAuthorizationContext } from '@arch-register/permissions';
import type { TypedRelationField } from '@arch-register/api-types/schemaContract';
import type { SchemaDbResult } from './db/catalogDatabase';
import {
  isFieldEditRestricted,
  isFieldViewRestricted,
  requireNoRestrictedFieldWrites
} from '../auth/fieldGroupAccessControl';
import type { FieldGroupSchemaShape } from '../auth/fieldGroupAccessControl';
import { httpAssert } from '../../utils/httpAssert';

export type RelationEndpointDirection = 'in' | 'out';

// This is deliberately an explicit list rather than an "all" sentinel. An "all" branch would
// also admit relation rows whose endpoint entity refers to a schema that is no longer present in
// the workspace catalog.
export type TypedRelationVisibilityEndpointScope = readonly string[];

export type TypedRelationVisibilityPolicy = {
  /** Entity schema ids currently present in the workspace catalog. */
  entitySchemaIds: readonly string[];
  endpointScopes: readonly {
    relationSchemaId: string;
    inEntitySchemaIds: TypedRelationVisibilityEndpointScope;
    outEntitySchemaIds: TypedRelationVisibilityEndpointScope;
  }[];
  ownerIds: readonly string[];
  allOwners: boolean;
};

const checker = new PermissionChecker();

/**
 * Compiles the endpoint field-group rules into a small SQL-friendly policy. The query compiler
 * applies this policy against relation rows and their endpoint schema ids, avoiding the previous
 * workspace-wide relation scan and id-list materialization.
 */
export const buildTypedRelationVisibilityPolicy = (
  authCtx: WorkspaceAuthorizationContext | null,
  entitySchemas: Iterable<SchemaDbResult>,
  relationSchemas: Iterable<{ id: string }>
): TypedRelationVisibilityPolicy | undefined => {
  if (authCtx == null) return undefined;

  const schemas = [...entitySchemas];
  const relationSchemaIds = [...relationSchemas].map(schema => schema.id);
  const allOwners = checker.hasRelationOwnerAction(authCtx, { owner: null }, 'view_relation');
  const ownerIds = allOwners
    ? []
    : [...authCtx.teamIds].filter(teamId =>
        checker.hasRelationOwnerAction(authCtx, { owner: teamId }, 'view_relation')
      );

  const endpointScope = (
    relationSchemaId: string,
    direction: RelationEndpointDirection
  ): TypedRelationVisibilityEndpointScope => {
    const allowedSchemaIds = schemas
      .filter(schema =>
        canViewTypedRelationFromEndpoint(authCtx, schema, relationSchemaId, direction)
      )
      .map(schema => schema.id);
    return allowedSchemaIds;
  };

  return {
    entitySchemaIds: schemas.map(schema => schema.id),
    endpointScopes: relationSchemaIds.map(relationSchemaId => ({
      relationSchemaId,
      inEntitySchemaIds: endpointScope(relationSchemaId, 'in'),
      outEntitySchemaIds: endpointScope(relationSchemaId, 'out')
    })),
    ownerIds,
    allOwners
  };
};

/**
 * Relations have their own `owner`/`lifecycle` fields (#2708), but no containment hierarchy to
 * walk — so relation authorization only ever uses the "direct owner" half of
 * `PermissionChecker`'s model (see `PermissionChecker.hasRelationOwnerAction` in
 * arch-register-packages/permissions/src/PermissionChecker.ts), never ancestor/descendant
 * propagation, and deliberately excludes the general workspace-capability branch of
 * `hasRelationPermission`/`getRelationActions` — every caller reaching these checks has already
 * passed a `requireWorkspaceCapability('ent.edit')` gate, so composing with that branch here
 * would trivially satisfy the OR for anyone and defeat the endpoint-based field-group
 * restriction below. Only a resource-level grant (owner team or global admin) can override that
 * restriction — a user can view/edit a relation if either the endpoint check or the relation's
 * own owner-team role grants it.
 */

type TypedRelationOwnerField = {
  id: string;
  type: 'typedRelation';
  relationSchemaId: string;
  direction: RelationEndpointDirection;
};

const isTypedRelationOwnerField = (
  field: FieldGroupSchemaShape['fields'][number]
): field is FieldGroupSchemaShape['fields'][number] & TypedRelationOwnerField =>
  field.type === 'typedRelation' &&
  typeof field.relationSchemaId === 'string' &&
  (field.direction === 'in' || field.direction === 'out');

const matchingOwnerFields = (
  schema: FieldGroupSchemaShape | null | undefined,
  relationSchemaId: string,
  direction: RelationEndpointDirection
): TypedRelationOwnerField[] | null => {
  const fields = schema?.fields ?? [];
  if (fields.some(field => field.type === 'typedRelation' && !isTypedRelationOwnerField(field))) {
    return null;
  }
  return fields
    .filter(isTypedRelationOwnerField)
    .filter(field => field.relationSchemaId === relationSchemaId && field.direction === direction);
};

/**
 * Returns whether a relation can be surfaced through an endpoint. Multiple bindings for the
 * same relation schema use OR semantics: one accessible binding is enough to expose the edge.
 * A missing endpoint schema is not an unbound endpoint: authenticated callers cannot use it to
 * surface a relation because there is no trustworthy owner-field definition to authorize.
 */
export const canViewTypedRelationFromEndpoint = (
  authCtx: WorkspaceAuthorizationContext | null,
  schema: FieldGroupSchemaShape | null | undefined,
  relationSchemaId: string,
  direction: RelationEndpointDirection
) => {
  // null auth contexts are internal/system callers and retain the existing bypass semantics.
  // External callers must fail closed when the endpoint schema has disappeared or is unavailable.
  if (!schema) return authCtx == null;
  const fields = matchingOwnerFields(schema, relationSchemaId, direction);
  if (!fields) return authCtx == null;
  return (
    fields.length === 0 || fields.some(field => !isFieldViewRestricted(authCtx, schema, field.id))
  );
};

/** Same as canViewTypedRelationFromEndpoint, but for writes. */
export const canEditTypedRelationFromEndpoint = (
  authCtx: WorkspaceAuthorizationContext | null,
  schema: FieldGroupSchemaShape | null | undefined,
  relationSchemaId: string,
  direction: RelationEndpointDirection
) => {
  const fields = matchingOwnerFields(schema, relationSchemaId, direction);
  if (!fields) return authCtx == null;
  return (
    fields.length === 0 || fields.some(field => !isFieldEditRestricted(authCtx, schema, field.id))
  );
};

/**
 * Endpoint-agnostic relation APIs use OR semantics across both endpoint bindings, plus the
 * relation's own owner-team role when `owner` is supplied (omit/null for call sites that don't
 * have a relation row in scope — this is a widening-only addition, never narrows access below
 * what the endpoint checks alone would already allow).
 */
export const canViewTypedRelation = (
  authCtx: WorkspaceAuthorizationContext | null,
  endpoints: Array<{
    schema: FieldGroupSchemaShape | null | undefined;
    direction: RelationEndpointDirection;
  }>,
  relationSchemaId: string,
  owner: string | null = null
) => {
  // Endpoint-specific access correctly fails closed for an unavailable schema. Preserve that
  // invariant across endpoint-agnostic access: a known, unbound endpoint must not make a relation
  // visible when its other endpoint has no schema definition to authorize against. This guard also
  // runs before relation-owner overrides, which do not provide a trustworthy endpoint definition.
  if (authCtx != null && endpoints.some(endpoint => !endpoint.schema)) return false;

  return (
    endpoints.some(endpoint =>
      canViewTypedRelationFromEndpoint(
        authCtx,
        endpoint.schema,
        relationSchemaId,
        endpoint.direction
      )
    ) ||
    (authCtx != null && checker.hasRelationOwnerAction(authCtx, { owner }, 'view_relation'))
  );
};

export const canEditTypedRelation = (
  authCtx: WorkspaceAuthorizationContext | null,
  endpoints: Array<{
    schema: FieldGroupSchemaShape | null | undefined;
    direction: RelationEndpointDirection;
  }>,
  relationSchemaId: string,
  owner: string | null = null
) =>
  endpoints.some(endpoint =>
    canEditTypedRelationFromEndpoint(authCtx, endpoint.schema, relationSchemaId, endpoint.direction)
  ) ||
  (authCtx != null && checker.hasRelationOwnerAction(authCtx, { owner }, 'edit_relation'));

/** Enforces the exact owner field selected by an inline entity mutation. */
export const requireTypedRelationFieldEdit = (
  authCtx: WorkspaceAuthorizationContext | null,
  schema: SchemaDbResult,
  field: TypedRelationField
) => {
  if (!authCtx) return;
  requireNoRestrictedFieldWrites(
    authCtx,
    schema,
    [field.id],
    `You do not have permission to edit the restricted field '${field.name}'`
  );
};

export const requireTypedRelationEdit = (
  authCtx: WorkspaceAuthorizationContext,
  endpoints: Array<{
    schema: SchemaDbResult | null | undefined;
    direction: RelationEndpointDirection;
  }>,
  relationSchemaId: string,
  owner: string | null = null
) => {
  if (canEditTypedRelation(authCtx, endpoints, relationSchemaId, owner)) return;
  httpAssert.true(false, {
    status: 403,
    statusText: 'Forbidden',
    message: 'You do not have permission to edit the typed relation through any of its owner fields'
  });
};
