import type {
  Entity,
  EntityApiResponse,
  EntitySchema,
  ReferenceField,
  SchemaField
} from '../types.js';

export type DiagramCraftSchemaField =
  | Extract<SchemaField, { type: 'text' | 'longtext' | 'boolean' | 'date' | 'select' }>
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
  field: SchemaField
): DiagramCraftSchemaField | undefined => {
  switch (field.type) {
    case 'text':
    case 'longtext':
    case 'boolean':
    case 'date':
    case 'select':
    case 'reference':
    case 'containment':
      return field;
    default:
      return undefined;
  }
};

export const toDiagramCraftSchema = (schema: EntitySchema): DiagramCraftSchema => ({
  id: schema.id,
  name: schema.name,
  fields: [
    ...DIAGRAM_CRAFT_METADATA_FIELDS.filter(
      metadataField => !schema.fields.some(field => field.id === metadataField.id)
    ),
    ...schema.fields.flatMap(field => {
      const normalized = toDiagramCraftField(field);
      return normalized ? [normalized] : [];
    })
  ]
});

export const toDiagramCraftData = (row: Entity): EntityApiResponse => ({
  _uid: row.id,
  _workspace: row.workspace,
  _schemaId: row.schema_id,
  _name: row.name,
  _slug: row.slug,
  _namespace: row.namespace,
  _description: row.description,
  _owner: row.owner,
  _lifecycle: row.lifecycle,
  _tags: row.tags,
  _links: row.links,
  _visibilityMode: row.visibility_mode,
  name: row.name,
  description: row.description,
  ...row.data
});
