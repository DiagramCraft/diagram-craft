import {
  isReferenceOrContainmentField,
  type EntitySchema,
  type EntityTemplate,
  type EntityTemplateValues
} from '@arch-register/api-types/schemaContract';
import { isMultiValuedScalarField } from './scalarFieldValues';

export type EntityFormMeta = {
  description: string;
  owner: string;
  lifecycle: string;
  namespace: string;
  tags: string;
};

export type EntityFormDefaults = {
  fields: Record<string, unknown>;
  meta: EntityFormMeta;
};

export const createEntityFormDefaults = (owner = ''): EntityFormDefaults => ({
  fields: {},
  meta: { description: '', owner, lifecycle: '', namespace: 'default', tags: '' }
});

const toFormFieldValue = (value: EntityTemplateValues['fields'][string]) =>
  typeof value === 'boolean' || typeof value === 'number' ? String(value) : value;

export const applyEntityTemplate = ({
  baseline,
  schema,
  template,
  allowedOwnerIds,
  lifecycleIds,
  referenceOptions
}: {
  baseline: EntityFormDefaults;
  schema: EntitySchema;
  template: EntityTemplate;
  allowedOwnerIds: Set<string>;
  lifecycleIds: Set<string>;
  referenceOptions: Record<string, Set<string> | undefined>;
}): EntityFormDefaults & { warnings: string[] } => {
  const fields: Record<string, unknown> = {};
  const warnings: string[] = [];

  for (const field of schema.fields) {
    const value = template.values.fields[field.id];
    if (value === undefined) continue;

    if (field.type === 'typedRelation') {
      // Relation-instance field-value drafts, prefilled once the create flow supports picking a
      // target entity inline (#2606) — pass through unedited for now rather than discard.
      fields[field.id] = value;
      continue;
    }

    if (field.type === 'select') {
      const values = isMultiValuedScalarField(field)
        ? Array.isArray(value)
          ? value
          : [value]
        : [value];
      if (
        !values.every(
          (item): item is string =>
            typeof item === 'string' && field.options.some(option => option.value === item)
        )
      ) {
        warnings.push(`${field.name} is no longer available`);
        continue;
      }
      fields[field.id] = isMultiValuedScalarField(field) ? values : values[0];
      continue;
    }

    if (isReferenceOrContainmentField(field)) {
      const available = referenceOptions[field.schemaId];
      if (
        Array.isArray(value) &&
        available &&
        value.every((item): item is string => typeof item === 'string')
      ) {
        const validIds = value.filter(id => available.has(id));
        if (validIds.length !== value.length)
          warnings.push(`${field.name} contains unavailable entities`);
        if (validIds.length > 0) fields[field.id] = validIds;
        continue;
      }
    }

    fields[field.id] = toFormFieldValue(value);
  }

  const meta = { ...baseline.meta };
  if (template.values.description !== undefined) meta.description = template.values.description;
  if (template.values.namespace !== undefined) meta.namespace = template.values.namespace;
  if (template.values.tags !== undefined) meta.tags = template.values.tags.join(', ');
  if (template.values.owner !== undefined) {
    if (allowedOwnerIds.has(template.values.owner)) meta.owner = template.values.owner;
    else warnings.push('Owner is not available to you');
  }
  if (template.values.lifecycle !== undefined) {
    if (lifecycleIds.has(template.values.lifecycle)) meta.lifecycle = template.values.lifecycle;
    else warnings.push('Lifecycle is no longer available');
  }

  return { fields, meta, warnings };
};

export const toEntityTemplateValues = (
  schema: EntitySchema,
  fields: Record<string, unknown>,
  meta: EntityFormMeta
): EntityTemplateValues => {
  const result: EntityTemplateValues = { fields: {} };
  for (const field of schema.fields) {
    const value = fields[field.id];
    const empty =
      value === undefined || value === '' || (Array.isArray(value) && value.length === 0);
    if (empty) continue;
    if (field.type === 'boolean') {
      result.fields[field.id] = isMultiValuedScalarField(field)
        ? Array.isArray(value)
          ? value.filter((item): item is boolean => typeof item === 'boolean')
          : [value === true || value === 'true']
        : value === true || value === 'true';
    } else if (field.type === 'number') {
      if (isMultiValuedScalarField(field) && Array.isArray(value)) {
        const numbers = value.map(Number);
        if (numbers.every(Number.isInteger)) result.fields[field.id] = numbers;
      } else {
        const numberValue = Number(value);
        if (Number.isInteger(numberValue)) result.fields[field.id] = numberValue;
      }
    } else result.fields[field.id] = value as EntityTemplateValues['fields'][string];
  }

  const description = meta.description.trim();
  const owner = meta.owner.trim();
  const lifecycle = meta.lifecycle.trim();
  const namespace = meta.namespace.trim();
  const tags = meta.tags
    .split(',')
    .map(tag => tag.trim())
    .filter(Boolean);
  if (description) result.description = description;
  if (owner) result.owner = owner;
  if (lifecycle) result.lifecycle = lifecycle;
  if (namespace && namespace !== 'default') result.namespace = namespace;
  if (tags.length > 0) result.tags = tags;
  return result;
};
