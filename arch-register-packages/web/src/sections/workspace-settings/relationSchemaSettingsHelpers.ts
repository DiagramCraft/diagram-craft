import type {
  RelationEndpoint,
  RelationField
} from '@arch-register/api-types/relationSchemaContract';
import type {
  FieldMigrationAction,
  FieldMigrations,
  PendingFieldChange
} from '@arch-register/api-types/schemaContract';
import type { RelationFieldType } from '../../lib/schemaPresentation';

export const createRelationFieldForType = (
  field: RelationField,
  newType: RelationFieldType,
  firstEnumId?: string
): RelationField => {
  const base = { id: field.id, name: field.name };
  switch (newType) {
    case 'text':
    case 'longtext':
    case 'boolean':
    case 'date':
      return { ...base, type: newType };
    case 'number':
      return { ...base, type: 'number' };
    case 'select':
      return { ...base, type: 'select', enumId: firstEnumId ?? '' };
    case 'entityRelation':
      return {
        ...base,
        type: 'entityRelation',
        predicate: '',
        schemaId: '',
        minCount: 0,
        maxCount: -1
      };
  }
};

export const setEndpointSchemaIds = (
  endpoint: RelationEndpoint,
  schemaIds: 'any' | string[]
): RelationEndpoint => ({ ...endpoint, schemaIds });

export const buildRelationFieldMigrations = (
  pendingChanges: PendingFieldChange[],
  choices: Record<string, FieldMigrationAction['action']>
): FieldMigrations => {
  const migrations: FieldMigrations = {};
  for (const change of pendingChanges) {
    const action = choices[change.fieldId] ?? 'remove';
    migrations[change.fieldId] =
      action === 'rename' ? { action, renameTo: change.renamedToId } : { action };
  }
  return migrations;
};

export const firstRemainingRelationSchemaId = <T extends { id: string }>(
  items: T[],
  deletedId: string
): string => items.find(item => item.id !== deletedId)?.id ?? '';
