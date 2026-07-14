import { useCallback, useEffect, useMemo, useState } from 'react';
import type { LayoutAlgorithm, LayoutOptions } from '../../../components/DependencyGraph';
import { useMultipleEntityRelations } from '../../../hooks/useEntities';
import { createDiagramFromGraph } from '../../../lib/diagramFromGraph';
import type { SerializedDiagramDocument } from '@diagram-craft/model/serialization/serializedTypes';
import {
  buildEntityGraphData,
  collectEntityGraphIds,
  type EntityGraphDirection
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
  rootEntityId: string;
  rootEntityName: string;
  rootEntitySchemaId: string;
  maxDepth?: number;
  direction?: EntityGraphDirection;
};

export const useEntityGraphController = ({
  workspaceId,
  rootEntityId,
  rootEntityName,
  rootEntitySchemaId,
  maxDepth: configuredMaxDepth,
  direction: configuredDirection
}: UseEntityGraphControllerOptions) => {
  const [layout, setLayout] = useState<LayoutAlgorithm>('hierarchy');
  const [layoutOptions, setLayoutOptions] = useState<LayoutOptions>(defaultLayoutOptions);
  const [maxDepth, setMaxDepth] = useState(configuredMaxDepth ?? 2);
  const direction = configuredDirection ?? 'both';
  const [excludedIds, setExcludedIds] = useState<Set<string>>(new Set());
  const [manuallyExpanded, setManuallyExpanded] = useState<Set<string>>(new Set());
  const [contextMenu, setContextMenu] = useState<{
    id: string;
    x: number;
    y: number;
  } | null>(null);
  const [fetchIds, setFetchIds] = useState<string[]>(() => [rootEntityId]);
  const [saveDiagramOpen, setSaveDiagramOpen] = useState(false);
  const [pendingDiagramContent, setPendingDiagramContent] =
    useState<SerializedDiagramDocument | null>(null);

  useEffect(() => {
    setFetchIds([rootEntityId]);
    setExcludedIds(new Set());
    setManuallyExpanded(new Set());
  }, [rootEntityId]);

  useEffect(() => {
    if (configuredMaxDepth !== undefined) setMaxDepth(configuredMaxDepth);
  }, [configuredMaxDepth]);

  const relationsData = useMultipleEntityRelations(workspaceId, fetchIds);

  useEffect(() => {
    const next = collectEntityGraphIds({
      rootEntityId,
      relationsData,
      maxDepth,
      excludedIds,
      manuallyExpanded,
      direction
    });
    setFetchIds(previous => {
      const previousIds = new Set(previous);
      return next.some(id => !previousIds.has(id)) ? next : previous;
    });
  }, [rootEntityId, relationsData, maxDepth, excludedIds, manuallyExpanded, direction]);

  const { nodes, edges, hiddenCountMap } = useMemo(
    () =>
      buildEntityGraphData({
        rootEntityId,
        rootEntityName,
        rootEntitySchemaId,
        relationsData,
        maxDepth,
        excludedIds,
        manuallyExpanded,
        direction
      }),
    [
      rootEntityId,
      rootEntityName,
      rootEntitySchemaId,
      relationsData,
      maxDepth,
      excludedIds,
      manuallyExpanded,
      direction
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
      label: node.data.entityName || node.id
    }));
    const graphEdges = edges.map(edge => ({
      id: edge.id,
      from: edge.from,
      to: edge.to,
      label: edge.label,
      kind: edge.kind
    }));
    setPendingDiagramContent(
      createDiagramFromGraph(rootEntityName, graphNodes, graphEdges, {
        layout,
        ...layoutOptions,
        nodeWidth: 200,
        nodeHeight: 52
      })
    );
    setSaveDiagramOpen(true);
  }, [edges, layout, layoutOptions, nodes, rootEntityName]);

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
    contextMenu,
    setContextMenu,
    saveDiagramOpen,
    setSaveDiagramOpen,
    pendingDiagramContent,
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
