import type { EntityRelationData } from '../../../hooks/useEntities';
import type { DependencyGraphEdge, DependencyGraphNode } from '../../../components/DependencyGraph';
import { getRelationDisplayLabel } from '../../../lib/entityRelations';

export type EntityNodeData = {
  entityId: string;
  entityName: string;
  entitySchemaId: string;
  isRoot: boolean;
};

export type EntityGraphDirection = 'upstream' | 'downstream' | 'both';

type DirectedRelation = {
  from: string;
  to: string;
  relation: EntityRelationData['outgoing'][number];
};

type GraphTraversalOptions = {
  rootEntityId: string;
  relationsData: Map<string, EntityRelationData>;
  maxDepth: number;
  excludedIds: ReadonlySet<string>;
  manuallyExpanded: ReadonlySet<string>;
  direction?: EntityGraphDirection;
  relationSchemaIds?: ReadonlySet<string>;
};

const matchesRelationSchemaFilter = (
  relation: DirectedRelation['relation'],
  relationSchemaIds?: ReadonlySet<string>
): boolean => {
  if (!relationSchemaIds || relationSchemaIds.size === 0) return true;
  return (
    relation.kind === 'typed' &&
    !!relation.relationSchemaId &&
    relationSchemaIds.has(relation.relationSchemaId)
  );
};

const getDirectedRelations = (
  entityId: string,
  data: EntityRelationData,
  direction: EntityGraphDirection = 'both',
  relationSchemaIds?: ReadonlySet<string>
): DirectedRelation[] => {
  const relations: DirectedRelation[] = [];

  if (direction === 'upstream' || direction === 'both') {
    for (const relation of data.outgoing) {
      if (!matchesRelationSchemaFilter(relation, relationSchemaIds)) continue;
      relations.push({ from: entityId, to: relation.entityId, relation });
    }
  }

  if (direction === 'downstream' || direction === 'both') {
    for (const relation of data.incoming) {
      if (!matchesRelationSchemaFilter(relation, relationSchemaIds)) continue;
      relations.push({ from: relation.entityId, to: entityId, relation });
    }
  }

  return relations;
};

const collectVisibleNodes = ({
  rootEntityId,
  rootEntityName,
  rootEntitySchemaId,
  relationsData,
  maxDepth,
  excludedIds,
  manuallyExpanded,
  direction = 'both',
  relationSchemaIds
}: GraphTraversalOptions & {
  rootEntityName: string;
  rootEntitySchemaId: string;
}): Map<string, EntityNodeData> => {
  const visibleNodes = new Map<string, EntityNodeData>();
  const queue: Array<{ id: string; depth: number }> = [{ id: rootEntityId, depth: 0 }];
  const visited = new Set<string>([rootEntityId]);

  visibleNodes.set(rootEntityId, {
    entityId: rootEntityId,
    entityName: rootEntityName,
    entitySchemaId: rootEntitySchemaId,
    isRoot: true
  });

  while (queue.length > 0) {
    const { id, depth } = queue.shift()!;
    const data = relationsData.get(id);
    if (!data || data.isLoading) continue;

    const shouldExpand = depth < maxDepth || manuallyExpanded.has(id);
    if (!shouldExpand) continue;

    for (const directedRelation of getDirectedRelations(id, data, direction, relationSchemaIds)) {
      const { relation } = directedRelation;
      if (excludedIds.has(relation.entityId) || visited.has(relation.entityId)) continue;
      visited.add(relation.entityId);
      visibleNodes.set(relation.entityId, {
        entityId: relation.entityId,
        entityName: relation.entityName,
        entitySchemaId: relation.entitySchemaId,
        isRoot: false
      });
      queue.push({ id: relation.entityId, depth: depth + 1 });
    }
  }

  return visibleNodes;
};

export const collectEntityGraphIds = (options: GraphTraversalOptions): string[] =>
  Array.from(
    collectVisibleNodes({
      ...options,
      rootEntityName: '',
      rootEntitySchemaId: ''
    }).keys()
  );

export const buildEntityGraphData = ({
  rootEntityId,
  rootEntityName,
  rootEntitySchemaId,
  relationsData,
  maxDepth,
  excludedIds,
  manuallyExpanded,
  direction = 'both',
  relationSchemaIds
}: GraphTraversalOptions & {
  rootEntityName: string;
  rootEntitySchemaId: string;
}): {
  nodes: DependencyGraphNode<EntityNodeData>[];
  edges: DependencyGraphEdge[];
  hiddenCountMap: Map<string, number>;
} => {
  const visibleNodes = collectVisibleNodes({
    rootEntityId,
    rootEntityName,
    rootEntitySchemaId,
    relationsData,
    maxDepth,
    excludedIds,
    manuallyExpanded,
    direction,
    relationSchemaIds
  });

  const edgeSet = new Set<string>();
  const edges: DependencyGraphEdge[] = [];
  const hiddenCountMap = new Map<string, number>();

  for (const [id] of visibleNodes) {
    const data = relationsData.get(id);
    if (!data || data.isLoading) {
      hiddenCountMap.set(id, 0);
      continue;
    }

    let hiddenCount = 0;
    for (const { from, to, relation } of getDirectedRelations(
      id,
      data,
      direction,
      relationSchemaIds
    )) {
      if (visibleNodes.has(relation.entityId)) {
        const edgeId =
          relation.kind === 'typed' && relation.relationId
            ? `${from}::${to}::typed::${relation.relationId}`
            : `${from}::${to}::${relation.fieldName}`;
        if (!edgeSet.has(edgeId)) {
          edgeSet.add(edgeId);
          edges.push({
            id: edgeId,
            from,
            to,
            label: getRelationDisplayLabel(relation),
            kind: relation.kind,
            color:
              relation.kind === 'typed' ? (relation.relationSchemaColor ?? undefined) : undefined,
            relationId: relation.kind === 'typed' ? relation.relationId : undefined
          });
        }
      } else {
        hiddenCount++;
      }
    }
    hiddenCountMap.set(id, hiddenCount);
  }

  return {
    nodes: Array.from(visibleNodes.entries()).map(([id, data]) => ({ id, data })),
    edges,
    hiddenCountMap
  };
};
