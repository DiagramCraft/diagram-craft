import type { WorkspaceAuthorizationContext } from '@arch-register/permissions';
import {
  isTypedRelationField,
  type TypedRelationField
} from '@arch-register/api-types/schemaContract';
import type { SchemaDbResult } from './db/catalogDatabase';
import {
  isFieldEditRestricted,
  isFieldViewRestricted,
  requireNoRestrictedFieldWrites
} from '../auth/fieldGroupAccessControl';
import type { FieldGroupSchemaShape } from '../auth/fieldGroupAccessControl';
import { httpAssert } from '../../utils/httpAssert';

export type RelationEndpointDirection = 'in' | 'out';

const matchingOwnerFields = (
  schema: FieldGroupSchemaShape | null | undefined,
  relationSchemaId: string,
  direction: RelationEndpointDirection
): TypedRelationField[] =>
  (schema?.fields ?? []).filter(
    (field): field is TypedRelationField =>
      isTypedRelationField(field) &&
      field.relationSchemaId === relationSchemaId &&
      field.direction === direction
  );

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
 * Endpoint-agnostic relation APIs use OR semantics across both endpoint bindings. This keeps
 * standalone relation access compatible with relation schemas that are surfaced by either side.
 */
export const canViewTypedRelation = (
  authCtx: WorkspaceAuthorizationContext | null,
  endpoints: Array<{
    schema: FieldGroupSchemaShape | null | undefined;
    direction: RelationEndpointDirection;
  }>,
  relationSchemaId: string
) =>
  endpoints.some(endpoint =>
    canViewTypedRelationFromEndpoint(authCtx, endpoint.schema, relationSchemaId, endpoint.direction)
  );

export const canEditTypedRelation = (
  authCtx: WorkspaceAuthorizationContext | null,
  endpoints: Array<{
    schema: FieldGroupSchemaShape | null | undefined;
    direction: RelationEndpointDirection;
  }>,
  relationSchemaId: string
) =>
  endpoints.some(endpoint =>
    canEditTypedRelationFromEndpoint(authCtx, endpoint.schema, relationSchemaId, endpoint.direction)
  );

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
  relationSchemaId: string
) => {
  if (canEditTypedRelation(authCtx, endpoints, relationSchemaId)) return;
  httpAssert.true(false, {
    status: 403,
    statusText: 'Forbidden',
    message: 'You do not have permission to edit the typed relation through any of its owner fields'
  });
};
