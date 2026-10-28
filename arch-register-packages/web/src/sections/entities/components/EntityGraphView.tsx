import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { DependencyGraph } from '../../../components/DependencyGraph';
import type {
  DependencyGraphNode,
  DependencyGraphEdge,
  LayoutAlgorithm
} from '../../../components/DependencyGraph';
import { TypeBadge } from '../../../components/TypeBadge';
import { FilterDropdown } from '../../../components/FilterDropdown';
import { ToolbarButton } from '../../../components/ToolbarButton';
import type { MultiSelectItem } from '@diagram-craft/app-components/MultiSelect';
import { MenuButton } from '@diagram-craft/app-components/MenuButton';
import { ContextMenu } from '@diagram-craft/app-components/src/ContextMenu';
import { Menu } from '@diagram-craft/app-components/src/Menu';
import { resolveSchemaColor } from '../../../lib/schemaPresentation';
import { TbEyeOff, TbFileExport, TbFilter, TbPlus, TbVectorTriangle } from 'react-icons/tb';
import styles from './EntityGraphView.module.css';
import { EntitySchema } from '@arch-register/api-types/schemaContract';
import { SaveDiagramFromGraphDialog } from './SaveDiagramFromGraphDialog';
import { RelationDetailPopover } from './RelationDetailPopover';
import type { ProjectFile } from '@arch-register/api-types/projectContentContract';
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

        <FilterDropdown
          label="Depth"
          value={String(maxDepth)}
          onChange={value => setMaxDepth(Number(value))}
          options={[1, 2, 3, 4, 5].map(depth => ({ value: String(depth), label: String(depth) }))}
        />

        <FilterDropdown
          label="Direction"
          value={currentDirection}
          onChange={value => setDirection(value as EntityGraphDirection)}
          options={[
            { value: 'both', label: 'Both' },
            { value: 'upstream', label: 'In' },
            { value: 'downstream', label: 'Out' }
          ]}
        />

        <MenuButton.Root>
          <MenuButton.Trigger
            element={
              <ToolbarButton
                icon={<TbFilter size={13} />}
                variant={relationSchemaFilter.size > 0 ? 'primary' : undefined}
                aria-label="Filter relation types"
                title="Filter relation types"
              >
                {relationSchemaFilter.size === 0
                  ? 'All relation types'
                  : `${relationSchemaFilter.size} relation type${relationSchemaFilter.size === 1 ? '' : 's'}`}
              </ToolbarButton>
            }
          />
          <MenuButton.Menu align="start">
            {relationSchemaItems.length === 0 && <Menu.Item disabled>No relation types</Menu.Item>}
            {relationSchemaItems.map(item => (
              <Menu.CheckboxItem
                key={item.value}
                checked={relationSchemaFilter.has(item.value)}
                onCheckedChange={checked => {
                  const next = new Set(relationSchemaFilter);
                  if (checked) next.add(item.value);
                  else next.delete(item.value);
                  setRelationSchemaFilter(next);
                }}
              >
                {item.label}
              </Menu.CheckboxItem>
            ))}
          </MenuButton.Menu>
        </MenuButton.Root>

        {isAnyLoading && <span className={styles.eLoadingText}>Loading…</span>}

        <ToolbarButton
          className={styles.eResetButton}
          disabled={excludedIds.size === 0 && manuallyExpanded.size === 0}
          onClick={resetGraph}
        >
          Reset
        </ToolbarButton>

        <ToolbarButton onClick={createDiagram}>
          <TbFileExport size={14} />
          Create diagram
        </ToolbarButton>
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
