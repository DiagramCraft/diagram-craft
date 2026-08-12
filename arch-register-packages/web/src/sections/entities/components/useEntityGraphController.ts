import { useCallback, useEffect, useMemo, useState } from 'react';
import type { LayoutAlgorithm, LayoutOptions } from '../../../components/DependencyGraph';
import { useMultipleEntityRelations } from '../../../hooks/useEntities';
import { createDiagramFromGraph } from '../../../lib/diagramFromGraph';
import type { SerializedDiagramDocument } from '@diagram-craft/model/serialization/serializedTypes';
import {
  buildEntityGraphData,
  collectEntityGraphIds,
  type EntityGraphDirection,
  type EntityGraphRoot
} from './entityGraphState';

const defaultLayoutOptions: LayoutOptions = {
  horizontalSpacing: 230,
  verticalSpacing: 108,
  iterations: 300,
  springStrength: 0.5,
  repulsionStrength: 1,
  idealEdgeLength: 160,
  crossingMinimizationIterations: 10
};

type UseEntityGraphControllerOptions = {
  workspaceId: string;
  rootEntityId?: string;
  rootEntityName?: string;
  rootEntitySchemaId?: string;
  rootEntities?: readonly EntityGraphRoot[];
  graphName?: string;
  maxDepth?: number;
  direction?: EntityGraphDirection;
  relationSchemaIds?: readonly string[];
};

export const useEntityGraphController = ({
  workspaceId,
  rootEntityId,
  rootEntityName,
  rootEntitySchemaId,
  rootEntities: configuredRoots,
  graphName,
  maxDepth: configuredMaxDepth,
  direction: configuredDirection,
  relationSchemaIds: configuredRelationSchemaIds
}: UseEntityGraphControllerOptions) => {
  const rootEntities = useMemo(() => {
    if (configuredRoots && configuredRoots.length > 0) {
      return Array.from(new Map(configuredRoots.map(root => [root.entityId, root])).values());
    }
    return rootEntityId
      ? [
          {
            entityId: rootEntityId,
            entityName: rootEntityName ?? '',
            entitySchemaId: rootEntitySchemaId ?? ''
          }
        ]
      : [];
  }, [configuredRoots, rootEntityId, rootEntityName, rootEntitySchemaId]);
  const rootIds = useMemo(() => rootEntities.map(root => root.entityId), [rootEntities]);
  const [layout, setLayout] = useState<LayoutAlgorithm>('hierarchy');
  const [layoutOptions, setLayoutOptions] = useState<LayoutOptions>(defaultLayoutOptions);
  const [maxDepth, setMaxDepth] = useState(configuredMaxDepth ?? 2);
  const [direction, setDirection] = useState<EntityGraphDirection>(configuredDirection ?? 'both');
  const [relationSchemaFilter, setRelationSchemaFilter] = useState<Set<string>>(
    () => new Set(configuredRelationSchemaIds ?? [])
  );
  const [excludedIds, setExcludedIds] = useState<Set<string>>(new Set());
  const [manuallyExpanded, setManuallyExpanded] = useState<Set<string>>(new Set());
  const [contextMenu, setContextMenu] = useState<{
    id: string;
    x: number;
    y: number;
  } | null>(null);
  const [fetchIds, setFetchIds] = useState<string[]>(rootIds);
  const [saveDiagramOpen, setSaveDiagramOpen] = useState(false);
  const [pendingDiagramContent, setPendingDiagramContent] =
    useState<SerializedDiagramDocument | null>(null);

  useEffect(() => {
    setFetchIds(rootIds);
    setExcludedIds(new Set());
    setManuallyExpanded(new Set());
  }, [rootIds]);

  useEffect(() => {
    if (configuredMaxDepth !== undefined) setMaxDepth(configuredMaxDepth);
  }, [configuredMaxDepth]);

  useEffect(() => {
    if (configuredDirection !== undefined) setDirection(configuredDirection);
  }, [configuredDirection]);

  useEffect(() => {
    if (configuredRelationSchemaIds !== undefined) {
      setRelationSchemaFilter(new Set(configuredRelationSchemaIds));
    }
  }, [configuredRelationSchemaIds]);

  const relationsData = useMultipleEntityRelations(workspaceId, fetchIds);

  useEffect(() => {
    const next = collectEntityGraphIds({
      rootEntities,
      relationsData,
      maxDepth,
      excludedIds,
      manuallyExpanded,
      direction,
      relationSchemaIds: relationSchemaFilter
    });
    setFetchIds(previous => {
      const previousIds = new Set(previous);
      return next.some(id => !previousIds.has(id)) ? next : previous;
    });
  }, [
    rootEntities,
    relationsData,
    maxDepth,
    excludedIds,
    manuallyExpanded,
    direction,
    relationSchemaFilter
  ]);

  const { nodes, edges, hiddenCountMap } = useMemo(
    () =>
      buildEntityGraphData({
        rootEntities,
        relationsData,
        maxDepth,
        excludedIds,
        manuallyExpanded,
        direction,
        relationSchemaIds: relationSchemaFilter
      }),
    [
      rootEntities,
      relationsData,
      maxDepth,
      excludedIds,
      manuallyExpanded,
      direction,
      relationSchemaFilter
    ]
  );

  const resetGraph = useCallback(() => {
    setExcludedIds(new Set());
    setManuallyExpanded(new Set());
  }, []);

  const excludeEntity = useCallback((id: string) => {
    setExcludedIds(previous => new Set([...previous, id]));
    setContextMenu(null);
  }, []);

  const expandEntity = useCallback(
    (id: string) => {
      setManuallyExpanded(previous => new Set([...previous, id]));
      const nodeData = relationsData.get(id);
      if (nodeData) {
        const neighborIds = new Set(
          (direction === 'upstream'
            ? nodeData.outgoing
            : direction === 'downstream'
              ? nodeData.incoming
              : [...nodeData.outgoing, ...nodeData.incoming]
          ).map(relation => relation.entityId)
        );
        setExcludedIds(previous => {
          const next = new Set(previous);
          for (const neighborId of neighborIds) next.delete(neighborId);
          return next;
        });
      }
      setContextMenu(null);
    },
    [direction, relationsData]
  );

  const createDiagram = useCallback(() => {
    const graphNodes = nodes.map(node => ({
      id: node.id,
      label: node.data.entityName ?? node.id
    }));
    const graphEdges = edges.map(edge => ({
      id: edge.id,
      from: edge.from,
      to: edge.to,
      label: edge.label,
      kind: edge.kind
    }));
    setPendingDiagramContent(
      createDiagramFromGraph(
        graphName ?? rootEntityName ?? 'Entity graph',
        graphNodes,
        graphEdges,
        {
          layout,
          ...layoutOptions,
          nodeWidth: 200,
          nodeHeight: 52
        }
      )
    );
    setSaveDiagramOpen(true);
  }, [edges, graphName, layout, layoutOptions, nodes, rootEntityName]);

  return {
    layout,
    setLayout,
    layoutOptions,
    setLayoutOptions,
    maxDepth,
    setMaxDepth,
    excludedIds,
    manuallyExpanded,
    direction,
    setDirection,
    relationSchemaFilter,
    setRelationSchemaFilter,
    contextMenu,
    setContextMenu,
    saveDiagramOpen,
    setSaveDiagramOpen,
    pendingDiagramContent,
    rootEntityIds: new Set(rootIds),
    nodes,
    edges,
    hiddenCountMap,
    isAnyLoading: Array.from(relationsData.values()).some(data => data.isLoading),
    resetGraph,
    excludeEntity,
    expandEntity,
    createDiagram
  };
};
