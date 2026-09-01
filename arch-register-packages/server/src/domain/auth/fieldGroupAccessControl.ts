import {
  getFieldGroupAccess,
  type WorkspaceAuthorizationContext,
  type FieldGroupAccess
} from '@arch-register/permissions';
import { schemaFieldInputSchema, type SchemaGroup } from '@arch-register/api-types/schemaContract';
import { relationFieldInputSchema } from '@arch-register/api-types/relationSchemaContract';
import { httpAssert } from '../../utils/httpAssert';
import { getDerivedFieldIdsWithUnresolvedGroups } from '../derived/derivedFields';

/** Which derived-field root a `FieldGroupSchemaShape` describes — entity/shared-group or relation. */
export type FieldGroupSchemaRoot = 'entity' | 'relation';

export type FieldGroupSchemaShape = {
  fields: Array<{ id: string; name?: string; groupId?: string; [key: string]: unknown }>;
  groups?: Array<{ id: string; name?: string; accessControl?: SchemaGroup['accessControl'] }>;
};

const groupAccessByFieldId = (
  authCtx: WorkspaceAuthorizationContext,
  schema: FieldGroupSchemaShape
): Map<string, FieldGroupAccess> => {
  const accessByGroupId = new Map(
    (schema.groups ?? []).map(group => [
      group.id,
      getFieldGroupAccess(authCtx, group.accessControl)
    ])
  );
  const byField = new Map<string, FieldGroupAccess>();
  for (const field of schema.fields) {
    if (field.groupId != null) {
      // A field that names a group which is not present in the schema is malformed or stale.
      // Treat it as inaccessible instead of inheriting the unrestricted-group default.
      byField.set(field.id, accessByGroupId.get(field.groupId) ?? 'none');
    }
  }
  return byField;
};

const allDerivedFieldIds = (schema: FieldGroupSchemaShape): Set<string> =>
  new Set(schema.fields.filter(field => field.type === 'derived').map(field => field.id));

const unresolvedDerivedFieldIds = (
  schema: FieldGroupSchemaShape,
  root: FieldGroupSchemaRoot = 'entity'
): Set<string> => {
  const parsedFields =
    root === 'relation'
      ? relationFieldInputSchema.array().safeParse(schema.fields)
      : schemaFieldInputSchema.array().safeParse(schema.fields);
  if (!parsedFields.success) {
    // A malformed legacy derived definition must not make an external serializer fail open.
    return allDerivedFieldIds(schema);
  }

  try {
    return getDerivedFieldIdsWithUnresolvedGroups(parsedFields.data, schema.groups ?? [], root);
  } catch {
    // A malformed derived expression must not make an external serializer fail open.
    return allDerivedFieldIds(schema);
  }
};

/**
 * True when the caller cannot view the field's group. A no-op (always false) when authCtx or
 * schema is absent — internal/system callers bypass field-group restriction, same as they
 * bypass other entity-level permission checks. Used by the query DSL to treat a restricted
 * field as unknown, identically to an unrecognized/typo'd field id.
 */
export const isFieldViewRestricted = (
  authCtx: WorkspaceAuthorizationContext | null,
  schema: FieldGroupSchemaShape | null | undefined,
  fieldId: string
): boolean => {
  if (!authCtx || !schema) return false;
  return groupAccessByFieldId(authCtx, schema).get(fieldId) === 'none';
};

/** True when the caller cannot edit the field's group. */
export const isFieldEditRestricted = (
  authCtx: WorkspaceAuthorizationContext | null,
  schema: FieldGroupSchemaShape | null | undefined,
  fieldId: string
): boolean => {
  if (!authCtx || !schema) return false;
  const access = groupAccessByFieldId(authCtx, schema).get(fieldId);
  return access === 'view' || access === 'none';
};

/**
 * True when a field is protected by a team-scoped field group. Missing groups fail closed because
 * unattended integrations must not treat malformed access metadata as unrestricted.
 */
export const isFieldGroupAccessControlled = (
  schema: FieldGroupSchemaShape | null | undefined,
  fieldId: string
): boolean => {
  if (!schema) return true;
  const field = schema.fields.find(candidate => candidate.id === fieldId);
  if (!field || field.groupId == null) return false;
  const group = (schema.groups ?? []).find(candidate => candidate.id === field.groupId);
  return group == null || (group.accessControl?.teamIds.length ?? 0) > 0;
};

/**
 * Ids of fields whose group the caller cannot view. Empty when authCtx or schema is absent
 * (internal/system callers bypass field-group restriction, same as filterRestrictedFieldGroups
 * and isFieldViewRestricted). Used to keep derived values — e.g. entity completeness (#2581) —
 * from leaking occupancy of a restricted field: recompute over `fields - restrictedFieldIds`
 * rather than exposing a number derived from fields the caller can't see.
 */
export const restrictedFieldIds = (
  authCtx: WorkspaceAuthorizationContext | null,
  schema: FieldGroupSchemaShape | null | undefined
): Set<string> => {
  if (!authCtx || !schema) return new Set();
  const byField = groupAccessByFieldId(authCtx, schema);
  return new Set([...byField].filter(([, access]) => access === 'none').map(([id]) => id));
};

