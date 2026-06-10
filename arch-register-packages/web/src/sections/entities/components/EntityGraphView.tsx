import { useState, useMemo, useEffect, useCallback } from 'react';
import { DependencyGraph } from '../../../components/DependencyGraph';
import type {
  LayoutAlgorithm,
  DependencyGraphEdge,
  DependencyGraphNode,
  LayoutOptions
} from '../../../components/DependencyGraph';
import { TypeBadge } from '../../../components/TypeBadge';
import { Button } from '@diagram-craft/app-components/Button';
import { Select } from '@diagram-craft/app-components/Select';
import { NumberInput } from '@diagram-craft/app-components/NumberInput';
import { ContextMenu } from '@diagram-craft/app-components/src/ContextMenu';
import { Menu } from '@diagram-craft/app-components/src/Menu';
import { resolveSchemaColor } from '../../../lib/api';
import { useMultipleEntityRelations } from '../../../hooks/useEntities';
import { TbEyeOff, TbPlus, TbVectorTriangle } from 'react-icons/tb';
import styles from './EntityGraphView.module.css';
import { EntitySchema } from '@arch-register/api-types/schemas';

type EntityNodeData = {
  entityId: string;
  entityName: string;
  entitySchemaId: string;
  isRoot: boolean;
};

type Props = {
  workspaceId: string;
  rootEntityId: string;
  rootEntityName: string;
  rootEntitySchemaId: string;
  schemas: EntitySchema[];
  onEntityClick: (id: string) => void;
};

