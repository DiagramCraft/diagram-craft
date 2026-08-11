import type { FieldMigrations } from '@arch-register/api-types/common';
import { httpAssert } from '../../utils/httpAssert';

export type FieldMigrationField = {
  id: string;
  name: string;
  type: string;
  required: boolean;
  archived: boolean;
};

export type FieldMigrationFieldAdapter<TField> = {
  getId: (field: TField) => string;
  getName: (field: TField) => string;
  getType: (field: TField) => string;
  isRequired: (field: TField) => boolean;
  isArchived: (field: TField) => boolean;
};

export const normalizeFieldMigrationFields = <TField>(
  fields: readonly TField[],
  adapter: FieldMigrationFieldAdapter<TField>
): FieldMigrationField[] =>
  fields.map(field => ({
    id: adapter.getId(field),
    name: adapter.getName(field),
    type: adapter.getType(field),
    required: adapter.isRequired(field),
    archived: adapter.isArchived(field)
  }));

export type FieldChangeKind = 'removed' | 'renamed' | 'type-changed' | 'newly-required';

export type FieldChange = {
  fieldId: string;
  fieldName: string;
  kind: FieldChangeKind;
  renamedToId?: string;
};

export type MigratableFieldChange = FieldChange & {
  kind: 'removed' | 'renamed';
};

export const classifyFieldChanges = (
  oldFields: readonly FieldMigrationField[],
  newFields: readonly FieldMigrationField[]
): FieldChange[] => {
  const changes: FieldChange[] = [];
  const newById = new Map(newFields.map(field => [field.id, field]));

  const unmatchedOld: FieldMigrationField[] = [];
  for (const oldField of oldFields) {
    const newField = newById.get(oldField.id);
    if (!newField) {
      unmatchedOld.push(oldField);
      continue;
    }
    if (oldField.type !== newField.type) {
      changes.push({ fieldId: oldField.id, fieldName: oldField.name, kind: 'type-changed' });
    }
    if (!oldField.required && newField.required) {
      changes.push({ fieldId: oldField.id, fieldName: oldField.name, kind: 'newly-required' });
    }
  }

  const matchedIds = new Set(oldFields.map(field => field.id).filter(id => newById.has(id)));
  const unmatchedNew = newFields.filter(field => !matchedIds.has(field.id));

  const renamedIds = new Set<string>();
  for (const oldField of unmatchedOld) {
    const renamedTo = unmatchedNew.find(
      field => field.name === oldField.name && !renamedIds.has(field.id)
    );
    if (renamedTo) {
      renamedIds.add(renamedTo.id);
      changes.push({
        fieldId: oldField.id,
        fieldName: oldField.name,
        kind: 'renamed',
        renamedToId: renamedTo.id
      });
    } else {
      changes.push({ fieldId: oldField.id, fieldName: oldField.name, kind: 'removed' });
    }
  }

  for (const newField of unmatchedNew) {
    if (renamedIds.has(newField.id)) continue;
    if (newField.required) {
      changes.push({ fieldId: newField.id, fieldName: newField.name, kind: 'newly-required' });
    }
  }

  return changes;
};

export const hardBlockedFieldChanges = (changes: readonly FieldChange[]): FieldChange[] =>
  changes.filter(change => change.kind === 'type-changed' || change.kind === 'newly-required');

export const migratableFieldChanges = (changes: readonly FieldChange[]): MigratableFieldChange[] =>
  changes.filter(
    (change): change is MigratableFieldChange =>
      change.kind === 'removed' || change.kind === 'renamed'
  );

export const describeHardBlockedChange = (
  change: FieldChange,
  dataLabel: 'entities' | 'document data' = 'entities'
): string => {
  const verb = dataLabel === 'document data' ? 'exists' : 'exist';
  if (change.kind === 'type-changed') {
    return `Field "${change.fieldName}" cannot change type while ${dataLabel} ${verb}`;
  }
  return `Field "${change.fieldName}" cannot be made required while ${dataLabel} ${verb}`;
};

export type FieldMigrationDataOperation =
  | { action: 'rename'; oldFieldId: string; newFieldId: string }
  | { action: 'remove'; oldFieldId: string };

