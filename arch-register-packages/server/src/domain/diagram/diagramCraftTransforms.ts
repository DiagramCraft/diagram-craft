import type { DiagramCraftEntityResponse } from '../../types';
import { Entity, SchemaDbResult, WorkspaceEnumDbResult } from '../catalog/db/catalogDatabase';
import {
  ReferenceField,
  SchemaField,
  isTypedRelationField
} from '@arch-register/api-types/schemaContract';
import type { RelationDbResult, RelationSchemaDbResult } from '../catalog/db/relationDatabase';
import type { AuthorizationContext } from '@arch-register/permissions';
import {
  filterLiveFieldGroups,
  isFieldViewRestricted,
  type FieldGroupSchemaShape
} from '../auth/fieldGroupAccessControl';
import {
  canViewTypedRelation,
  canViewTypedRelationFromEndpoint
} from '../catalog/relationAccessControl';

export type DiagramCraftSchemaField =
  | Extract<SchemaField, { type: 'text' | 'longtext' | 'boolean' | 'date' | 'number' }>
  | (Extract<SchemaField, { type: 'select' }> & {
      options: Array<{ value: string; label: string }>;
    })
  | (Omit<ReferenceField, 'type'> & {
      type: 'reference' | 'containment';
      schemaIds?: string[];
    });

export type DiagramCraftSchema = {
  id: string;
  name: string;
  description?: string;
  fields: DiagramCraftSchemaField[];
};

const DIAGRAM_CRAFT_METADATA_FIELDS: DiagramCraftSchemaField[] = [
  { id: 'name', name: 'Name', type: 'text' },
  { id: 'description', name: 'Description', type: 'longtext' }
];

export const toDiagramCraftField = (
  field: SchemaField,
  enums: WorkspaceEnumDbResult[],
  relationSchemas: RelationSchemaDbResult[] = []
): DiagramCraftSchemaField | undefined => {
  switch (field.type) {
    case 'text':
    case 'longtext':
    case 'boolean':
    case 'date':
    case 'number':
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
    case 'typedRelation': {
      const relationSchema = relationSchemas.find(schema => schema.id === field.relationSchemaId);
      if (!relationSchema) return undefined;

      const schemaIds =
        field.direction === 'in' ? relationSchema.out_schema_ids : relationSchema.in_schema_ids;
      if (schemaIds === 'any') return undefined;
      const schemaId = schemaIds[0];
      if (!schemaId) return undefined;

      return {
        id: field.id,
        name: field.name,
        type: 'reference',
        schemaId,
        schemaIds,
        minCount: 0,
        maxCount: -1
      };
    }
    default:
      return undefined;
  }
};

export const toDiagramCraftSchema = (
  schema: SchemaDbResult,
  enums: WorkspaceEnumDbResult[],
  relationSchemas: RelationSchemaDbResult[] = []
): DiagramCraftSchema => ({
  id: schema.id,
  name: schema.name,
  description: schema.description,
  fields: [
    ...DIAGRAM_CRAFT_METADATA_FIELDS.filter(
      metadataField => !schema.fields.some(field => field.id === metadataField.id)
    ),
    ...schema.fields.flatMap(field => {
      const normalized = toDiagramCraftField(field, enums, relationSchemas);
      return normalized ? [normalized] : [];
    })
  ]
});

export type DiagramCraftRelationReferences = Map<string, Map<string, string[]>>;

/**
 * Projects visible typed relation endpoints into the existing entity reference format. Relation
 * rows deliberately contribute only endpoint IDs; relation instance fields are not part of the
 * Diagram Craft adapter contract.
 */
export const toDiagramCraftRelationReferences = (
  rows: RelationDbResult[],
  entities: Entity[],
  schemas: SchemaDbResult[],
  authCtx: AuthorizationContext
): DiagramCraftRelationReferences => {
  const entityById = new Map(entities.map(entity => [entity.id, entity]));
  const schemaById = new Map(schemas.map(schema => [schema.id, schema]));
  const references = new Map<string, Map<string, Set<string>>>();

  const addReference = (
    entity: Entity,
    direction: 'in' | 'out',
    relationSchemaId: string,
    targetEntityId: string
  ) => {
    const schema = schemaById.get(entity.schema_id);
    if (
      !schema ||
      !canViewTypedRelationFromEndpoint(authCtx, schema, relationSchemaId, direction)
    ) {
      return;
    }

    for (const field of schema.fields.filter(
      field =>
        isTypedRelationField(field) &&
        field.relationSchemaId === relationSchemaId &&
        field.direction === direction &&
        !isFieldViewRestricted(authCtx, schema, field.id)
    )) {
      const entityReferences = references.get(entity.id) ?? new Map<string, Set<string>>();
      const fieldReferences = entityReferences.get(field.id) ?? new Set<string>();
      fieldReferences.add(targetEntityId);
      entityReferences.set(field.id, fieldReferences);
      references.set(entity.id, entityReferences);
    }
  };

  for (const row of rows) {
    const inEntity = entityById.get(row.in_entity_id);
    const outEntity = entityById.get(row.out_entity_id);
    if (!inEntity || !outEntity) continue;

    const inSchema = schemaById.get(inEntity.schema_id);
    const outSchema = schemaById.get(outEntity.schema_id);
    if (
      !canViewTypedRelation(
        authCtx,
        [
          { schema: inSchema, direction: 'in' },
          { schema: outSchema, direction: 'out' }
        ],
        row.schema_id
      )
    ) {
      continue;
    }

    addReference(inEntity, 'in', row.schema_id, outEntity.id);
    addReference(outEntity, 'out', row.schema_id, inEntity.id);
  }

  return new Map(
    [...references].map(([entityId, fields]) => [
      entityId,
      new Map([...fields].map(([fieldId, ids]) => [fieldId, [...ids]]))
    ])
  );
};

export const toDiagramCraftData = (
  row: Entity,
  schema: FieldGroupSchemaShape | null,
  authCtx: AuthorizationContext | null,
  relationReferences: Map<string, string[]> = new Map()
): DiagramCraftEntityResponse => {
  const relationData = Object.fromEntries(
    [...relationReferences].map(([fieldId, entityIds]) => [fieldId, entityIds.join(',')])
  );

  return {
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
    _projectId: row.project_id,
    name: row.name,
    description: row.description,
    ...filterLiveFieldGroups(authCtx, schema, { ...row.data, ...relationData })
  };
};