export const EntityGraphView = ({
  workspaceId,
  rootEntityId,
  rootEntityName,
  rootEntitySchemaId,
  schemas,
  onEntityClick
}: Props) => {
  const [layout, setLayout] = useState<LayoutAlgorithm>('hierarchy');
  const [layoutOptions, setLayoutOptions] = useState<LayoutOptions>({
    horizontalSpacing: 230,
    verticalSpacing: 108,
    iterations: 300,
    springStrength: 0.5,
    repulsionStrength: 1.0,
    idealEdgeLength: 160,
    crossingMinimizationIterations: 10
  });
  const [maxDepth, setMaxDepth] = useState(2);
  const [excludedIds, setExcludedIds] = useState<Set<string>>(new Set());
  const [manuallyExpanded, setManuallyExpanded] = useState<Set<string>>(new Set());
  const [contextMenu, setContextMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const [fetchIds, setFetchIds] = useState<string[]>(() => [rootEntityId]);

  // Reset when navigating to a different entity
  useEffect(() => {
    setFetchIds([rootEntityId]);
    setExcludedIds(new Set());
    setManuallyExpanded(new Set());
  }, [rootEntityId]);

  const relationsData = useMultipleEntityRelations(workspaceId, fetchIds);

  // Reactively expand fetchIds as relation data arrives (BFS waterfall)
  useEffect(() => {
    const ids = new Set<string>([rootEntityId]);
    const queue: Array<{ id: string; depth: number }> = [{ id: rootEntityId, depth: 0 }];
    const visited = new Set<string>([rootEntityId]);

    while (queue.length > 0) {
      const { id, depth } = queue.shift()!;
      const data = relationsData.get(id);
      if (!data || data.isLoading) continue;

      const shouldExpand = depth < maxDepth || manuallyExpanded.has(id);
      if (!shouldExpand) continue;

      const neighbors = [...data.outgoing, ...data.incoming];
      for (const rel of neighbors) {
        if (excludedIds.has(rel.entityId) || visited.has(rel.entityId)) continue;
        visited.add(rel.entityId);
        ids.add(rel.entityId);
        queue.push({ id: rel.entityId, depth: depth + 1 });
      }
    }

    const next = Array.from(ids);
    setFetchIds(prev => {
      const prevSet = new Set(prev);
      return next.some(id => !prevSet.has(id)) ? next : prev;
    });
  }, [rootEntityId, relationsData, maxDepth, excludedIds, manuallyExpanded]);

  // Build the visible graph via BFS
  const { nodes, edges, hiddenCountMap } = useMemo(() => {
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

      const neighbors = [...data.outgoing, ...data.incoming];
      for (const rel of neighbors) {
        if (excludedIds.has(rel.entityId)) continue;
        if (!visited.has(rel.entityId)) {
          visited.add(rel.entityId);
          visibleNodes.set(rel.entityId, {
            entityId: rel.entityId,
            entityName: rel.entityName,
            entitySchemaId: rel.entitySchemaId,
            isRoot: false
          });
          queue.push({ id: rel.entityId, depth: depth + 1 });
        }
      }
    }

    // Build edges (deduplicating by from::to::fieldName) and hidden counts in one pass
    const edgeSet = new Set<string>();
    const visibleEdges: DependencyGraphEdge[] = [];
    const hiddenCountMap = new Map<string, number>();
    for (const [id] of visibleNodes) {
      const data = relationsData.get(id);
      if (!data || data.isLoading) {
        hiddenCountMap.set(id, 0);
        continue;
      }
      let hiddenCount = 0;
      for (const rel of data.outgoing) {
        if (visibleNodes.has(rel.entityId)) {
          const edgeId = `${id}::${rel.entityId}::${rel.fieldName}`;
          if (!edgeSet.has(edgeId)) {
            edgeSet.add(edgeId);
            visibleEdges.push({
              id: edgeId,
              from: id,
              to: rel.entityId,
              label: rel.fieldName,
              kind: rel.kind
            });
          }
        } else {
          hiddenCount++;
        }
      }
      for (const rel of data.incoming) {
        if (!visibleNodes.has(rel.entityId)) hiddenCount++;
      }
      hiddenCountMap.set(id, hiddenCount);
    }

    const nodeArray: DependencyGraphNode<EntityNodeData>[] = Array.from(visibleNodes.entries()).map(
      ([id, data]) => ({ id, data })
    );

    return { nodes: nodeArray, edges: visibleEdges, hiddenCountMap };
  }, [
    rootEntityId,
    rootEntityName,
    rootEntitySchemaId,
    relationsData,
    maxDepth,
    excludedIds,
    manuallyExpanded
  ]);

  const isAnyLoading = Array.from(relationsData.values()).some(d => d.isLoading);

  const schemaMap = useMemo(
    () => new Map(schemas.map((s, i) => [s.id, { schema: s, idx: i }])),
    [schemas]
  );

  const renderNode = useCallback(
    (node: DependencyGraphNode<EntityNodeData>) => {
      const { entitySchemaId, entityName } = node.data;
      const entry = schemaMap.get(entitySchemaId);
      const schema = entry?.schema;
      const color = schema ? resolveSchemaColor(schema, entry!.idx) : 'var(--accent-fg)';
      const hiddenCount = hiddenCountMap.get(node.id) ?? 0;
      return (
        <>
          <TypeBadge color={color} name={schema?.name} icon={schema?.icon} size={16} />
          <span className={styles.eNodeName}>{entityName || node.id}</span>
          {hiddenCount > 0 && <span className={styles.eHiddenBadge}>+{hiddenCount}</span>}
        </>
      );
    },
    [schemaMap, hiddenCountMap]
  );

  const handleNodeContextMenu = useCallback((id: string, e: React.MouseEvent) => {
    setContextMenu({ id, x: e.clientX, y: e.clientY });
  }, []);

  const rootHighlight = useMemo(() => new Set([rootEntityId]), [rootEntityId]);

  return (
    <div className={styles.icEntityGraphView}>
      <div className={styles.eToolbar}>
        <span className={styles.eToolbarLabel}>Layout</span>
        <Select.Root
          value={layout}
          onChange={v => {
            if (v) setLayout(v as LayoutAlgorithm);
          }}
        >
          <Select.Item value="hierarchy">Hierarchy</Select.Item>
          <Select.Item value="layered">Layered</Select.Item>
          <Select.Item value="force">Force-directed</Select.Item>
          <Select.Item value="tree">Tree</Select.Item>
        </Select.Root>

        <div className={styles.eToolbarSeparator} />

        <span className={styles.eToolbarLabel}>Depth</span>
        <NumberInput
          value={maxDepth}
          onChange={v => {
            if (v !== undefined) setMaxDepth(v);
          }}
          min={1}
          max={5}
          step={1}
          style={{ width: '50px' }}
        />

        {(layout === 'hierarchy' || layout === 'layered' || layout === 'tree') && (
          <>
            <div className={styles.eToolbarSeparator} />
            <span className={styles.eToolbarLabel}>H-Space</span>
            <NumberInput
              value={layoutOptions.horizontalSpacing ?? 200}
              onChange={v => setLayoutOptions(prev => ({ ...prev, horizontalSpacing: v }))}
              min={50}
              max={500}
              step={10}
              style={{ width: '60px' }}
            />
            <span className={styles.eToolbarLabel}>V-Space</span>
            <NumberInput
              value={layoutOptions.verticalSpacing ?? 108}
              onChange={v => setLayoutOptions(prev => ({ ...prev, verticalSpacing: v }))}
              min={50}
              max={300}
              step={10}
              style={{ width: '60px' }}
            />
          </>
        )}

        {(layout === 'hierarchy' || layout === 'layered') && (
          <>
            <span className={styles.eToolbarLabel}>Crossings</span>
            <NumberInput
              value={layoutOptions.crossingMinimizationIterations ?? 10}
              onChange={v =>
                setLayoutOptions(prev => ({ ...prev, crossingMinimizationIterations: v }))
              }
              min={1}
              max={50}
              step={1}
              style={{ width: '50px' }}
            />
          </>
        )}

        {layout === 'force' && (
          <>
            <div className={styles.eToolbarSeparator} />
            <span className={styles.eToolbarLabel}>Iterations</span>
            <NumberInput
              value={layoutOptions.iterations ?? 300}
              onChange={v => setLayoutOptions(prev => ({ ...prev, iterations: v }))}
              min={50}
              max={1000}
              step={50}
              style={{ width: '60px' }}
            />
            <span className={styles.eToolbarLabel}>Spring</span>
            <NumberInput
              value={layoutOptions.springStrength ?? 0.5}
              onChange={v => setLayoutOptions(prev => ({ ...prev, springStrength: v }))}
              min={0.1}
              max={2.0}
              step={0.1}
              style={{ width: '50px' }}
            />
            <span className={styles.eToolbarLabel}>Repulsion</span>
            <NumberInput
              value={layoutOptions.repulsionStrength ?? 1.0}
              onChange={v => setLayoutOptions(prev => ({ ...prev, repulsionStrength: v }))}
              min={0.1}
              max={3.0}
              step={0.1}
              style={{ width: '50px' }}
            />
            <span className={styles.eToolbarLabel}>Length</span>
            <NumberInput
              value={layoutOptions.idealEdgeLength ?? 160}
              onChange={v => setLayoutOptions(prev => ({ ...prev, idealEdgeLength: v }))}
              min={50}
              max={500}
              step={10}
              style={{ width: '60px' }}
            />
          </>
        )}

        {isAnyLoading && <span className={styles.eLoadingText}>Loading…</span>}

        <Button
          className={styles.eResetButton}
          disabled={excludedIds.size === 0 && manuallyExpanded.size === 0}
          size={'sm'}
          onClick={() => {
            setExcludedIds(new Set());
            setManuallyExpanded(new Set());
          }}
        >
          Reset
        </Button>
      </div>

      <div className={styles.eCanvas}>
        {nodes.length === 0 && !isAnyLoading ? (
          <div className={styles.eEmpty}>
            <TbVectorTriangle size={22} />
            <div className={styles.eEmptyTitle}>No relationships found.</div>
            <div>This entity has no outgoing relationships to display.</div>
          </div>
        ) : (
          <DependencyGraph<EntityNodeData>
            nodes={nodes}
            edges={edges}
            layout={layout}
            layoutOptions={layoutOptions}
            nodeWidth={200}
            nodeHeight={52}
            renderNode={renderNode}
            onNodeClick={onEntityClick}
            onNodeContextMenu={handleNodeContextMenu}
            highlightedIds={rootHighlight}
          />
        )}
      </div>

      {contextMenu && (
        <ContextMenu.Imperative
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
        >
          <Menu.Item
            leftSlot={<TbEyeOff size={13} />}
            disabled={contextMenu.id === rootEntityId}
            onClick={() => {
              setExcludedIds(prev => new Set([...prev, contextMenu.id]));
              setContextMenu(null);
            }}
          >
            Exclude from graph
          </Menu.Item>
          <Menu.Item
            leftSlot={<TbPlus size={13} />}
            onClick={() => {
              const id = contextMenu.id;
              setManuallyExpanded(prev => new Set([...prev, id]));
              const nodeData = relationsData.get(id);
              if (nodeData) {
                const neighborIds = new Set(
                  [...nodeData.outgoing, ...nodeData.incoming].map(r => r.entityId)
                );
                setExcludedIds(prev => {
                  const next = new Set(prev);
                  for (const nid of neighborIds) next.delete(nid);
                  return next;
                });
              }
              setContextMenu(null);
            }}
          >
            Expand one level deeper
          </Menu.Item>
        </ContextMenu.Imperative>
      )}
    </div>
  );
};
