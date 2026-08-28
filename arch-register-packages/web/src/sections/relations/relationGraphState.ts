import type { RelationRecord } from '@arch-register/api-types/relationContract';
import type { RelationSchema } from '@arch-register/api-types/relationSchemaContract';
import type { DependencyGraphEdge, DependencyGraphNode } from '../../components/DependencyGraph';
import { relationIds } from '../../lib/entityEditState';
import { RELATION_GRAPH_TYPE_LABEL } from './relationBrowserState';

export const RELATION_GRAPH_COLOR_PALETTE = [
  '#4f8cff',
  '#7c5cff',
  '#d65db1',
  '#f05d5e',
  '#f4a261',
  '#e9c46a',
  '#62b36f',
  '#2a9d8f',
  '#36a2eb',
  '#8d99ae'
] as const;

export type RelationGraphNodeData =
  | { kind: 'entity'; entityId: string; entityName: string; entitySchemaId?: string }
  | { kind: 'relation'; relationId: string; relationSchemaId: string; relationName: string };

export const formatRelationGraphValue = (value: unknown): string => {
  if (value == null || value === '') return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (Array.isArray(value)) return value.map(formatRelationGraphValue).filter(Boolean).join(', ');
  return JSON.stringify(value) ?? String(value);
};

type RelationReference = { name: string };

const formatRelationGraphValueWithReferences = (
  value: unknown,
  referenceLookup: ReadonlyMap<string, RelationReference>
): string => {
  if (Array.isArray(value)) {
    return value
      .map(item => {
        if (typeof item === 'string') return referenceLookup.get(item)?.name ?? item;
        if (item != null && typeof item === 'object' && 'name' in item) {
          const name = (item as { name?: unknown }).name;
          if (typeof name === 'string') return name;
        }
        return formatRelationGraphValue(item);
      })
      .filter(Boolean)
      .join(', ');
  }
  if (typeof value === 'string') return referenceLookup.get(value)?.name ?? value;
  if (value != null && typeof value === 'object' && 'name' in value) {
    const name = (value as { name?: unknown }).name;
    if (typeof name === 'string') return name;
  }
  return formatRelationGraphValue(value);
};

export const getRelationGraphEdgeLabel = (
  relation: RelationRecord,
  edgeLabelFieldId: string = RELATION_GRAPH_TYPE_LABEL,
  referenceLookup: ReadonlyMap<string, RelationReference> = new Map()
): string => {
  if (edgeLabelFieldId === RELATION_GRAPH_TYPE_LABEL) return relation._schema.name;
  return (
    formatRelationGraphValueWithReferences(relation[edgeLabelFieldId], referenceLookup) ||
    relation._schema.name
  );
};

const hashRelationGraphValue = (value: string): number => {
  let hash = 0;
  for (let index = 0; index < value.length; index++) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
};

export const getRelationGraphFieldColor = (value: unknown): string | undefined => {
  const formatted = formatRelationGraphValue(value);
  if (!formatted) return undefined;
  return RELATION_GRAPH_COLOR_PALETTE[
    hashRelationGraphValue(formatted) % RELATION_GRAPH_COLOR_PALETTE.length
  ];
};

export const getRelationGraphEdgeColor = (
  relation: RelationRecord,
  relationSchema: RelationSchema | undefined,
  edgeColorFieldId: string = RELATION_GRAPH_TYPE_LABEL
): string | undefined => {
  if (edgeColorFieldId === RELATION_GRAPH_TYPE_LABEL) return relationSchema?.color ?? undefined;
  return (
    getRelationGraphFieldColor(relation[edgeColorFieldId]) ?? relationSchema?.color ?? undefined
  );
};

export type TypedRelationGraphMode = 'flat' | 'entity';

export type FieldEntityReference = { name: string; schemaId?: string };

const relationNodeId = (relationUid: string): string => `relation::${relationUid}`;

const addEntityNode = (
  nodes: Map<string, RelationGraphNodeData>,
  id: string,
  name: string,
  schemaId?: string
): void => {
  if (!nodes.has(id))
    nodes.set(id, { kind: 'entity', entityId: id, entityName: name, entitySchemaId: schemaId });
};

// Builds a 'flat' node/edge set: one node per unique endpoint entity, one direct edge per
// relation instance from its `_in` to its `_out` endpoint — unchanged since before #3066.
const buildFlatRelationGraphData = (
  relations: RelationRecord[],
  relationSchemaById: ReadonlyMap<string, RelationSchema>,
  edgeLabelFieldId: string,
  edgeColorFieldId: string,
  referenceLookup: ReadonlyMap<string, RelationReference>
): { nodes: Map<string, RelationGraphNodeData>; edges: DependencyGraphEdge[] } => {
  const nodes = new Map<string, RelationGraphNodeData>();
  for (const relation of relations) {
    addEntityNode(nodes, relation._in.id, relation._in.name, relation._in.schemaId);
    addEntityNode(nodes, relation._out.id, relation._out.name, relation._out.schemaId);
  }

  const edges = relations.map(relation => {
    const relationSchema = relationSchemaById.get(relation._schema.id);
    return {
      id: relation._uid,
      from: relation._in.id,
      to: relation._out.id,
      label: getRelationGraphEdgeLabel(relation, edgeLabelFieldId, referenceLookup),
      kind: 'typed',
      color: getRelationGraphEdgeColor(relation, relationSchema, edgeColorFieldId),
      relationId: relation._uid
    } satisfies DependencyGraphEdge;
  });

  return { nodes, edges };
};

