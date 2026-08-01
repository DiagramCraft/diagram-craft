import type { AuthorizationContext } from '@arch-register/permissions';
import { Entity, SchemaDbResult } from '../domain/catalog/db/catalogDatabase';
import { restrictedFieldIds } from '../domain/auth/fieldGroupAccessControl';

const isNonEmpty = (value: unknown): boolean => {
  if (value == null) return false;
  if (typeof value === 'string') return value.trim() !== '';
  return true;
};

// Only the fields actually read below are required, so callers computing completeness for an
// entity that hasn't been persisted yet (e.g. mid-create, before an id/timestamps exist) don't
// need to construct a full Entity.
type CompletenessInput = Pick<Entity, 'description' | 'owner' | 'lifecycle' | 'data'>;

/**
 * `authCtx` is optional and defaults to `null` (full, unfiltered completeness) deliberately:
 * every write-time/system call site (mutations, sync, imports, the completeness scan job) needs
 * the true value, since that's what gets persisted on the entity row and used for SQL
 * filter/sort/facet queries (#2346) — changing what's stored per caller isn't an option. Only
 * read-time API serialization should pass a caller's authCtx, so a restricted field's
 * required/expected status can't leak occupancy of that field via the percentage (#2581) — see
 * `restrictedFieldIds` and `hasFieldGroupAdminBypass` for the underlying access rationale.
 */
export const computeEntityCompleteness = (
  entity: CompletenessInput,
  schema: SchemaDbResult,
  authCtx: AuthorizationContext | null = null
): number => {
  const restricted = restrictedFieldIds(authCtx, schema);
  const expectedFields = schema.fields.filter(
    f =>
      f.type !== 'derived' &&
      (f.requirementLevel === 'required' || f.requirementLevel === 'expected') &&
      !restricted.has(f.id)
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
