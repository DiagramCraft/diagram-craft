import type { EntityTemplate, SchemaField } from '@arch-register/api-types/schemaContract';
import type { FieldType } from '../../lib/schemaPresentation';

export const updateTemplateFieldId = (
  templates: EntityTemplate[],
  previousFieldId: string,
  nextFieldId: string
): EntityTemplate[] =>
  templates.map(template => {
    if (!(previousFieldId in template.values.fields)) return template;
    const fields = { ...template.values.fields };
    fields[nextFieldId] = fields[previousFieldId]!;
    delete fields[previousFieldId];
    return { ...template, values: { ...template.values, fields } };
  });

export const removeTemplateField = (
  templates: EntityTemplate[],
  fieldId: string
): EntityTemplate[] =>
  templates.map(template => {
    const fields = { ...template.values.fields };
    delete fields[fieldId];
    return { ...template, values: { ...template.values, fields } };
  });

export const createSchemaFieldForType = (
  field: SchemaField,
  newType: FieldType,
  fields: SchemaField[],
  firstEnumId?: string
): SchemaField => {
  const base = { id: field.id, name: field.name };
  switch (newType) {
    case 'text':
    case 'longtext':
    case 'date':
    case 'currency':
      return { ...base, type: newType };
    case 'number':
      return { ...base, type: 'number' };
    case 'boolean':
      return { ...base, type: 'boolean' };
    case 'select':
      return { ...base, type: 'select', enumId: firstEnumId ?? '', options: [] } as SchemaField;
    case 'reference':
      return {
        ...base,
        type: 'reference',
        predicate: '',
        schemaId: '',
        minCount: 0,
        maxCount: -1
      };
    case 'containment':
      return {
        ...base,
        type: 'containment',
        predicate: '',
        schemaId: '',
        minCount: 0,
        maxCount: 1
      };
    case 'derived': {
      const inputField = fields.find(other => other.id !== field.id && other.type !== 'derived');
      return {
        ...base,
        type: 'derived',
        requirementLevel: 'optional',
        expression: inputField ? `entity.${inputField.id}` : '""',
        resultType: 'text'
      };
    }
    case 'typedRelation':
      return {
        ...base,
        type: 'typedRelation',
        relationSchemaId: '',
        direction: 'out',
        minCount: 0,
        maxCount: -1
      };
  }
};