/**
 * Omits values for fields whose group the caller cannot view. A no-op when authCtx or
 * schema is absent (internal/system callers bypass field-group redaction, same as they
 * bypass other entity-level permission checks).
 */
export const filterRestrictedFieldGroups = (
  authCtx: WorkspaceAuthorizationContext | null,
  schema: FieldGroupSchemaShape | null | undefined,
  data: Record<string, unknown>,
  schemaRoot: FieldGroupSchemaRoot = 'entity'
): Record<string, unknown> => {
  if (!authCtx || !schema) return data;
  const byField = groupAccessByFieldId(authCtx, schema);
  const unsafeDerivedIds = unresolvedDerivedFieldIds(schema, schemaRoot);
  if (byField.size === 0 && unsafeDerivedIds.size === 0) return data;

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (byField.get(key) === 'none' || unsafeDerivedIds.has(key)) continue;
    result[key] = value;
  }
  return result;
};

/**
 * Redacts an externally returned field-value object against one historical schema. Unlike the
 * general-purpose filter above, unknown fields and unavailable schemas fail closed.
 */
export const filterKnownRestrictedFieldGroups = (
  authCtx: WorkspaceAuthorizationContext | null,
  schema: FieldGroupSchemaShape | null | undefined,
  data: Record<string, unknown>,
  schemaRoot: FieldGroupSchemaRoot = 'entity'
): Record<string, unknown> => {
  if (!schema) return {};
  const byField = authCtx ? groupAccessByFieldId(authCtx, schema) : new Map();
  const unsafeDerivedIds = authCtx
    ? unresolvedDerivedFieldIds(schema, schemaRoot)
    : new Set<string>();
  const knownFieldIds = new Set(schema.fields.map(field => field.id));
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (
      !knownFieldIds.has(key) ||
      (authCtx && (byField.get(key) === 'none' || unsafeDerivedIds.has(key)))
    )
      continue;
    result[key] = value;
  }
  return result;
};

/**
 * Redacts values for a live API response. Authenticated callers get the strict known-field
 * behavior; internal/system callers retain the historical ACL bypass semantics.
 */
export const filterLiveFieldGroups = (
  authCtx: WorkspaceAuthorizationContext | null,
  schema: FieldGroupSchemaShape | null | undefined,
  data: Record<string, unknown>
): Record<string, unknown> =>
  authCtx
    ? filterKnownRestrictedFieldGroups(authCtx, schema, data)
    : filterRestrictedFieldGroups(null, schema, data);

/**
 * Omits values for every field whose group has team-scoped accessControl, regardless of caller.
 * Used for contexts with no live principal to redact against (e.g. webhook delivery) — the
 * unattended, always-on egress path defaults to least privilege rather than bypassing.
 */
export const filterAllRestrictedFieldGroups = (
  schema: FieldGroupSchemaShape | null | undefined,
  data: Record<string, unknown>
): Record<string, unknown> => {
  if (!schema) return data;
  const unsafeDerivedIds = unresolvedDerivedFieldIds(schema);
  const restrictedGroupIds = new Set(
    (schema.groups ?? [])
      .filter(group => group.accessControl && group.accessControl.teamIds.length > 0)
      .map(group => group.id)
  );
  const knownGroupIds = new Set((schema.groups ?? []).map(group => group.id));

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    const field = schema.fields.find(f => f.id === key);
    if (
      unsafeDerivedIds.has(key) ||
      (field?.groupId != null &&
        (!knownGroupIds.has(field.groupId) || restrictedGroupIds.has(field.groupId)))
    ) {
      continue;
    }
    result[key] = value;
  }
  return result;
};

/** Same as filterKnownRestrictedFieldGroups for unattended outbound delivery. */
export const filterKnownAllRestrictedFieldGroups = (
  schema: FieldGroupSchemaShape | null | undefined,
  data: Record<string, unknown>
): Record<string, unknown> => {
  if (!schema) return {};
  const unsafeDerivedIds = unresolvedDerivedFieldIds(schema);
  const restrictedGroupIds = new Set(
    (schema.groups ?? [])
      .filter(group => group.accessControl && group.accessControl.teamIds.length > 0)
      .map(group => group.id)
  );
  const knownGroupIds = new Set((schema.groups ?? []).map(group => group.id));
  const fieldsById = new Map(schema.fields.map(field => [field.id, field]));
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    const field = fieldsById.get(key);
    if (
      !field ||
      unsafeDerivedIds.has(key) ||
      (field.groupId != null &&
        (!knownGroupIds.has(field.groupId) || restrictedGroupIds.has(field.groupId)))
    ) {
      continue;
    }
    result[key] = value;
  }
  return result;
};

/** Throws 403 if any of `changedFieldIds` sits in a group the caller cannot edit. */
export const requireNoRestrictedFieldWrites = (
  authCtx: WorkspaceAuthorizationContext,
  schema: FieldGroupSchemaShape,
  changedFieldIds: Iterable<string>,
  message?: string
) => {
  const byField = groupAccessByFieldId(authCtx, schema);
  const blocked = [...changedFieldIds].filter(id => byField.has(id) && byField.get(id) !== 'edit');

  httpAssert.true(blocked.length === 0, {
    status: 403,
    statusText: 'Forbidden',
    message:
      message ?? `You do not have permission to edit restricted field(s): ${blocked.join(', ')}`
  });
};
