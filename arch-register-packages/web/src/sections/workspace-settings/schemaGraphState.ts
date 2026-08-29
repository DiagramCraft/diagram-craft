import type { RelationSchema } from '@arch-register/api-types/relationSchemaContract';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import { UNCATEGORIZED_SCHEMA_CATEGORY } from '../../lib/schemaPresentation';
import type { DependencyGraphEdge, DependencyGraphNode } from '../../components/DependencyGraph';

export type SchemaGraphNodeData =
  | { kind: 'entity'; schema: EntitySchema }
  | { kind: 'relation'; relationSchema: RelationSchema }
  | { kind: 'category'; category: string; count: number };

export type SchemaGraphData = {
  nodes: DependencyGraphNode<SchemaGraphNodeData>[];
  edges: DependencyGraphEdge[];
};

export type EntityCategoryState = 'collapsed' | 'hidden';

// Absent key means the category is visible (the default).
export type EntityCategoryStates = ReadonlyMap<string, EntityCategoryState>;

// 'entity' (default) renders each relation type as its own node with "out"/"in" fan edges.
// 'reference' always renders typed relations as a single direct entity-to-entity edge, the
// same simplification that otherwise only kicks in once one of the relation's endpoints is
// collapsed or hidden.
export type TypedRelationRenderMode = 'entity' | 'reference';

const relationNodeId = (relationSchemaId: string): string => `relation::${relationSchemaId}`;

const categoryNodeId = (category: string): string => `category::${category}`;

const schemaPairKey = (from: string, to: string): string => `${from}::${to}`;

const endpointSchemaIds = (
  endpoint: RelationSchema['in'],
  schemaIds: ReadonlySet<string>
): string[] => (endpoint.schemaIds === 'any' ? [...schemaIds] : [...new Set(endpoint.schemaIds)]);

// Resolves an entity schema id to: itself (visible), a synthetic category-box id (collapsed),
// or null (hidden, dropped from the graph entirely). Relation node ids never pass through this.
const buildEntityIdResolver = (
  schemas: EntitySchema[],
  categoryStates: EntityCategoryStates
): Map<string, string | null> => {
  const resolver = new Map<string, string | null>();
  for (const schema of schemas) {
    const category = schema.category?.name ?? UNCATEGORIZED_SCHEMA_CATEGORY;
    const state = categoryStates.get(category);
    if (state === 'hidden') {
      resolver.set(schema.id, null);
    } else if (state === 'collapsed') {
      resolver.set(schema.id, categoryNodeId(category));
    } else {
      resolver.set(schema.id, schema.id);
    }
  }
  return resolver;
};

const typedEdgeKey = (edge: DependencyGraphEdge): string =>
  `${edge.from}::${edge.to}::${edge.label ?? ''}::${edge.relationId ?? ''}`;

