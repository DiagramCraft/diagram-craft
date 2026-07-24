import type { SchemaField } from '@arch-register/api-types/schemaContract';
import { assertNoExternalFieldWrites } from '../externalMetadata/externalMetadataHelpers';

/**
 * Rejects a plain (non-external-update) entity create/update that sets or changes the value of
 * any schema field carrying `external_kind` — such fields are read-only to ordinary users and
 * API callers. `currentData` is `{}` for a brand-new entity, so any supplied value for an
 * already-external field is rejected there too.
 */
export const assertNoExternalEntityFieldWrites = (
  fields: SchemaField[],
  currentData: Record<string, unknown>,
  nextData: Record<string, unknown>
) => assertNoExternalFieldWrites(fields, currentData, nextData);
