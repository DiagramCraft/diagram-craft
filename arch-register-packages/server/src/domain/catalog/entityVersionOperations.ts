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
  historicalSchema: FieldGroupSchemaShape | null = null
): EntityVersionDbResult => {
  const data = version.state['data'];
  if (data == null || typeof data !== 'object') return version;

  if (!authCtx) return version;

  const schemas = [schema, historicalSchema].filter(
    (candidate): candidate is FieldGroupSchemaShape => candidate != null
  );
  if (schemas.length === 0) return version;
  const knownFields = new Map<string, FieldGroupSchemaShape>();
  for (const candidate of schemas) {
    for (const field of candidate.fields) {
      // The current schema takes precedence over the historical schema when a field exists in
      // both. Fields that only exist in a historical snapshot still need to be redacted.
      if (!knownFields.has(field.id) || candidate === schema) {
        knownFields.set(field.id, candidate);
      }
    }
  }

  const redactedData: Record<string, unknown> = {};
  for (const [fieldId, value] of Object.entries(data as Record<string, unknown>)) {
    const fieldSchema = knownFields.get(fieldId);
    if (!fieldSchema) continue;
    Object.assign(
      redactedData,
      filterRestrictedFieldGroups(authCtx, fieldSchema, { [fieldId]: value })
    );
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
