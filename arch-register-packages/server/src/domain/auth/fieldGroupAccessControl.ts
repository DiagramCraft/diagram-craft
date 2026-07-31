import {
  getFieldGroupAccess,
  type AuthorizationContext,
  type FieldGroupAccess
} from '@arch-register/permissions';
import type { SchemaField, SchemaGroup } from '@arch-register/api-types/schemaContract';
import { httpAssert } from '../../utils/httpAssert';

export type FieldGroupSchemaShape = {
  fields: SchemaField[];
  groups?: SchemaGroup[];
};

const groupAccessByFieldId = (
  authCtx: AuthorizationContext,
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
 * Omits values for fields whose group the caller cannot view. A no-op when authCtx or
 * schema is absent (internal/system callers bypass field-group redaction, same as they
 * bypass other entity-level permission checks).
 */
export const filterRestrictedFieldGroups = (
  authCtx: AuthorizationContext | null,
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

/** Throws 403 if any of `changedFieldIds` sits in a group the caller cannot edit. */
export const requireNoRestrictedFieldWrites = (
  authCtx: AuthorizationContext,
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