export const buildSchemaGraphData = (
  schemas: EntitySchema[],
  relationSchemas: RelationSchema[],
  categoryStates: EntityCategoryStates = new Map(),
  typedRelationMode: TypedRelationRenderMode = 'entity'
): SchemaGraphData => {
  const schemaIds = new Set(schemas.map(schema => schema.id));
  const entityResolver = buildEntityIdResolver(schemas, categoryStates);
  const referenceEdges = new Map<
    string,
    { from: string; to: string; fields: string[]; kind: string }
  >();
  const typedEdgeMap = new Map<string, DependencyGraphEdge>();

  const addTypedEdge = (edge: DependencyGraphEdge): void => {
    const key = typedEdgeKey(edge);
    if (!typedEdgeMap.has(key)) typedEdgeMap.set(key, edge);
  };

  for (const schema of schemas) {
    const resolvedFrom = entityResolver.get(schema.id) ?? null;
    if (resolvedFrom === null) continue;

    for (const field of schema.fields) {
      if (field.type !== 'reference' && field.type !== 'containment') continue;
      if (!schemaIds.has(field.schemaId)) continue;

      const resolvedTo = entityResolver.get(field.schemaId) ?? null;
      if (resolvedTo === null) continue;
      if (resolvedTo === resolvedFrom) continue;

      const pairKey = schemaPairKey(resolvedFrom, resolvedTo);
      const existing = referenceEdges.get(pairKey);

      if (existing) {
        existing.fields.push(field.name);
        if (field.type === 'containment' && existing.kind !== 'containment') {
          existing.kind = 'containment';
        }
      } else {
        referenceEdges.set(pairKey, {
          from: resolvedFrom,
          to: resolvedTo,
          fields: [field.name],
          kind: field.type
        });
      }
    }
  }

  const collapsedRelationSchemaIds = new Set<string>();

  for (const relationSchema of relationSchemas) {
    const relationId = relationNodeId(relationSchema.id);
    const color = relationSchema.color ?? undefined;

    const outSchemaIds = endpointSchemaIds(relationSchema.out, schemaIds).filter(id =>
      schemaIds.has(id)
    );
    const inSchemaIds = endpointSchemaIds(relationSchema.in, schemaIds).filter(id =>
      schemaIds.has(id)
    );

    // If any endpoint entity this relation type binds to has been collapsed into a category
    // box or hidden, the dedicated relation node (and its "out"/"in" fan) stops adding
    // information over a plain edge — replace it with direct, deduped entity-to-entity edges
    // instead, same as a generic reference edge, so collapsing a category actually declutters
    // typed relations too.
    const isCollapsed =
      typedRelationMode === 'reference' ||
      [...outSchemaIds, ...inSchemaIds].some(id => entityResolver.get(id) !== id);

    if (isCollapsed) {
      collapsedRelationSchemaIds.add(relationSchema.id);

      const resolvedOut = new Set(
        outSchemaIds.map(id => entityResolver.get(id) ?? null).filter((id): id is string => !!id)
      );
      const resolvedIn = new Set(
        inSchemaIds.map(id => entityResolver.get(id) ?? null).filter((id): id is string => !!id)
      );

      for (const from of resolvedIn) {
        for (const to of resolvedOut) {
          if (from === to) continue;

          addTypedEdge({
            id: `${relationId}::direct::${from}::${to}`,
            from,
            to,
            label: relationSchema.name,
            kind: 'typed',
            color,
            relationId: relationSchema.id
          });
        }
      }

      continue;
    }

    // An "in" endpoint points into the relation, which then points out to each allowed "out"
    // endpoint. Relation-schema endpoint constraints are the canonical topology source, so
    // bindings on both entity schemas cannot create duplicate entity-to-entity edges.
    for (const schemaId of inSchemaIds) {
      addTypedEdge({
        id: `${schemaId}::${relationId}::typed::${relationSchema.id}::in`,
        from: schemaId,
        to: relationId,
        label: 'in',
        kind: 'typed',
        color,
        relationId: relationSchema.id
      });
    }

    for (const schemaId of outSchemaIds) {
      addTypedEdge({
        id: `${relationId}::${schemaId}::typed::${relationSchema.id}::out`,
        from: relationId,
        to: schemaId,
        label: 'out',
        kind: 'typed',
        color,
        relationId: relationSchema.id
      });
    }

    for (const field of relationSchema.fields) {
      if (field.type !== 'entityRelation') continue;
      if (!schemaIds.has(field.schemaId)) continue;

      const resolved = entityResolver.get(field.schemaId) ?? null;
      if (resolved === null) continue;

      addTypedEdge({
        id: `${relationId}::${field.schemaId}::relation-field::${relationSchema.id}::${field.id}`,
        from: relationId,
        to: resolved,
        label: field.predicate ?? field.name,
        kind: 'typed',
        color,
        relationId: relationSchema.id
      });
    }
  }

  const genericEdges: DependencyGraphEdge[] = Array.from(referenceEdges.entries()).map(
    ([pairKey, data]) => ({
      id: pairKey,
      from: data.from,
      to: data.to,
      label: data.fields.join(', '),
      kind: data.kind
    })
  );

  const visibleEntitySchemas = schemas.filter(
    schema => entityResolver.get(schema.id) === schema.id
  );
  const visibleRelationSchemas = relationSchemas.filter(
    relationSchema => !collapsedRelationSchemaIds.has(relationSchema.id)
  );

  const categoryCounts = new Map<string, number>();
  for (const schema of schemas) {
    const category = schema.category?.name ?? UNCATEGORIZED_SCHEMA_CATEGORY;
    if (categoryStates.get(category) === 'collapsed') {
      categoryCounts.set(category, (categoryCounts.get(category) ?? 0) + 1);
    }
  }

  return {
    nodes: [
      ...visibleEntitySchemas.map(schema => ({
        id: schema.id,
        data: { kind: 'entity' as const, schema }
      })),
      ...Array.from(categoryCounts.entries()).map(([category, count]) => ({
        id: categoryNodeId(category),
        data: { kind: 'category' as const, category, count }
      })),
      ...visibleRelationSchemas.map(relationSchema => ({
        id: relationNodeId(relationSchema.id),
        data: { kind: 'relation' as const, relationSchema }
      }))
    ],
    edges: [...genericEdges, ...typedEdgeMap.values()]
  };
};

/**
 * Compatibility helper for callers that only need the model-overview edges.
 * The graph view itself should consume buildSchemaGraphData so relation nodes and edges stay in sync.
 */
export const buildSchemaGraphEdges = (
  schemas: EntitySchema[],
  relationSchemas: RelationSchema[],
  categoryStates: EntityCategoryStates = new Map(),
  typedRelationMode: TypedRelationRenderMode = 'entity'
): DependencyGraphEdge[] =>
  buildSchemaGraphData(schemas, relationSchemas, categoryStates, typedRelationMode).edges;

export const parseCategoryStatesParam = (raw: string | undefined): EntityCategoryStates => {
  if (!raw) return new Map();
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return new Map();

    const result = new Map<string, EntityCategoryState>();
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (value === 'collapsed' || value === 'hidden') result.set(key, value);
    }
    return result;
  } catch {
    return new Map();
  }
};

export const serializeCategoryStatesParam = (states: EntityCategoryStates): string | undefined => {
  const entries = [...states.entries()].filter(
    ([, state]) => state === 'collapsed' || state === 'hidden'
  );
  if (entries.length === 0) return undefined;
  return JSON.stringify(Object.fromEntries(entries));
};
