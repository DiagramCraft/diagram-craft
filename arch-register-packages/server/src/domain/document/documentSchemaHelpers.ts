import type { DocumentField } from '@arch-register/api-types/documentContract';
import {
  normalizeFieldMigrationFields,
  type FieldMigrationField
} from '../fieldMigration/fieldMigrationPlanning';

export const toFieldMigrationFields = (fields: readonly DocumentField[]): FieldMigrationField[] =>
  normalizeFieldMigrationFields(fields, {
    getId: field => field.id,
    getName: field => field.name,
    getType: field => field.type,
    isRequired: field => field.requirement === 'required',
    isArchived: field => field.retired
  });
