import type { RelationRecord } from '@arch-register/api-types/relationContract';
import type { RelationSchema } from '@arch-register/api-types/relationSchemaContract';
import type { DependencyGraphEdge, DependencyGraphNode } from '../../components/DependencyGraph';
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

export type RelationGraphNodeData = {
  entityId: string;
  entityName: string;
  entitySchemaId?: string;
};

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

export const buildRelationGraphData = (
  relations: RelationRecord[],
  relationSchemas: RelationSchema[] = [],
  edgeLabelFieldId: string = RELATION_GRAPH_TYPE_LABEL,
  edgeColorFieldId: string = RELATION_GRAPH_TYPE_LABEL,
  referenceLookup: ReadonlyMap<string, RelationReference> = new Map()
): {
  nodes: DependencyGraphNode<RelationGraphNodeData>[];
  edges: DependencyGraphEdge[];
} => {
  const nodes = new Map<string, RelationGraphNodeData>();
  const relationSchemaById = new Map(relationSchemas.map(schema => [schema.id, schema]));

  for (const relation of relations) {
    if (!nodes.has(relation._in.id)) {
      nodes.set(relation._in.id, {
        entityId: relation._in.id,
        entityName: relation._in.name,
        entitySchemaId: relation._in.schemaId
      });
    }
    if (!nodes.has(relation._out.id)) {
      nodes.set(relation._out.id, {
        entityId: relation._out.id,
        entityName: relation._out.name,
        entitySchemaId: relation._out.schemaId
      });
    }
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

  return {
    nodes: [...nodes.entries()].map(([id, data]) => ({ id, data })),
    edges
  };
};
