import type {
  ExternalMetadata,
  ExternalKind,
  ExternalUpdateEnvelope
} from '@arch-register/api-types/common';
import { httpAssert } from '../../utils/httpAssert';

// Shared across entity schema fields and document fields — both extend `externalFieldSchema`,
// so all we need from a field to reason about externality is its id and `external_kind`.
export type ExternalCapableField = { id: string; external_kind?: ExternalKind };

export const isExternalField = (field: ExternalCapableField): boolean =>
  field.external_kind !== undefined;

export const externalFieldIds = (fields: ExternalCapableField[]): Set<string> =>
  new Set(fields.filter(isExternalField).map(field => field.id));

export const valueEquals = (a: unknown, b: unknown): boolean => {
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    const sortedA = [...a].sort();
    const sortedB = [...b].sort();
    return sortedA.every((value, index) => value === sortedB[index]);
  }
  return a === b;
};

// A field-value record is considered unchanged for a given field id if both sides are
// missing/null/equal — mirrors how "no value" is represented across entity data and document
// metadata records.
const fieldValueEquals = (
  a: Record<string, unknown>,
  b: Record<string, unknown>,
  fieldId: string
): boolean => valueEquals(a[fieldId] ?? null, b[fieldId] ?? null);

/**
 * Rejects a plain (non-external) write that changes the value of any field carrying
 * `external_kind` — those fields are read-only to ordinary users and API callers. Only an
 * external update (going through {@link applyExternalFieldUpdate}) may change them.
 */
export const assertNoExternalFieldWrites = (
  fields: ExternalCapableField[],
  current: Record<string, unknown>,
  next: Record<string, unknown>
): void => {
  const externalIds = externalFieldIds(fields);
  if (externalIds.size === 0) return;
  const changed = [...externalIds].filter(id => !fieldValueEquals(current, next, id));
  httpAssert.true(changed.length === 0, {
    status: 400,
    message: `Field(s) ${changed.join(', ')} are externally managed and cannot be edited directly`
  });
};

/**
 * Marks every external field's latest metadata result as `outdated`, called when a genuine user
 * edit touches an entity/document — never called from the external-update write path itself, so
 * an external updater's own write can't mark its own result outdated.
 */
export const outdateExternalMetadata = (metadata: ExternalMetadata): ExternalMetadata => {
  const next: ExternalMetadata = {};
  for (const [fieldId, result] of Object.entries(metadata)) {
    next[fieldId] = result.status === 'outdated' ? result : { ...result, status: 'outdated' };
  }
  return next;
};

/**
 * Validates that an external-update envelope's target field exists, carries a matching
 * `external_kind`, and — for a failed update — that its value hasn't actually changed. Returns
 * the fields list with the target field removed, ready to pass to
 * {@link assertNoExternalFieldWrites} so every *other* field (external or not) is still
 * protected from this same write.
 */
export const assertValidExternalUpdateTarget = (
  fields: ExternalCapableField[],
  envelope: ExternalUpdateEnvelope,
  current: Record<string, unknown>,
  next: Record<string, unknown>
): ExternalCapableField[] => {
  const targetField = fields.find(field => field.id === envelope.fieldId);
  httpAssert.present(targetField, {
    status: 400,
    message: `External update field '${envelope.fieldId}' was not found`
  });
  httpAssert.true(targetField.external_kind === envelope.kind, {
    status: 400,
    message: `Field '${envelope.fieldId}' is not a '${envelope.kind}' external field`
  });
  httpAssert.true(
    envelope.status === 'success' || fieldValueEquals(current, next, envelope.fieldId),
    { status: 400, message: 'A failed external update must not change the field value' }
  );
  return fields.filter(field => field.id !== envelope.fieldId);
};

/**
 * External updates are single-field writes. The caller must send the current entity
 * representation for all other fields, but none of those values may change as part of
 * the external mutation.
 */
export const assertExternalUpdateOnlyChangesTarget = (
  targetFieldId: string,
  current: Record<string, unknown>,
  next: Record<string, unknown>
): void => {
  const fieldIds = new Set([...Object.keys(current), ...Object.keys(next)]);
  const changed = [...fieldIds].filter(
    fieldId => fieldId !== targetFieldId && !fieldValueEquals(current, next, fieldId)
  );
  httpAssert.true(changed.length === 0, {
    status: 400,
    message: `An external update may only change field '${targetFieldId}'`
  });
};

/**
 * Builds the new metadata entry for a single external field following a successful or failed
 * external update. On failure the caller must not have changed the field's value (asserted by
 * {@link assertExternalUpdateTargetsOwnFields} plus the caller keeping `next` equal to `current`
 * for that field) — this only shapes the metadata record itself.
 */
export const applyExternalFieldUpdate = (
  fieldId: string,
  envelope: ExternalUpdateEnvelope,
  now: Date
): ExternalMetadata[string] => ({
  fieldId,
  external_kind: envelope.kind,
  status: envelope.status,
  source: envelope.source,
  timestamp: now.toISOString(),
  explanation: envelope.explanation ?? null,
  findings: envelope.findings,
  sourceVersion: envelope.sourceVersion ?? null,
  requestId: envelope.requestId ?? null,
  failureNotice: envelope.status === 'failed' ? (envelope.failureNotice ?? null) : null
});