export type FieldMigrationPlan = {
  changes: FieldChange[];
  hardBlocked: FieldChange[];
  migratable: MigratableFieldChange[];
  unresolved: MigratableFieldChange[];
  dataMigrations: FieldMigrationDataOperation[];
  archiveFieldIds: string[];
};

export type FieldMigrationPlanOptions = {
  /** Field ids that must have a decision before the operation can continue. */
  decisionRequiredFieldIds?: ReadonlySet<string>;
  /** Field ids whose supplied decisions should be executed by the domain executor. */
  applicableFieldIds?: ReadonlySet<string>;
};

const includesFieldId = (fieldIds: ReadonlySet<string> | undefined, fieldId: string) =>
  fieldIds?.has(fieldId) ?? true;

/**
 * Builds the shared migration decisions while leaving data/configuration mutations to callers.
 * The two field-id sets preserve domain differences around when data exists and which fields are
 * eligible for migration (for example, document metadata fields versus unused type fields).
 */
export const planFieldMigrations = (
  oldFields: readonly FieldMigrationField[],
  newFields: readonly FieldMigrationField[],
  fieldMigrations: FieldMigrations | undefined,
  options: FieldMigrationPlanOptions = {}
): FieldMigrationPlan => {
  const changes = classifyFieldChanges(oldFields, newFields);
  const hardBlocked = hardBlockedFieldChanges(changes);
  const migratable = migratableFieldChanges(changes);
  const unresolved = migratable.filter(
    change =>
      includesFieldId(options.decisionRequiredFieldIds, change.fieldId) &&
      !fieldMigrations?.[change.fieldId]
  );
  const dataMigrations: FieldMigrationDataOperation[] = [];
  const archiveFieldIds: string[] = [];

  for (const change of migratable) {
    if (!includesFieldId(options.applicableFieldIds, change.fieldId)) continue;
    const migration = fieldMigrations?.[change.fieldId];
    if (!migration) continue;

    if (migration.action === 'archive') {
      archiveFieldIds.push(change.fieldId);
    } else if (migration.action === 'rename') {
      const targetId = migration.renameTo ?? change.renamedToId;
      httpAssert.string(targetId, {
        message: `renameTo is required to rename field "${change.fieldName}"`
      });
      dataMigrations.push({ action: 'rename', oldFieldId: change.fieldId, newFieldId: targetId });
    } else {
      dataMigrations.push({ action: 'remove', oldFieldId: change.fieldId });
    }
  }

  return { changes, hardBlocked, migratable, unresolved, dataMigrations, archiveFieldIds };
};

/** Validates that every migratable change in the supplied set has a corresponding resolution. */
export const findUnresolvedFieldMigrations = (
  changes: readonly FieldChange[],
  fieldMigrations: FieldMigrations | undefined
): MigratableFieldChange[] =>
  migratableFieldChanges(changes).filter(change => !fieldMigrations?.[change.fieldId]);

/** Summarizes field-level changes between two normalized field lists for version history. */
export const buildFieldChangeSummary = (
  oldFields: readonly FieldMigrationField[] | null,
  newFields: readonly FieldMigrationField[],
  fieldMigrations?: FieldMigrations
): Record<string, unknown> => {
  if (!oldFields) return { added: newFields.map(field => field.name) };

  const oldById = new Map(oldFields.map(field => [field.id, field]));
  const newById = new Map(newFields.map(field => [field.id, field]));

  const added: string[] = [];
  const removed: string[] = [];
  const renamed: Array<{ from: string; to: string }> = [];
  const archived: string[] = [];

  for (const field of newFields) {
    if (!oldById.has(field.id)) added.push(field.name);
  }

  for (const field of oldFields) {
    if (newById.has(field.id)) continue;
    const migration = fieldMigrations?.[field.id];
    if (migration?.action === 'rename' && migration.renameTo) {
      const target = newById.get(migration.renameTo);
      renamed.push({ from: field.name, to: target?.name ?? migration.renameTo });
    } else {
      removed.push(field.name);
    }
  }

  for (const field of newFields) {
    const previous = oldById.get(field.id);
    if (previous && !previous.archived && field.archived) archived.push(field.name);
  }

  const summary: Record<string, unknown> = {};
  if (added.length) summary.added = added;
  if (removed.length) summary.removed = removed;
  if (renamed.length) summary.renamed = renamed;
  if (archived.length) summary.archived = archived;
  return summary;
};
