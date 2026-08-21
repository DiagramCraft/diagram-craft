import type { DetailLayoutConfig, EntitySchema } from '@arch-register/api-types/schemaContract';
import type { RelationSchema } from '@arch-register/api-types/relationSchemaContract';
import { computeApplicableUnboundRelationSchemas } from './unboundTypedRelations';

/**
 * Synthesizes the layout a schema without a saved `detail_layout` renders today: ungrouped
 * fields under a generic "Properties" panel, one panel per field group (in group order), a
 * metadata panel, a links panel, one panel per applicable unbound relation schema, then the
 * fixed Projects and Diagrams panels.
 */
export const buildDefaultLayout = (
  schema: EntitySchema | null,
  relationSchemas: RelationSchema[]
): DetailLayoutConfig => {
  const ungroupedFields = schema?.fields.filter(field => !field.groupId) ?? [];
  const groups = schema
    ? (schema.groups ?? []).filter(group => schema.fields.some(field => field.groupId === group.id))
    : [];
  const unboundRelationSchemas = schema
    ? computeApplicableUnboundRelationSchemas(schema, relationSchemas)
    : [];

  return {
    version: 1,
    tabs: [
      {
        id: 'overview',
        title: 'Overview',
        columns: 2,
        panels: [
          ...(ungroupedFields.length > 0
            ? [
                {
                  id: 'properties',
                  title: 'Properties',
                  collapsible: false,
                  column: 1 as const,
                  blocks: ungroupedFields.map(field => ({
                    id: `field:${field.id}`,
                    kind: 'field' as const,
                    refId: field.id
                  }))
                }
              ]
            : []),
          ...groups.map(group => ({
            id: `group:${group.id}`,
            title: group.name,
            collapsible: false,
            column: 1 as const,
            blocks: [{ id: `fieldGroup:${group.id}`, kind: 'fieldGroup' as const, refId: group.id }]
          })),
          {
            id: 'metadata',
            title: 'Metadata',
            collapsible: true,
            column: 2 as const,
            blocks: [
              { id: 'metadata:publicId', kind: 'metadata' as const, refId: 'publicId' },
              { id: 'metadata:namespace', kind: 'metadata' as const, refId: 'namespace' },
              { id: 'metadata:name', kind: 'metadata' as const, refId: 'name' },
              { id: 'metadata:slug', kind: 'metadata' as const, refId: 'slug' },
              { id: 'metadata:description', kind: 'metadata' as const, refId: 'description' },
              { id: 'metadata:owner', kind: 'metadata' as const, refId: 'owner' },
              { id: 'metadata:lifecycle', kind: 'metadata' as const, refId: 'lifecycle' },
              {
                id: 'metadata:targetLifecycle',
                kind: 'metadata' as const,
                refId: 'targetLifecycle'
              },
              {
                id: 'metadata:targetLifecycleDate',
                kind: 'metadata' as const,
                refId: 'targetLifecycleDate'
              },
              { id: 'metadata:tags', kind: 'metadata' as const, refId: 'tags' }
            ]
          },
          {
            id: 'links',
            title: 'Links',
            collapsible: true,
            column: 2 as const,
            blocks: [{ id: 'links', kind: 'links' as const }]
          },
          ...unboundRelationSchemas.map(relationSchema => ({
            id: `unboundTypedRelation:${relationSchema.id}`,
            title: relationSchema.name,
            collapsible: true,
            column: 2 as const,
            blocks: [
              {
                id: `unboundTypedRelation:${relationSchema.id}`,
                kind: 'unboundTypedRelation' as const,
                refId: relationSchema.id
              }
            ]
          })),
          {
            id: 'projects',
            title: 'Projects',
            collapsible: true,
            column: 2 as const,
            blocks: [{ id: 'projects', kind: 'projects' as const }]
          },
          {
            id: 'diagrams',
            title: 'Diagrams',
            collapsible: true,
            column: 2 as const,
            blocks: [{ id: 'diagrams', kind: 'diagrams' as const }]
          }
        ]
      }
    ]
  };
};
