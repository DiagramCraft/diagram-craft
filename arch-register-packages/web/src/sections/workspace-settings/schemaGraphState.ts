import type { RelationSchema } from '@arch-register/api-types/relationSchemaContract';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import type { DependencyGraphEdge, DependencyGraphNode } from '../../components/DependencyGraph';

export type SchemaGraphNodeData =
  | { kind: 'entity'; schema: EntitySchema }
  | { kind: 'relation'; relationSchema: RelationSchema };

export type SchemaGraphData = {
  nodes: DependencyGraphNode<SchemaGraphNodeData>[];
  edges: DependencyGraphEdge[];
};

const relationNodeId = (relationSchemaId: string): string => `relation::${relationSchemaId}`;

const schemaPairKey = (from: string, to: string): string => `${from}::${to}`;

const endpointSchemaIds = (
  endpoint: RelationSchema['in'],
  schemaIds: ReadonlySet<string>
): string[] => (endpoint.schemaIds === 'any' ? [...schemaIds] : [...new Set(endpoint.schemaIds)]);

export const buildSchemaGraphData = (
  schemas: EntitySchema[],
  relationSchemas: RelationSchema[]
): SchemaGraphData => {
  const schemaIds = new Set(schemas.map(schema => schema.id));
  const referenceEdges = new Map<string, { fields: string[]; kind: string }>();
  const typedEdges: DependencyGraphEdge[] = [];

  for (const schema of schemas) {
    for (const field of schema.fields) {
      if (field.type !== 'reference' && field.type !== 'containment') continue;
      if (!schemaIds.has(field.schemaId)) continue;

      const pairKey = schemaPairKey(schema.id, field.schemaId);
      const existing = referenceEdges.get(pairKey);

      if (existing) {
        existing.fields.push(field.name);
        if (field.type === 'containment' && existing.kind !== 'containment') {
          existing.kind = 'containment';
        }
      } else {
        referenceEdges.set(pairKey, {
          fields: [field.name],
          kind: field.type
        });
      }
    }
  }

  for (const relationSchema of relationSchemas) {
    const relationId = relationNodeId(relationSchema.id);
    const color = relationSchema.color ?? undefined;

    // Keep the existing model-overview orientation: an "out" endpoint points into the
    // relation, which then points to each allowed "in" endpoint. Relation-schema endpoint
    // constraints are the canonical topology source, so bindings on both entity schemas cannot
    // create duplicate entity-to-entity edges.
    for (const schemaId of endpointSchemaIds(relationSchema.out, schemaIds)) {
      if (!schemaIds.has(schemaId)) continue;
      typedEdges.push({
        id: `${schemaId}::${relationId}::typed::${relationSchema.id}::out`,
        from: schemaId,
        to: relationId,
        label: 'out',
        kind: 'typed',
        color,
        relationId: relationSchema.id
      });
    }

    for (const schemaId of endpointSchemaIds(relationSchema.in, schemaIds)) {
      if (!schemaIds.has(schemaId)) continue;
      typedEdges.push({
        id: `${relationId}::${schemaId}::typed::${relationSchema.id}::in`,
        from: relationId,
        to: schemaId,
        label: 'in',
        kind: 'typed',
        color,
        relationId: relationSchema.id
      });
    }

    for (const field of relationSchema.fields) {
      if (field.type !== 'entityRelation') continue;
      if (!schemaIds.has(field.schemaId)) continue;

      typedEdges.push({
        id: `${relationId}::${field.schemaId}::relation-field::${relationSchema.id}::${field.id}`,
        from: relationId,
        to: field.schemaId,
        label: field.predicate ?? field.name,
        kind: 'typed',
        color,
        relationId: relationSchema.id
      });
    }
  }

  const genericEdges: DependencyGraphEdge[] = Array.from(referenceEdges.entries()).map(
    ([pairKey, data]) => {
      const [from, to] = pairKey.split('::');
      return {
        id: pairKey,
        from: from!,
        to: to!,
        label: data.fields.join(', '),
        kind: data.kind
      };
    }
  );

  return {
    nodes: [
      ...schemas.map(schema => ({
        id: schema.id,
        data: { kind: 'entity' as const, schema }
      })),
      ...relationSchemas.map(relationSchema => ({
        id: relationNodeId(relationSchema.id),
        data: { kind: 'relation' as const, relationSchema }
      }))
    ],
    edges: [...genericEdges, ...typedEdges]
  };
};

/**
 * Compatibility helper for callers that only need the model-overview edges.
 * The graph view itself should consume buildSchemaGraphData so relation nodes and edges stay in sync.
 */
export const buildSchemaGraphEdges = (
  schemas: EntitySchema[],
  relationSchemas: RelationSchema[]
): DependencyGraphEdge[] => buildSchemaGraphData(schemas, relationSchemas).edges;
