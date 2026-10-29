import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { DependencyGraph } from '../../../components/DependencyGraph';
import type {
  DependencyGraphNode,
  DependencyGraphEdge,
  LayoutAlgorithm
} from '../../../components/DependencyGraph';
import { TypeBadge } from '../../../components/TypeBadge';
import { resolveSchemaColor } from '../../../lib/schemaPresentation';
import { TbVectorTriangle } from 'react-icons/tb';
import { EntityGraphOverlays } from './EntityGraphOverlays';
import { EntityGraphToolbar } from './EntityGraphToolbar';
import styles from './EntityGraphView.module.css';
import { EntitySchema } from '@arch-register/api-types/schemaContract';
import { type EntityGraphDirection, type EntityNodeData } from './entityGraphState';
import { useEntityGraphController } from './useEntityGraphController';
import { LoadingState } from '../../../components/LoadingState';

type Props = {
  workspaceId: string;
  rootEntityId: string;
  rootEntityName: string;
  rootEntitySchemaId: string;
  schemas: EntitySchema[];
  onEntityClick: (id: string) => void;
  readOnly?: boolean;
  maxDepth?: number;
  layout?: LayoutAlgorithm;
  direction?: EntityGraphDirection;
  fullGraphLink?: ReactNode;
};

export const EntityGraphView = ({
  workspaceId,
  rootEntityId,
  rootEntityName,
  rootEntitySchemaId,
  schemas,
  onEntityClick,
  readOnly = false,
  maxDepth: configuredMaxDepth,
  layout: configuredLayout,
  direction,
  fullGraphLink
}: Props) => {
  const controller = useEntityGraphController({
    workspaceId,
    rootEntityId,
    rootEntityName,
    rootEntitySchemaId,
    maxDepth: configuredMaxDepth,
    layout: configuredLayout,
    direction
  });
  const { layout, layoutOptions, setContextMenu, nodes, edges, hiddenCountMap, isAnyLoading } =
    controller;

  const graphLayout = readOnly ? 'hierarchy' : layout;
  const graphLayoutOptions = layoutOptions;
  const hasHiddenRelations = useMemo(
    () => Array.from(hiddenCountMap.values()).some(count => count > 0),
    [hiddenCountMap]
  );

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
          <span className={styles.eNodeName}>{entityName ?? node.id}</span>
          {hiddenCount > 0 && <span className={styles.eHiddenBadge}>+{hiddenCount}</span>}
        </>
      );
    },
    [schemaMap, hiddenCountMap]
  );

  const handleNodeContextMenu = useCallback(
    (id: string, e: React.MouseEvent) => {
      setContextMenu({ id, x: e.clientX, y: e.clientY });
    },
    [setContextMenu]
  );

  const [relationPopover, setRelationPopover] = useState<{
    relationId: string;
    x: number;
    y: number;
  } | null>(null);

  const handleEdgeClick = useCallback((edge: DependencyGraphEdge, e: React.MouseEvent) => {
    if (edge.kind === 'typed' && edge.relationId) {
      setRelationPopover({ relationId: edge.relationId, x: e.clientX, y: e.clientY });
    }
  }, []);

  const rootHighlight = useMemo(() => new Set([rootEntityId]), [rootEntityId]);

  return (
    <div className={`${styles.icEntityGraphView} ${readOnly ? styles.readOnly : ''}`}>
      <EntityGraphToolbar workspaceId={workspaceId} controller={controller} />

      <div className={styles.eCanvas}>
        {isAnyLoading && nodes.length <= 1 ? (
          <div className={styles.eEmpty}>
            <LoadingState text="Loading relationships…" size="sm" />
          </div>
        ) : nodes.length <= 1 && edges.length === 0 && !isAnyLoading ? (
          <div className={styles.eEmpty}>
            <TbVectorTriangle size={22} />
            <div className={styles.eEmptyTitle}>No relationships found.</div>
            <div>This entity has no relationships in the selected direction.</div>
          </div>
        ) : (
          <DependencyGraph<EntityNodeData>
            nodes={nodes}
            edges={edges}
            layout={graphLayout}
            layoutOptions={graphLayoutOptions}
            nodeWidth={200}
            nodeHeight={52}
            renderNode={renderNode}
            onNodeClick={onEntityClick}
            onNodeContextMenu={readOnly ? undefined : handleNodeContextMenu}
            onEdgeClick={handleEdgeClick}
            highlightedIds={rootHighlight}
          />
        )}
        {readOnly && isAnyLoading && nodes.length > 1 && (
          <div className={styles.eLoadingOverlay}>Loading relationships…</div>
        )}
      </div>

      <EntityGraphOverlays
        workspaceId={workspaceId}
        controller={controller}
        allowActions={!readOnly}
        relationPopover={relationPopover}
        onCloseRelationPopover={() => setRelationPopover(null)}
        diagramDefaults={{
          defaultName: rootEntityName,
          initialDestination: {
            type: 'entity',
            entityId: rootEntityId,
            entityName: rootEntityName
          }
        }}
      />

      {readOnly && hasHiddenRelations && !isAnyLoading && fullGraphLink && (
        <div className={styles.eReadOnlyFooter}>{fullGraphLink}</div>
      )}
    </div>
  );
};
