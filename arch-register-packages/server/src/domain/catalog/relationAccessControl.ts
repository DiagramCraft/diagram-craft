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

const checker = new PermissionChecker();

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

const matchingOwnerFields = (
  schema: FieldGroupSchemaShape | null | undefined,
  relationSchemaId: string,
  direction: RelationEndpointDirection
): TypedRelationField[] =>
  (schema?.fields ?? []).filter(field => {
    const candidate = field as unknown as Record<string, unknown>;
    return (
      candidate['type'] === 'typedRelation' &&
      candidate['relationSchemaId'] === relationSchemaId &&
      candidate['direction'] === direction
    );
  }) as unknown as TypedRelationField[];

/**
 * Returns whether a relation can be surfaced through an endpoint. Multiple bindings for the
 * same relation schema use OR semantics: one accessible binding is enough to expose the edge.
 * An unbound endpoint retains the legacy relation-schema-only behavior.
 */
export const canViewTypedRelationFromEndpoint = (
  authCtx: WorkspaceAuthorizationContext | null,
  schema: FieldGroupSchemaShape | null | undefined,
  relationSchemaId: string,
  direction: RelationEndpointDirection
) => {
  const fields = matchingOwnerFields(schema, relationSchemaId, direction);
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
) =>
  endpoints.some(endpoint =>
    canViewTypedRelationFromEndpoint(authCtx, endpoint.schema, relationSchemaId, endpoint.direction)
  ) ||
  (authCtx != null && checker.hasRelationOwnerAction(authCtx, { owner }, 'view_relation'));

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
