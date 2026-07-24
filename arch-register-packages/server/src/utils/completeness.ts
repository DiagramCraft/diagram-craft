import { Entity, SchemaDbResult } from '../domain/catalog/db/catalogDatabase';

const isNonEmpty = (value: unknown): boolean => {
  if (value == null) return false;
  if (typeof value === 'string') return value.trim() !== '';
  return true;
};

// Only the fields actually read below are required, so callers computing completeness for an
// entity that hasn't been persisted yet (e.g. mid-create, before an id/timestamps exist) don't
// need to construct a full Entity.
type CompletenessInput = Pick<Entity, 'description' | 'owner' | 'lifecycle' | 'data'>;

export const computeEntityCompleteness = (
  entity: CompletenessInput,
  schema: SchemaDbResult
): number => {
  const expectedFields = schema.fields.filter(
    f => f.requirementLevel === 'required' || f.requirementLevel === 'expected'
  );

  // Built-in fields always count: description, owner, lifecycle
  const total = expectedFields.length + 3;

  let filled = 0;

  // Built-in fields
  if (isNonEmpty(entity.description)) filled++;
  if (isNonEmpty(entity.owner)) filled++;
  if (isNonEmpty(entity.lifecycle)) filled++;

  // Custom expected fields
  for (const field of expectedFields) {
    const value = entity.data[field.id];
    if (isNonEmpty(value)) filled++;
  }

  return Math.round((filled / total) * 100);
};
