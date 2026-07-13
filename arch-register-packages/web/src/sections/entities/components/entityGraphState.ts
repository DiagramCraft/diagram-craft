import type { EntityRelationData } from '../../../hooks/useEntities';
import type {
  DependencyGraphEdge,
  DependencyGraphNode
} from '../../../components/DependencyGraph';
import { getRelationDisplayLabel } from '../../../lib/entityRelations';

export type EntityNodeData = {
  entityId: string;
  entityName: string;
  entitySchemaId: string;
  isRoot: boolean;
};

type GraphTraversalOptions = {
  rootEntityId: string;
  relationsData: Map<string, EntityRelationData>;
  maxDepth: number;
  excludedIds: ReadonlySet<string>;
  manuallyExpanded: ReadonlySet<string>;
};

const collectVisibleNodes = ({
  rootEntityId,
  rootEntityName,
  rootEntitySchemaId,
  relationsData,
  maxDepth,
  excludedIds,
  manuallyExpanded
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

    for (const relation of [...data.outgoing, ...data.incoming]) {
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
  manuallyExpanded
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
    manuallyExpanded
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
    for (const relation of data.outgoing) {
      if (visibleNodes.has(relation.entityId)) {
        const edgeId = `${id}::${relation.entityId}::${relation.fieldName}`;
        if (!edgeSet.has(edgeId)) {
          edgeSet.add(edgeId);
          edges.push({
            id: edgeId,
            from: id,
            to: relation.entityId,
            label: getRelationDisplayLabel(relation),
            kind: relation.kind
          });
        }
      } else {
        hiddenCount++;
      }
    }
    for (const relation of data.incoming) {
      if (!visibleNodes.has(relation.entityId)) hiddenCount++;
    }
    hiddenCountMap.set(id, hiddenCount);
  }

  return {
    nodes: Array.from(visibleNodes.entries()).map(([id, data]) => ({ id, data })),
    edges,
    hiddenCountMap
  };
};
