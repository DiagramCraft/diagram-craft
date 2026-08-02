import type {
  EntityRecord,
  EntitySummary,
  RelationDeltas,
  RelationRecordDraft
} from '@arch-register/api-types/entityContract';
import {
  isReferenceOrContainmentField,
  isTypedRelationField,
  type EntitySchema
} from '@arch-register/api-types/schemaContract';

export type EntityEditState = Record<string, unknown>;
export type EntityUpdateBody = Record<string, unknown>;

/** Per-typedRelation-field pending changes, tracked as deltas against the fetched records. */
export type TypedRelationFieldEditState = {
  create: RelationRecordDraft[];
  update: Map<string, Record<string, unknown>>;
  remove: Set<string>;
};

export type TypedRelationEditState = Record<string, TypedRelationFieldEditState>;

export const emptyTypedRelationFieldState = (): TypedRelationFieldEditState => ({
  create: [],
  update: new Map(),
  remove: new Set()
});

export const typedRelationFieldStateIsEmpty = (state: TypedRelationFieldEditState): boolean =>
  state.create.length === 0 && state.update.size === 0 && state.remove.size === 0;

/** Converts the in-progress typed-relation edit state into the `_relations` body shape. */
export const typedRelationEditStateToDeltas = (state: TypedRelationEditState): RelationDeltas => {
  const result: RelationDeltas = {};
  for (const [fieldId, fieldState] of Object.entries(state)) {
    if (typedRelationFieldStateIsEmpty(fieldState)) continue;
    result[fieldId] = {
      ...(fieldState.create.length > 0 ? { create: fieldState.create } : {}),
      ...(fieldState.update.size > 0
        ? { update: [...fieldState.update.entries()].map(([id, data]) => ({ id, data })) }
        : {}),
      ...(fieldState.remove.size > 0 ? { delete: [...fieldState.remove] } : {})
    };
  }
  return result;
};

export const slugifyEntityName = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

export const relationIds = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];

const emptyStringToNull = (value: unknown) =>
  typeof value === 'string' && value.trim() === '' ? null : (value ?? null);

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
    if (isTypedRelationField(field)) continue;
    state[field.id] = isReferenceOrContainmentField(field)
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
  links: EntitySummary['_links'],
  typedRelationEditState: TypedRelationEditState = {}
): EntityUpdateBody => {
  const dataFields: Record<string, unknown> = {};
  for (const field of schema.fields) {
    if (isTypedRelationField(field)) continue;
    dataFields[field.id] = isReferenceOrContainmentField(field)
      ? relationIds(editState[field.id])
      : (editState[field.id] ?? '');
  }
  const tags = ((editState._tags as string) ?? '')
    .split(',')
    .map(tag => tag.trim())
    .filter(Boolean);

  const relations = typedRelationEditStateToDeltas(typedRelationEditState);

  return {
    _schemaId: entity._schema.id,
    _name: (editState._name as string) ?? '',
    _slug: (editState._slug as string) ?? entity._slug,
    _namespace: (editState._namespace as string) ?? entity._namespace,
    _description: (editState._description as string) ?? '',
    _owner: emptyStringToNull(editState._owner),
    _lifecycle: emptyStringToNull(editState._lifecycle),
    _targetLifecycle: emptyStringToNull(editState._targetLifecycle),
    _targetLifecycleDate: emptyStringToNull(editState._targetLifecycleDate),
    _tags: tags,
    _links: links.filter(link => link.url.trim() !== ''),
    ...(Object.keys(relations).length > 0 ? { _relations: relations } : {}),
    ...dataFields
  };
};
