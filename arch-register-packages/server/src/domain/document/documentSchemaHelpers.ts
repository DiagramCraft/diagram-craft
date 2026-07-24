import type { DocumentField, FieldMigrations } from '@arch-register/api-types/documentContract';

const isRequired = (field: DocumentField) => field.requirement === 'required';

export type FieldChangeKind = 'removed' | 'renamed' | 'type-changed' | 'newly-required';

export type FieldChange = {
  fieldId: string;
  fieldName: string;
  kind: FieldChangeKind;
  renamedToId?: string;
};

/**
 * Detects document type field changes that affect document data already stored for
 * the type: a field's id disappearing (removed, or renamed if a same-named field
 * with a different id took its place), a field's type changing, or a field newly
 * becoming required.
 *
 * Fields are matched primarily by id. An old field whose id disappears and a new
 * field with the same name are treated as the same field having its id changed,
 * since that's how the document type editor represents an in-place id edit.
 *
 * 'removed'/'renamed' changes can be resolved via an explicit migration action
 * (see `fieldMigrations` on the update payload); 'type-changed' and
 * 'newly-required' have no safe migration and always block the save.
 */
export const classifyFieldChanges = (
  oldFields: DocumentField[],
  newFields: DocumentField[]
): FieldChange[] => {
  const changes: FieldChange[] = [];
  const newById = new Map(newFields.map(field => [field.id, field]));

  const unmatchedOld: DocumentField[] = [];
  for (const oldField of oldFields) {
    const newField = newById.get(oldField.id);
    if (!newField) {
      unmatchedOld.push(oldField);
      continue;
    }
    if (oldField.type !== newField.type) {
      changes.push({ fieldId: oldField.id, fieldName: oldField.name, kind: 'type-changed' });
    }
    if (!isRequired(oldField) && isRequired(newField)) {
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
    if (isRequired(newField)) {
      changes.push({ fieldId: newField.id, fieldName: newField.name, kind: 'newly-required' });
    }
  }

  return changes;
};

/** Changes with no safe migration path — these always block the save. */
export const hardBlockedFieldChanges = (changes: FieldChange[]): FieldChange[] =>
  changes.filter(change => change.kind === 'type-changed' || change.kind === 'newly-required');

/** Changes that can be resolved via an explicit rename/remove/archive migration. */
export const migratableFieldChanges = (changes: FieldChange[]): FieldChange[] =>
  changes.filter(change => change.kind === 'removed' || change.kind === 'renamed');

export const describeHardBlockedChange = (change: FieldChange): string => {
  if (change.kind === 'type-changed') {
    return `Field "${change.fieldName}" cannot change type while document data exists`;
  }
  return `Field "${change.fieldName}" cannot be made required while document data exists`;
};

/** Validates that every migratable change with existing data has a corresponding resolution. */
export const findUnresolvedFieldMigrations = (
  changes: FieldChange[],
  fieldMigrations: FieldMigrations | undefined
): FieldChange[] =>
  migratableFieldChanges(changes).filter(change => !fieldMigrations?.[change.fieldId]);

/** Summarizes field-level changes between two field lists for document type version history. */
export const buildSchemaChangeSummary = (
  oldFields: DocumentField[] | null,
  newFields: DocumentField[],
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
    if (previous && !previous.retired && field.retired) archived.push(field.name);
  }

  const summary: Record<string, unknown> = {};
  if (added.length) summary.added = added;
  if (removed.length) summary.removed = removed;
  if (renamed.length) summary.renamed = renamed;
  if (archived.length) summary.archived = archived;
  return summary;
};
