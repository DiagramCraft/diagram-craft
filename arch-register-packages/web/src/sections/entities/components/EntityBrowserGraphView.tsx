import { useCallback, useMemo, useState } from 'react';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import type { ProjectFile } from '@arch-register/api-types/projectContentContract';
import { Button } from '@diagram-craft/app-components/Button';
import { MultiSelect, type MultiSelectItem } from '@diagram-craft/app-components/MultiSelect';
import { NumberInput } from '@diagram-craft/app-components/NumberInput';
import { Select } from '@diagram-craft/app-components/Select';
import { ContextMenu } from '@diagram-craft/app-components/src/ContextMenu';
import { Menu } from '@diagram-craft/app-components/src/Menu';
import { TbEyeOff, TbFileExport, TbPlus, TbVectorTriangle } from 'react-icons/tb';
import { DependencyGraph } from '../../../components/DependencyGraph';
import type { DependencyGraphEdge, DependencyGraphNode } from '../../../components/DependencyGraph';
import { LoadingState } from '../../../components/LoadingState';
import { TypeBadge } from '../../../components/TypeBadge';
import { useRelationSchemas } from '../../../hooks/useRelationSchemas';
import { resolveSchemaColor } from '../../../lib/schemaPresentation';
import { SaveDiagramFromGraphDialog } from './SaveDiagramFromGraphDialog';
import type { BrowserEntityRecord } from './entityBrowserState';
import { normalizeEntityGraphConfig, type EntityGraphConfig } from './entityGraphConfig';
import type { EntityGraphDirection, EntityNodeData } from './entityGraphState';
import { GraphLayoutToolbar } from './GraphLayoutToolbar';
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

        <span className={styles.eToolbarLabel}>Depth</span>
        <NumberInput
          value={maxDepth}
          onChange={value => {
            if (value !== undefined) {
              setMaxDepth(value);
              graphConfig({ maxDepth: value });
            }
          }}
          min={1}
          max={5}
          step={1}
          style={{ width: '50px' }}
        />

        <span className={styles.eToolbarLabel}>Direction</span>
        <Select.Root
          value={direction}
          onChange={value => {
            if (value) {
              const next = value as EntityGraphDirection;
              setDirection(next);
              graphConfig({ direction: next });
            }
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
          onSelectionChange={values => {
            const next = new Set(values);
            setRelationSchemaFilter(next);
            graphConfig({ relationSchemaIds: values });
          }}
          placeholder="All relation types"
          style={{ width: '120px' }}
        />

        {isAnyLoading && <span className={styles.eLoadingText}>Loading…</span>}

        <Button
          className={styles.eResetButton}
          disabled={excludedIds.size === 0 && manuallyExpanded.size === 0}
          size="sm"
          onClick={resetGraph}
        >
          Reset
        </Button>

        {allowActions && (
          <Button size="sm" onClick={createDiagram}>
            <TbFileExport size={14} />
            Create diagram
          </Button>
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
