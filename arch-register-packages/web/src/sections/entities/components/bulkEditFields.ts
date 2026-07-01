import type { EntityRecord } from '@arch-register/api-types/entityContract';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';

type ResolvedSchemaField = EntitySchema['fields'][number];

export type BulkSchemaField = Extract<
  ResolvedSchemaField,
  { type: 'text' | 'longtext' | 'boolean' | 'date' | 'select' | 'reference' }
>;

export type BulkEditableField =
  | { kind: 'owner'; id: '_owner'; label: string; required: false }
  | { kind: 'lifecycle'; id: '_lifecycle'; label: string; required: false }
  | { kind: 'schema'; id: string; label: string; field: BulkSchemaField; required: boolean };

const BULK_EDITABLE_TYPES = new Set<ResolvedSchemaField['type']>([
  'text',
  'longtext',
  'boolean',
  'date',
  'select',
  'reference'
]);

const isRequired = (field: BulkSchemaField): boolean => {
  if (field.requirementLevel === 'required') return true;
  return field.type === 'reference' && field.minCount > 0;
};

// Fields common (by id and type) to every schema of the currently-selected entities, plus the
// two always-present core attributes (owner, lifecycle).
export const getBulkEditableFields = (
  selectedEntities: EntityRecord[],
  schemaMap: Map<string, { schema: EntitySchema; index: number }>
): BulkEditableField[] => {
  const fields: BulkEditableField[] = [
    { kind: 'owner', id: '_owner', label: 'Owner', required: false },
    { kind: 'lifecycle', id: '_lifecycle', label: 'Lifecycle', required: false }
  ];

  const schemaIds = [...new Set(selectedEntities.map(entity => entity._schema.id))];
  const schemas = schemaIds
    .map(id => schemaMap.get(id)?.schema)
    .filter((schema): schema is EntitySchema => schema != null);
  const [first, ...rest] = schemas;
  if (!first) return fields;

  for (const field of first.fields) {
    if (!BULK_EDITABLE_TYPES.has(field.type)) continue;
    const consistent = rest.every(schema => {
      const match = schema.fields.find(f => f.id === field.id);
      return match != null && match.type === field.type;
    });
    if (!consistent) continue;

    fields.push({
      kind: 'schema',
      id: field.id,
      label: field.name,
      field: field as BulkSchemaField,
      required: isRequired(field as BulkSchemaField)
    });
  }

  return fields;
};

export const canClearBulkField = (field: BulkEditableField): boolean => !field.required;
