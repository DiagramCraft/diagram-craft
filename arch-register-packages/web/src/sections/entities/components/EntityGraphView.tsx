import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { DependencyGraph } from '../../../components/DependencyGraph';
import type { DependencyGraphNode, DependencyGraphEdge } from '../../../components/DependencyGraph';
import { TypeBadge } from '../../../components/TypeBadge';
import { Button } from '@diagram-craft/app-components/Button';
import { Select } from '@diagram-craft/app-components/Select';
import { NumberInput } from '@diagram-craft/app-components/NumberInput';
import { MultiSelect, type MultiSelectItem } from '@diagram-craft/app-components/MultiSelect';
import { ContextMenu } from '@diagram-craft/app-components/src/ContextMenu';
import { Menu } from '@diagram-craft/app-components/src/Menu';
import { resolveSchemaColor } from '../../../lib/schemaPresentation';
import { TbEyeOff, TbFileExport, TbPlus, TbVectorTriangle } from 'react-icons/tb';
import styles from './EntityGraphView.module.css';
import { EntitySchema } from '@arch-register/api-types/schemaContract';
import { SaveDiagramFromGraphDialog } from './SaveDiagramFromGraphDialog';
import { RelationDetailPopover } from './RelationDetailPopover';
import type { ProjectFile } from '@arch-register/api-types/projectContract';
import { type EntityGraphDirection, type EntityNodeData } from './entityGraphState';
import { useEntityGraphController } from './useEntityGraphController';
import { useRelationSchemas } from '../../../hooks/useRelationSchemas';
import { LoadingState } from '../../../components/LoadingState';
import { GraphLayoutToolbar } from './GraphLayoutToolbar';

type Props = {
  workspaceId: string;
  rootEntityId: string;
  rootEntityName: string;
  rootEntitySchemaId: string;
  schemas: EntitySchema[];
  onEntityClick: (id: string) => void;
  readOnly?: boolean;
  maxDepth?: number;
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
  direction,
  fullGraphLink
}: Props) => {
  const controller = useEntityGraphController({
    workspaceId,
    rootEntityId,
    rootEntityName,
    rootEntitySchemaId,
    maxDepth: configuredMaxDepth,
    direction
  });
  const {
    layout,
    setLayout,
    layoutOptions,
    setLayoutOptions,
    maxDepth,
    setMaxDepth,
    excludedIds,
    manuallyExpanded,
    direction: currentDirection,
    setDirection,
    relationSchemaFilter,
    setRelationSchemaFilter,
    contextMenu,
    setContextMenu,
    saveDiagramOpen,
    setSaveDiagramOpen,
    pendingDiagramContent,
    nodes,
    edges,
    hiddenCountMap,
    isAnyLoading,
    resetGraph,
    excludeEntity,
    expandEntity,
    createDiagram
  } = controller;

  const { data: relationSchemas } = useRelationSchemas(workspaceId);
  const relationSchemaItems: MultiSelectItem[] = useMemo(
    () => (relationSchemas ?? []).map(schema => ({ value: schema.id, label: schema.name })),
    [relationSchemas]
  );

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
      <div className={styles.eToolbar}>
        <GraphLayoutToolbar
          layout={layout}
          setLayout={value => setLayout(value)}
          layoutOptions={layoutOptions}
          setLayoutOptions={setLayoutOptions}
        />

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

        <span className={styles.eToolbarLabel}>Direction</span>
        <Select.Root
          value={currentDirection}
          onChange={v => {
            if (v) setDirection(v as EntityGraphDirection);
          }}
          style={{ width: '70px' }}
        >
          <Select.Item value="both">Both</Select.Item>
          <Select.Item value="upstream">In</Select.Item>
          <Select.Item value="downstream">Out</Select.Item>
        </Select.Root>

        <span className={styles.eToolbarLabel}>Relation</span>
        <MultiSelect
          selectedValues={Array.from(relationSchemaFilter)}
          availableItems={relationSchemaItems}
          onSelectionChange={values => setRelationSchemaFilter(new Set(values))}
          placeholder="All relation types"
          style={{ width: '120px' }}
        />

        {isAnyLoading && <span className={styles.eLoadingText}>Loading…</span>}

        <Button
          className={styles.eResetButton}
          disabled={excludedIds.size === 0 && manuallyExpanded.size === 0}
          size={'sm'}
          onClick={resetGraph}
        >
          Reset
        </Button>

        <Button size={'sm'} onClick={createDiagram}>
          <TbFileExport size={14} />
          Create diagram
        </Button>
      </div>

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

      {!readOnly && contextMenu && (
        <ContextMenu.Imperative
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
        >
          <Menu.Item
            leftSlot={<TbEyeOff size={13} />}
            disabled={contextMenu.id === rootEntityId}
            onClick={() => excludeEntity(contextMenu.id)}
          >
            Exclude from graph
          </Menu.Item>
          <Menu.Item leftSlot={<TbPlus size={13} />} onClick={() => expandEntity(contextMenu.id)}>
            Expand one level deeper
          </Menu.Item>
        </ContextMenu.Imperative>
      )}

      {relationPopover && (
        <RelationDetailPopover
          workspaceId={workspaceId}
          relationId={relationPopover.relationId}
          x={relationPopover.x}
          y={relationPopover.y}
          onClose={() => setRelationPopover(null)}
        />
      )}

      {!readOnly && saveDiagramOpen && pendingDiagramContent && (
        <SaveDiagramFromGraphDialog
          open={saveDiagramOpen}
          onClose={() => setSaveDiagramOpen(false)}
          onCreated={(_file: ProjectFile) => setSaveDiagramOpen(false)}
          workspaceId={workspaceId}
          diagramContent={pendingDiagramContent}
          defaultName={rootEntityName}
          initialDestination={{
            type: 'entity',
            entityId: rootEntityId,
            entityName: rootEntityName
          }}
        />
      )}

      {readOnly && hasHiddenRelations && !isAnyLoading && fullGraphLink && (
        <div className={styles.eReadOnlyFooter}>{fullGraphLink}</div>
      )}
    </div>
  );
};
