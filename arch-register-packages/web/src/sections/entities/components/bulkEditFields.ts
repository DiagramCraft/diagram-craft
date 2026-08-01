import type { EntityRecord } from '@arch-register/api-types/entityContract';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import type { FieldGroupAccess, FieldGroupAccessControl } from '@arch-register/permissions';
import { resolveGroupAccessControl } from '../../../lib/fieldGroupAccess';

type ResolvedSchemaField = EntitySchema['fields'][number];

export type BulkSchemaField = Extract<
  ResolvedSchemaField,
  { type: 'text' | 'longtext' | 'boolean' | 'date' | 'number' | 'select' | 'reference' }
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
  'number',
  'select',
  'reference'
]);

const isRequired = (field: BulkSchemaField): boolean => {
  if (field.requirementLevel === 'required') return true;
  return field.type === 'reference' && field.minCount > 0;
};

const fieldGroupAccessInSchema = (
  schema: EntitySchema,
  field: ResolvedSchemaField,
  getFieldGroupAccess: (accessControl: FieldGroupAccessControl | undefined) => FieldGroupAccess
): FieldGroupAccess => {
  if (!field.groupId) return 'edit';
  const group = schema.groups.find(g => g.id === field.groupId);
  if (!group) return 'edit';
  return getFieldGroupAccess(
    resolveGroupAccessControl(group, schema.shared_field_group_links ?? [])
  );
};

// Fields common (by id and type) to every schema of the currently-selected entities, plus the
// two always-present core attributes (owner, lifecycle). A field is only offered for bulk-edit
// when the caller has edit access to its field group in every involved schema — bulk-edit is a
// write-only surface, so view-only access (which would need a disabled/read-only affordance) is
// excluded the same as no access.
export const getBulkEditableFields = (
  selectedEntities: EntityRecord[],
  schemaMap: Map<string, { schema: EntitySchema; index: number }>,
  getFieldGroupAccess: (accessControl: FieldGroupAccessControl | undefined) => FieldGroupAccess
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
    if (fieldGroupAccessInSchema(first, field, getFieldGroupAccess) !== 'edit') continue;
    if (
      rest.some(schema => fieldGroupAccessInSchema(schema, field, getFieldGroupAccess) !== 'edit')
    )
      continue;

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
