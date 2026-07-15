import type { EntityRecord, EntitySummary } from '@arch-register/api-types/entityContract';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';

export type EntityEditState = Record<string, unknown>;
export type EntityUpdateBody = Record<string, unknown>;

export const slugifyEntityName = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

export const relationIds = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];

export const createEntityEditState = (
  entity: EntityRecord,
  schema: EntitySchema
): EntityEditState => {
  const state: EntityEditState = {
    _name: entity._name ?? '',
    _slug: entity._slug ?? '',
    _description: entity._description ?? '',
    _owner: entity._owner?.id ?? '',
    _lifecycle: entity._lifecycle?.id ?? '',
    _targetLifecycle: entity._targetLifecycle?.id ?? '',
    _targetLifecycleDate: entity._targetLifecycleDate ?? '',
    _namespace: entity._namespace ?? '',
    _tags: (entity._tags ?? []).join(', ')
  };
  for (const field of schema.fields) {
    state[field.id] =
      field.type === 'reference' || field.type === 'containment'
        ? relationIds(entity[field.id])
        : (entity[field.id] ?? '');
  }
  return state;
};

export const requiredEntityFieldIds = (
  editState: EntityEditState,
  schema: EntitySchema
): Set<string> => {
  const errors = new Set<string>();
  for (const field of schema.fields) {
    if (field.requirementLevel !== 'required') continue;
    const value = editState[field.id];
    if (
      value == null ||
      (typeof value === 'string' && value.trim() === '') ||
      (Array.isArray(value) && value.length === 0)
    ) {
      errors.add(field.id);
    }
  }
  return errors;
};

export const createEntityUpdateBody = (
  entity: EntityRecord,
  schema: EntitySchema,
  editState: EntityEditState,
  links: EntitySummary['_links']
): EntityUpdateBody => {
  const dataFields: Record<string, unknown> = {};
  for (const field of schema.fields) {
    dataFields[field.id] =
      field.type === 'reference' || field.type === 'containment'
        ? relationIds(editState[field.id])
        : (editState[field.id] ?? '');
  }
  const tags = ((editState._tags as string) ?? '')
    .split(',')
    .map(tag => tag.trim())
    .filter(Boolean);

  return {
    _schemaId: entity._schema.id,
    _name: (editState._name as string) ?? '',
    _slug: (editState._slug as string) || entity._slug,
    _namespace: (editState._namespace as string) || entity._namespace,
    _description: (editState._description as string) ?? '',
    _owner: (editState._owner as string) || null,
    _lifecycle: (editState._lifecycle as string) || null,
    _targetLifecycle: (editState._targetLifecycle as string) || null,
    _targetLifecycleDate: (editState._targetLifecycleDate as string) || null,
    _tags: tags,
    _links: links.filter(link => link.url.trim() !== ''),
    ...dataFields
  };
};
