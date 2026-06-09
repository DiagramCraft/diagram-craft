import type { Entity, DiagramCraftEntityResponse, ReferenceField, SchemaField } from '../../types';
import { EntitySchemaRow, WorkspaceEnumRow } from '../catalog/db/catalogDatabase';

export type DiagramCraftSchemaField =
  | Extract<SchemaField, { type: 'text' | 'longtext' | 'boolean' | 'date' }>
  | (Extract<SchemaField, { type: 'select' }> & {
      options: Array<{ value: string; label: string }>;
    })
  | (Omit<ReferenceField, 'type'> & { type: 'reference' | 'containment' });

export type DiagramCraftSchema = {
  id: string;
  name: string;
  fields: DiagramCraftSchemaField[];
};

const DIAGRAM_CRAFT_METADATA_FIELDS: DiagramCraftSchemaField[] = [
  { id: 'name', name: 'Name', type: 'text' },
  { id: 'description', name: 'Description', type: 'longtext' }
];

export const toDiagramCraftField = (
  field: SchemaField,
  enums: WorkspaceEnumRow[]
): DiagramCraftSchemaField | undefined => {
  switch (field.type) {
    case 'text':
    case 'longtext':
    case 'boolean':
    case 'date':
      return field;
    case 'select': {
      const e = enums.find(e => e.id === field.enumId);
      return {
        ...field,
        options: e?.options ?? []
      };
    }
    case 'reference':
    case 'containment':
      return field;
    default:
      return undefined;
  }
};

export const toDiagramCraftSchema = (
  schema: EntitySchemaRow,
  enums: WorkspaceEnumRow[]
): DiagramCraftSchema => ({
  id: schema.id,
  name: schema.name,
  fields: [
    ...DIAGRAM_CRAFT_METADATA_FIELDS.filter(
      metadataField => !schema.fields.some(field => field.id === metadataField.id)
    ),
    ...schema.fields.flatMap(field => {
      const normalized = toDiagramCraftField(field, enums);
      return normalized ? [normalized] : [];
    })
  ]
});

export const toDiagramCraftData = (row: Entity): DiagramCraftEntityResponse => ({
  _uid: row.id,
  _workspace: row.workspace,
  _schemaId: row.schema_id,
  _name: row.name,
  _slug: row.slug,
  _namespace: row.namespace,
  _description: row.description,
  _owner: row.owner,
  _lifecycle: row.lifecycle,
  _targetLifecycle: row.target_lifecycle,
  _targetLifecycleDate: row.target_lifecycle_date,
  _tags: row.tags,
  _links: row.links,
  _visibilityMode: row.visibility_mode,
  name: row.name,
  description: row.description,
  ...row.data
});
