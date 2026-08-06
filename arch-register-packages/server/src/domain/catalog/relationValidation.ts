import type { RelationField } from '@arch-register/api-types/relationSchemaContract';
import { assertNoExternalFieldWrites } from '../externalMetadata/externalMetadataHelpers';

/**
 * Rejects a plain (non-external-update) relation create/update that sets or changes the value of
 * any schema field carrying `external_kind` — such fields are read-only to ordinary users and
 * API callers. `currentData` is `{}` for a brand-new relation, so any supplied value for an
 * already-external field is rejected there too. Mirrors `assertNoExternalEntityFieldWrites`
 * (entityValidation.ts).
 */
export const assertNoExternalRelationFieldWrites = (
  fields: RelationField[],
  currentData: Record<string, unknown>,
  nextData: Record<string, unknown>
) => assertNoExternalFieldWrites(fields, currentData, nextData);
