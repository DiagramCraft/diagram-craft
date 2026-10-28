import { useCallback, useMemo, useState } from 'react';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import type { ProjectFile } from '@arch-register/api-types/projectContentContract';
import { ToolbarButton } from '../../../components/ToolbarButton';
import type { MultiSelectItem } from '@diagram-craft/app-components/MultiSelect';
import { MenuButton } from '@diagram-craft/app-components/MenuButton';
import { ContextMenu } from '@diagram-craft/app-components/src/ContextMenu';
import { Menu } from '@diagram-craft/app-components/src/Menu';
import { TbEyeOff, TbFileExport, TbFilter, TbPlus, TbVectorTriangle } from 'react-icons/tb';
import { DependencyGraph } from '../../../components/DependencyGraph';
import type { DependencyGraphEdge, DependencyGraphNode } from '../../../components/DependencyGraph';
import { FilterDropdown } from '../../../components/FilterDropdown';
import { LoadingState } from '../../../components/LoadingState';
import { TypeBadge } from '../../../components/TypeBadge';
import { useRelationSchemas } from '../../../hooks/useRelationSchemas';
import { resolveSchemaColor } from '../../../lib/schemaPresentation';
import { SaveDiagramFromGraphDialog } from './SaveDiagramFromGraphDialog';
import type { BrowserEntityRecord } from './entityBrowserState';
import { normalizeEntityGraphConfig, type EntityGraphConfig } from './entityGraphConfig';
import type { EntityGraphDirection, EntityNodeData } from './entityGraphState';
import { GraphLayoutToolbar } from './GraphLayoutToolbar';
import { GraphTooLarge } from './GraphTooLarge';
import { isGraphTooLarge } from './graphSizeLimit';
import { RelationDetailPopover } from './RelationDetailPopover';
import { useEntityGraphController } from './useEntityGraphController';
import styles from './EntityGraphView.module.css';

type Props = {
  workspaceId: string;
  rows: BrowserEntityRecord[];
  schemas: EntitySchema[];
  activeViewConfig: unknown;
  onConfigChange: (config: unknown) => void;
  onEntityClick: (id: string) => void;
  isLoading?: boolean;
  hideToolbar?: boolean;
  allowActions?: boolean;
};

