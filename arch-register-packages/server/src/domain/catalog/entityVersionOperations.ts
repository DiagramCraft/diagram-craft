import { orpcAssert } from '../../utils/orpcAssert';
import type { EntityVersionDbResult } from './db/catalogDatabase';
import {
  filterRestrictedFieldGroups,
  requireNoRestrictedFieldWrites,
  type FieldGroupSchemaShape
} from '../auth/fieldGroupAccessControl';
import type { WorkspaceAuthorizationContext } from '@arch-register/permissions';
import { equalEntityValue } from './entityDiff';
import { httpAssert } from '../../utils/httpAssert';

export const redactVersionState = (
  version: EntityVersionDbResult,
  authCtx: WorkspaceAuthorizationContext | null,
  schema: FieldGroupSchemaShape | null,
  historicalSchema: FieldGroupSchemaShape | null = null,
  options: { failClosedWhenHistoricalSchemaMissing?: boolean } = {}
): EntityVersionDbResult => {
  const data = version.state['data'];
  if (data == null || typeof data !== 'object') return version;

  if (!authCtx) return version;

  if (options.failClosedWhenHistoricalSchemaMissing && historicalSchema == null) {
    return {
      ...version,
      state: {
        ...version.state,
        data: {}
      }
    };
  }

  const schemas = [schema, historicalSchema].filter(
    (candidate): candidate is FieldGroupSchemaShape => candidate != null
  );
  if (schemas.length === 0) return version;

  const redactedData: Record<string, unknown> = {};
  for (const [fieldId, value] of Object.entries(data as Record<string, unknown>)) {
    const fieldSchemas = schemas.filter(candidate =>
      candidate.fields.some(field => field.id === fieldId)
    );
    if (fieldSchemas.length === 0) continue;

    // Apply every schema that knows the field. This intentionally makes the most restrictive
    // historical/current ACL win, so a later ACL relaxation cannot expose an old value.
    const isRestricted = fieldSchemas.some(
      fieldSchema =>
        !Object.hasOwn(
          filterRestrictedFieldGroups(authCtx, fieldSchema, { [fieldId]: value }),
          fieldId
        )
    );
    if (!isRestricted) redactedData[fieldId] = value;
  }

  return {
    ...version,
    state: {
      ...version.state,
      data: redactedData
    }
  };
};

export const changedVersionDataFieldIds = (
  currentData: Record<string, unknown>,
  restoredData: Record<string, unknown>
): string[] => {
  const fieldIds = new Set([...Object.keys(currentData), ...Object.keys(restoredData)]);
  return [...fieldIds].filter(
    fieldId => !equalEntityValue(currentData[fieldId], restoredData[fieldId])
  );
};

/**
 * Enforces field-group write permissions for a complete historical state. A field must be known
 * to either the current or historical schema; otherwise a schema change could turn an old
 * restricted field into an unrestricted restore path.
 */
export const assertVersionDataCanBeRestored = (
  authCtx: WorkspaceAuthorizationContext | null,
  currentSchema: FieldGroupSchemaShape,
  historicalSchema: FieldGroupSchemaShape | null,
  currentData: Record<string, unknown>,
  restoredData: Record<string, unknown>
) => {
  if (!authCtx) return;

  const changedFieldIds = changedVersionDataFieldIds(currentData, restoredData);
  const knownFieldIds = new Set([
    ...currentSchema.fields.map(field => field.id),
    ...(historicalSchema?.fields.map(field => field.id) ?? [])
  ]);
  const unknownFieldIds = changedFieldIds.filter(fieldId => !knownFieldIds.has(fieldId));
  httpAssert.true(unknownFieldIds.length === 0, {
    status: 403,
    statusText: 'Forbidden',
    message: `You do not have permission to restore unknown field(s): ${unknownFieldIds.join(', ')}`
  });

  requireNoRestrictedFieldWrites(
    authCtx,
    currentSchema,
    changedFieldIds,
    'You do not have permission to restore one or more restricted fields on this entity'
  );
  if (historicalSchema) {
    requireNoRestrictedFieldWrites(
      authCtx,
      historicalSchema,
      changedFieldIds,
      'You do not have permission to restore one or more historical restricted fields on this entity'
    );
  }
};

export const serializeEntityVersion = (version: EntityVersionDbResult) => ({
  ...version,
  created_at: version.created_at.toISOString(),
  created_by_name: version.created_by_name
});

export const assertVersionCanBeRestored = (version: EntityVersionDbResult, entityId: string) => {
  orpcAssert.true(version.entity_id === entityId, {
    code: 'BAD_REQUEST',
    message: 'Version does not belong to this entity'
  });
  orpcAssert.true(
    version.kind === 'autosave' ||
      version.kind === 'saved_version' ||
      version.kind === 'case_applied',
    {
      code: 'BAD_REQUEST',
      message: 'Only autosave, saved_version, or case_applied versions can be restored'
    }
  );
};