// Builds an 'entity' node/edge set: each relation instance becomes its own node (mirroring how
// the workspace model-overview graph renders relation *schemas* as boxes — schemaGraphState.ts's
// buildSchemaGraphData — adapted here from schema-level to instance-level), with "in"/"out" fan
// edges to its endpoint entities, plus one fan edge per entityRelation field the relation schema
// declares to whatever entities that field references (e.g. a Data Flow relation's carried Data
// Entities). Only entities `fieldEntityLookup` resolved get a node/edge — one it couldn't resolve
// (redacted/inaccessible) is silently omitted rather than shown as a blank node.
const buildEntityRelationGraphData = (
  relations: RelationRecord[],
  relationSchemaById: ReadonlyMap<string, RelationSchema>,
  edgeLabelFieldId: string,
  edgeColorFieldId: string,
  referenceLookup: ReadonlyMap<string, RelationReference>,
  fieldEntityLookup: ReadonlyMap<string, FieldEntityReference>
): { nodes: Map<string, RelationGraphNodeData>; edges: DependencyGraphEdge[] } => {
  const nodes = new Map<string, RelationGraphNodeData>();
  const edges: DependencyGraphEdge[] = [];

  for (const relation of relations) {
    addEntityNode(nodes, relation._in.id, relation._in.name, relation._in.schemaId);
    addEntityNode(nodes, relation._out.id, relation._out.name, relation._out.schemaId);

    const relationSchema = relationSchemaById.get(relation._schema.id);
    const nodeId = relationNodeId(relation._uid);
    const color = getRelationGraphEdgeColor(relation, relationSchema, edgeColorFieldId);

    nodes.set(nodeId, {
      kind: 'relation',
      relationId: relation._uid,
      relationSchemaId: relation._schema.id,
      relationName: getRelationGraphEdgeLabel(relation, edgeLabelFieldId, referenceLookup)
    });

    edges.push({
      id: `${relation._uid}::in`,
      from: relation._in.id,
      to: nodeId,
      label: 'in',
      kind: 'typed',
      color,
      relationId: relation._uid
    });
    edges.push({
      id: `${relation._uid}::out`,
      from: nodeId,
      to: relation._out.id,
      label: 'out',
      kind: 'typed',
      color,
      relationId: relation._uid
    });

    for (const field of relationSchema?.fields ?? []) {
      if (field.type !== 'entityRelation') continue;
      for (const entityId of relationIds(relation[field.id])) {
        const referenced = fieldEntityLookup.get(entityId);
        if (!referenced) continue;
        addEntityNode(nodes, entityId, referenced.name, referenced.schemaId);
        edges.push({
          id: `${relation._uid}::field::${field.id}::${entityId}`,
          from: nodeId,
          to: entityId,
          label: field.predicate ?? field.name,
          kind: 'typed',
          color,
          relationId: relation._uid
        });
      }
    }
  }

  return { nodes, edges };
};

export const buildRelationGraphData = (
  relations: RelationRecord[],
  relationSchemas: RelationSchema[] = [],
  edgeLabelFieldId: string = RELATION_GRAPH_TYPE_LABEL,
  edgeColorFieldId: string = RELATION_GRAPH_TYPE_LABEL,
  referenceLookup: ReadonlyMap<string, RelationReference> = new Map(),
  typedRelationMode: TypedRelationGraphMode = 'flat',
  fieldEntityLookup: ReadonlyMap<string, FieldEntityReference> = new Map()
): {
  nodes: DependencyGraphNode<RelationGraphNodeData>[];
  edges: DependencyGraphEdge[];
} => {
  const relationSchemaById = new Map(relationSchemas.map(schema => [schema.id, schema]));

  const { nodes, edges } =
    typedRelationMode === 'entity'
      ? buildEntityRelationGraphData(
          relations,
          relationSchemaById,
          edgeLabelFieldId,
          edgeColorFieldId,
          referenceLookup,
          fieldEntityLookup
        )
      : buildFlatRelationGraphData(
          relations,
          relationSchemaById,
          edgeLabelFieldId,
          edgeColorFieldId,
          referenceLookup
        );

  return {
    nodes: [...nodes.entries()].map(([id, data]) => ({ id, data })),
    edges
  };
};