export const EntityBrowserGraphView = ({
  workspaceId,
  rows,
  schemas,
  activeViewConfig,
  onConfigChange,
  onEntityClick,
  isLoading = false,
  hideToolbar = false,
  allowActions = false
}: Props) => {
  const config = useMemo(() => normalizeEntityGraphConfig(activeViewConfig), [activeViewConfig]);
  const roots = useMemo(
    () =>
      rows.map(row => ({
        entityId: row._uid,
        entityName: row._name ?? row._slug ?? row._uid,
        entitySchemaId: row._schema.id
      })),
    [rows]
  );
  const controller = useEntityGraphController({
    workspaceId,
    rootEntities: roots,
    graphName: 'Entity graph',
    maxDepth: config.maxDepth,
    direction: config.direction,
    relationSchemaIds: config.relationSchemaIds
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
    direction,
    setDirection,
    relationSchemaFilter,
    setRelationSchemaFilter,
    contextMenu,
    setContextMenu,
    saveDiagramOpen,
    setSaveDiagramOpen,
    pendingDiagramContent,
    rootEntityIds,
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
  const schemaMap = useMemo(
    () => new Map(schemas.map((schema, index) => [schema.id, { schema, index }])),
    [schemas]
  );
  const rootHighlight = useMemo(() => new Set(roots.map(root => root.entityId)), [roots]);
  const graphConfig = useCallback(
    (patch: Partial<EntityGraphConfig>) => onConfigChange({ ...config, ...patch }),
    [config, onConfigChange]
  );
  const graphLayout = hideToolbar ? 'hierarchy' : layout;
  const [relationPopover, setRelationPopover] = useState<{
    relationId: string;
    x: number;
    y: number;
  } | null>(null);

  const renderNode = useCallback(
    (node: DependencyGraphNode<EntityNodeData>) => {
      const entry = schemaMap.get(node.data.entitySchemaId);
      const schema = entry?.schema;
      const color = schema ? resolveSchemaColor(schema, entry.index) : 'var(--accent-fg)';
      const hiddenCount = hiddenCountMap.get(node.id) ?? 0;
      return (
        <>
          <TypeBadge color={color} name={schema?.name} icon={schema?.icon} size={16} />
          <span className={styles.eNodeName}>{node.data.entityName ?? node.id}</span>
          {hiddenCount > 0 && <span className={styles.eHiddenBadge}>+{hiddenCount}</span>}
        </>
      );
    },
    [hiddenCountMap, schemaMap]
  );

  const handleNodeContextMenu = useCallback(
    (id: string, event: React.MouseEvent) => {
      setContextMenu({ id, x: event.clientX, y: event.clientY });
    },
    [setContextMenu]
  );

  const handleEdgeClick = useCallback((edge: DependencyGraphEdge, event: React.MouseEvent) => {
    if (edge.kind === 'typed' && edge.relationId) {
      setRelationPopover({ relationId: edge.relationId, x: event.clientX, y: event.clientY });
    }
  }, []);

  const showInitialLoading = isLoading && roots.length === 0;
  const showRelationshipLoading = isAnyLoading && nodes.length <= roots.length;

  return (
    <div className={`${styles.icEntityGraphView} ${hideToolbar ? styles.readOnly : ''}`}>
      <div className={styles.eToolbar}>
        <GraphLayoutToolbar
          layout={layout}
          setLayout={setLayout}
          layoutOptions={layoutOptions}
          setLayoutOptions={setLayoutOptions}
        />

        <FilterDropdown
          label="Depth"
          value={String(maxDepth)}
          onChange={value => {
            const next = Number(value);
            setMaxDepth(next);
            graphConfig({ maxDepth: next });
          }}
          options={[1, 2, 3, 4, 5].map(depth => ({ value: String(depth), label: String(depth) }))}
        />

        <FilterDropdown
          label="Direction"
          value={direction}
          onChange={value => {
            const next = value as EntityGraphDirection;
            setDirection(next);
            graphConfig({ direction: next });
          }}
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
                  graphConfig({ relationSchemaIds: [...next] });
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

        {allowActions && (
          <ToolbarButton onClick={createDiagram}>
            <TbFileExport size={14} />
            Create diagram
          </ToolbarButton>
        )}
      </div>

      <div className={styles.eCanvas}>
        {showInitialLoading || showRelationshipLoading ? (
          <div className={styles.eEmpty}>
            <LoadingState
              text={showInitialLoading ? 'Loading entities…' : 'Loading relationships…'}
              size="sm"
            />
          </div>
        ) : roots.length === 0 ? (
          <div className={styles.eEmpty}>
            <TbVectorTriangle size={22} />
            <div className={styles.eEmptyTitle}>No entities found.</div>
            <div>Try adjusting your search or filters.</div>
          </div>
        ) : isGraphTooLarge(nodes.length, edges.length) ? (
          <GraphTooLarge
            nodeCount={nodes.length}
            edgeCount={edges.length}
            hint="Narrow the filters, lower the depth or choose specific relation types."
          />
        ) : (
          <DependencyGraph<EntityNodeData>
            nodes={nodes}
            edges={edges}
            layout={graphLayout}
            layoutOptions={layoutOptions}
            nodeWidth={200}
            nodeHeight={52}
            renderNode={renderNode}
            onNodeClick={onEntityClick}
            onNodeContextMenu={allowActions ? handleNodeContextMenu : undefined}
            onEdgeClick={handleEdgeClick}
            highlightedIds={rootHighlight}
          />
        )}
        {isAnyLoading && nodes.length > roots.length && (
          <div className={styles.eLoadingOverlay}>Loading relationships…</div>
        )}
      </div>

      {allowActions && contextMenu && (
        <ContextMenu.Imperative
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
        >
          <Menu.Item
            leftSlot={<TbEyeOff size={13} />}
            disabled={rootEntityIds.has(contextMenu.id)}
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

      {allowActions && saveDiagramOpen && pendingDiagramContent && (
        <SaveDiagramFromGraphDialog
          open={saveDiagramOpen}
          onClose={() => setSaveDiagramOpen(false)}
          onCreated={(_file: ProjectFile) => setSaveDiagramOpen(false)}
          workspaceId={workspaceId}
          diagramContent={pendingDiagramContent}
          defaultName="Entity graph"
          initialDestination={{ type: 'workspace' }}
        />
      )}
    </div>
  );
};
