import { useMemo } from 'react';
import { MenuButton } from '@diagram-craft/app-components/MenuButton';
import { Menu } from '@diagram-craft/app-components/src/Menu';
import { TbFileExport, TbFilter } from 'react-icons/tb';
import { FilterDropdown } from '../../../components/FilterDropdown';
import { ToolbarButton } from '../../../components/ToolbarButton';
import { useRelationSchemas } from '../../../hooks/useRelationSchemas';
import type { EntityGraphConfig } from './entityGraphConfig';
import type { EntityGraphDirection } from './entityGraphState';
import { GraphLayoutToolbar } from './GraphLayoutToolbar';
import type { useEntityGraphController } from './useEntityGraphController';
import styles from './EntityGraphView.module.css';

type Controller = ReturnType<typeof useEntityGraphController>;

/**
 * The controls above an entity graph: layout, depth, direction, relation-type filter, reset and
 * (optionally) create diagram. `onConfigChange` lets a caller persist depth/direction/relation
 * filter changes (e.g. into a saved view); it is optional.
 */
export const EntityGraphToolbar = ({
  workspaceId,
  controller,
  onConfigChange,
  allowCreateDiagram = true
}: {
  workspaceId: string;
  controller: Controller;
  onConfigChange?: (patch: Partial<EntityGraphConfig>) => void;
  allowCreateDiagram?: boolean;
}) => {
  const {
    layout,
    setLayout,
    layoutOptions,
    setLayoutOptions,
    maxDepth,
    setMaxDepth,
    direction,
    setDirection,
    relationSchemaFilter,
    setRelationSchemaFilter,
    excludedIds,
    manuallyExpanded,
    isAnyLoading,
    resetGraph,
    createDiagram
  } = controller;

  const { data: relationSchemas } = useRelationSchemas(workspaceId);
  const relationSchemaItems = useMemo(
    () => (relationSchemas ?? []).map(schema => ({ value: schema.id, label: schema.name })),
    [relationSchemas]
  );

  return (
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
          onConfigChange?.({ maxDepth: next });
        }}
        options={[1, 2, 3, 4, 5].map(depth => ({ value: String(depth), label: String(depth) }))}
      />

      <FilterDropdown
        label="Direction"
        value={direction}
        onChange={value => {
          const next = value as EntityGraphDirection;
          setDirection(next);
          onConfigChange?.({ direction: next });
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
                onConfigChange?.({ relationSchemaIds: [...next] });
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

      {allowCreateDiagram && (
        <ToolbarButton onClick={createDiagram}>
          <TbFileExport size={14} />
          Create diagram
        </ToolbarButton>
      )}
    </div>
  );
};
