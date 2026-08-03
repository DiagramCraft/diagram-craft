import {
  getFieldGroupAccess,
  type WorkspaceAuthorizationContext,
  type FieldGroupAccess
} from '@arch-register/permissions';
import type { SchemaGroup } from '@arch-register/api-types/schemaContract';
import { httpAssert } from '../../utils/httpAssert';

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
    if (field.groupId) byField.set(field.id, accessByGroupId.get(field.groupId) ?? 'edit');
  }
  return byField;
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
  data: Record<string, unknown>
): Record<string, unknown> => {
  if (!authCtx || !schema) return data;
  const byField = groupAccessByFieldId(authCtx, schema);
  if (byField.size === 0) return data;

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (byField.get(key) === 'none') continue;
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
  data: Record<string, unknown>
): Record<string, unknown> => {
  if (!schema) return {};
  const byField = authCtx ? groupAccessByFieldId(authCtx, schema) : new Map();
  const knownFieldIds = new Set(schema.fields.map(field => field.id));
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (!knownFieldIds.has(key) || (authCtx && byField.get(key) === 'none')) continue;
    result[key] = value;
  }
  return result;
};

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
  const restrictedGroupIds = new Set(
    (schema.groups ?? [])
      .filter(group => group.accessControl && group.accessControl.teamIds.length > 0)
      .map(group => group.id)
  );
  if (restrictedGroupIds.size === 0) return data;

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    const field = schema.fields.find(f => f.id === key);
    if (field?.groupId && restrictedGroupIds.has(field.groupId)) continue;
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
  const restrictedGroupIds = new Set(
    (schema.groups ?? [])
      .filter(group => group.accessControl && group.accessControl.teamIds.length > 0)
      .map(group => group.id)
  );
  const fieldsById = new Map(schema.fields.map(field => [field.id, field]));
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    const field = fieldsById.get(key);
    if (!field || (field.groupId && restrictedGroupIds.has(field.groupId))) continue;
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
