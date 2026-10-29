import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { TbDots, TbEyeOff, TbFilter, TbFocus2 } from 'react-icons/tb';
import { Menu } from '@diagram-craft/app-components/src/Menu';
import { EntityContextMenuView } from '../../../components/EntityContextMenu';
import { buildEntityMenuItems } from './entityMenu';
import { useEntityCommonActions } from './useEntityCommonActions';
import { TypeBadge } from '../../../components/TypeBadge';
import { Chip } from '../../../components/Chip';
import { useMultipleEntityRelations } from '../../../hooks/useEntities';
import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import { resolveSchemaColor } from '../../../lib/schemaPresentation';
import {
  exploreViewConfigSchema,
  type ExploreViewConfig
} from '@arch-register/api-types/viewContract';
import styles from './RelationColumnsView.module.css';
import { EmptyState } from '../../../components/EmptyState';
import {
  buildExploreGraph,
  DEFAULT_EXPLORE_CONFIG,
  normalizeExploreConfig,
  type ExploreEntity,
  type ExploreRelationOption
} from './RelationColumnsView.helpers';
import { connectorDistance, type ExploreConnectorLine } from './relationColumnsGeometry';
import { Button } from '@diagram-craft/app-components/Button';
import { MenuButton } from '@diagram-craft/app-components/MenuButton';
import type { EntityBrowserRowViewProps } from './entityBrowserViewTypes';
import {
  findEntityDisplayField,
  formatEntityDisplayValue,
  getDisplayFieldIds,
  type EntityDisplayField
} from './entityDisplayFields';
import { ViewControlsFrame } from '../../../components/ViewControls';

type RelationColumnsViewProps = EntityBrowserRowViewProps & {
  config: unknown;
  onConfigChange: (cfg: ExploreViewConfig) => void;
  hideToolbar?: boolean;
  displayFields: EntityDisplayField[];
};

type ConnectorLine = ExploreConnectorLine;

type ConnectorTooltip = {
  fromEntityName: string;
  fieldLabel: string;
  toEntityName: string;
  x: number;
  y: number;
} | null;

export const RelationColumnsView = ({
  rows,
  onEntityClick,
  config,
  onConfigChange,
  linkedEntityIds,
  onFocusEntity,
  hideToolbar,
  displayFields
}: RelationColumnsViewProps) => {
  const parsedConfig = useMemo(() => {
    const result = exploreViewConfigSchema.safeParse(config);
    return result.success ? result.data : null;
  }, [config]);
  const { workspaceSlug, schemas } = useWorkspaceContext();
  const schemaMap = useMemo(() => {
    const map = new Map<string, { name: string; color: string; icon: string | null }>();
    schemas.forEach((schema, index) => {
      map.set(schema.id, {
        name: schema.name,
        color: resolveSchemaColor(schema, index),
        icon: schema.icon
      });
    });
    return map;
  }, [schemas]);
  const fullSchemaMap = useMemo(
    () => new Map(schemas.map((schema, index) => [schema.id, { schema, index }])),
    [schemas]
  );

  const [localConfig, setLocalConfig] = useState<ExploreViewConfig>(
    normalizeExploreConfig(parsedConfig ?? DEFAULT_EXPLORE_CONFIG)
  );
  const normalizedConfig = useMemo(
    () => normalizeExploreConfig(parsedConfig ?? localConfig),
    [parsedConfig, localConfig]
  );
  const selectedDisplayFields = getDisplayFieldIds('relation-columns', normalizedConfig);
  const linkedEntityIdSet = useMemo(() => new Set(linkedEntityIds ?? []), [linkedEntityIds]);
  const [connectorTooltip, setConnectorTooltip] = useState<ConnectorTooltip>(null);
  // Entity id -> index of the column it was excluded from. The exclusion applies everywhere; the
  // column is remembered so that column's Reset can undo it.
  const [excludedFromColumn, setExcludedFromColumn] = useState<Map<string, number>>(new Map());
  const excludedEntityIds = useMemo(() => new Set(excludedFromColumn.keys()), [excludedFromColumn]);
  const commonActions = useEntityCommonActions();
  const [contextMenu, setContextMenu] = useState<{
    entity: ExploreEntity;
    columnIndex: number;
    x: number;
    y: number;
  } | null>(null);

  useEffect(() => {
    if (parsedConfig == null) return;
    setLocalConfig(normalizeExploreConfig(parsedConfig));
  }, [parsedConfig]);

  const updateConfig = useCallback(
    (patch: Partial<ExploreViewConfig>) => {
      const nextConfig = normalizeExploreConfig({ ...normalizedConfig, ...patch });
      setLocalConfig(nextConfig);
      onConfigChange(nextConfig);
    },
    [normalizedConfig, onConfigChange]
  );

  const centerIds = useMemo(() => rows.map(row => row._uid).sort(), [rows]);
  const centerIdKey = centerIds.join('|');
  const [fetchIds, setFetchIds] = useState<string[]>(centerIds);
  const previousCenterIdKey = useRef(centerIdKey);

  useEffect(() => {
    setFetchIds(previous => (previous.join('|') === centerIdKey ? previous : centerIds));
    if (previousCenterIdKey.current !== centerIdKey) {
      setExcludedFromColumn(new Map());
      previousCenterIdKey.current = centerIdKey;
    }
  }, [centerIdKey, centerIds]);

  const relationsMap = useMultipleEntityRelations(workspaceSlug, fetchIds);
  const graph = useMemo(
    () =>
      buildExploreGraph({
        centerEntities: rows,
        relationsMap,
        config: normalizedConfig,
        excludedEntityIds
      }),
    [excludedEntityIds, normalizedConfig, relationsMap, rows]
  );

  const updateColumnRelations = useCallback(
    (columnIndex: number, relationKeys: string[]) => {
      const next = { ...(normalizedConfig.columnRelationKeys ?? {}) };
      if (relationKeys.length === 0) delete next[String(columnIndex)];
      else next[String(columnIndex)] = relationKeys;
      updateConfig({
        columnRelationKeys: Object.keys(next).length > 0 ? next : undefined
      });
    },
    [normalizedConfig.columnRelationKeys, updateConfig]
  );

  const updateColumnSchema = useCallback(
    (columnIndex: number, schemaId: string) => {
      const nextColumnSchemaIds = { ...(normalizedConfig.columnSchemaIds ?? {}) };
      if (schemaId.length === 0) {
        delete nextColumnSchemaIds[String(columnIndex)];
      } else {
        nextColumnSchemaIds[String(columnIndex)] = schemaId;
      }
      updateConfig({
        columnSchemaIds:
          Object.keys(nextColumnSchemaIds).length > 0 ? nextColumnSchemaIds : undefined
      });
    },
    [normalizedConfig.columnSchemaIds, updateConfig]
  );

  const handleEntityContextMenu = useCallback(
    (event: MouseEvent<HTMLButtonElement>, entity: ExploreEntity, columnIndex: number) => {
      if (onFocusEntity == null) return;
      event.preventDefault();
      event.stopPropagation();
      setContextMenu({ entity, columnIndex, x: event.clientX, y: event.clientY });
    },
    [onFocusEntity]
  );

  const excludeEntity = useCallback(() => {
    if (!contextMenu) return;
    setExcludedFromColumn(previous =>
      new Map(previous).set(contextMenu.entity.entityId, contextMenu.columnIndex)
    );
    setContextMenu(null);
  }, [contextMenu]);

  const focusEntity = useCallback(() => {
    if (!contextMenu || onFocusEntity == null) return;
    setExcludedFromColumn(new Map());
    onFocusEntity(contextMenu.entity.entityId);
    setContextMenu(null);
  }, [contextMenu, onFocusEntity]);

  useEffect(() => {
    const nextIds = [...new Set([...fetchIds, ...centerIds, ...graph.visibleEntityIds])].sort();
    setFetchIds(prev => (prev.join('|') === nextIds.join('|') ? prev : nextIds));
  }, [centerIds, fetchIds, graph.visibleEntityIds]);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const entityRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [connectorLines, setConnectorLines] = useState<ConnectorLine[]>([]);

  const setEntityRef = useCallback(
    (columnIndex: number, entityId: string) => (element: HTMLButtonElement | null) => {
      entityRefs.current[`${columnIndex}:${entityId}`] = element;
    },
    []
  );

  const updateConnectorTooltip = useCallback(
    (event: MouseEvent<HTMLDivElement>, line: ConnectorLine) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const canvasRect = canvas.getBoundingClientRect();
      setConnectorTooltip({
        fromEntityName: line.fromEntityName,
        fieldLabel: line.fieldLabel,
        toEntityName: line.toEntityName,
        x: event.clientX - canvasRect.left + 12,
        y: event.clientY - canvasRect.top + 12
      });
    },
    []
  );

  const handleCanvasMouseMove = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const target = event.target as HTMLElement | null;
      if (target?.closest('button')) {
        setConnectorTooltip(null);
        return;
      }

      const canvasRect = canvas.getBoundingClientRect();
      const px = event.clientX - canvasRect.left;
      const py = event.clientY - canvasRect.top;

      let nearest: ConnectorLine | null = null;
      let nearestDistance = Number.POSITIVE_INFINITY;

      for (const line of connectorLines) {
        const distance = connectorDistance(line, px, py);
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearest = line;
        }
      }

      if (nearest == null || nearestDistance > 10) {
        setConnectorTooltip(null);
        return;
      }

      updateConnectorTooltip(event, nearest);
    },
    [connectorLines, updateConnectorTooltip]
  );

  useEffect(() => {
    const recompute = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const canvasRect = canvas.getBoundingClientRect();
      const lines: ConnectorLine[] = [];

      for (const connector of graph.connectors) {
        const fromElement = entityRefs.current[`${connector.fromColumn}:${connector.fromEntityId}`];
        const toElement = entityRefs.current[`${connector.toColumn}:${connector.toEntityId}`];
        if (!fromElement || !toElement) continue;

        const fromRect = fromElement.getBoundingClientRect();
        const toRect = toElement.getBoundingClientRect();

        lines.push({
          ...connector,
          x1: fromRect.right - canvasRect.left,
          y1: fromRect.top + fromRect.height / 2 - canvasRect.top,
          x2: toRect.left - canvasRect.left,
          y2: toRect.top + toRect.height / 2 - canvasRect.top
        });
      }

      setConnectorLines(previous => {
        if (
          previous.length === lines.length &&
          previous.every((line, index) => {
            const next = lines[index];
            return (
              next != null &&
              line.fromColumn === next.fromColumn &&
              line.fromEntityId === next.fromEntityId &&
              line.toColumn === next.toColumn &&
              line.toEntityId === next.toEntityId &&
              line.relationKey === next.relationKey &&
              line.x1 === next.x1 &&
              line.y1 === next.y1 &&
              line.x2 === next.x2 &&
              line.y2 === next.y2
            );
          })
        ) {
          return previous;
        }
        return lines;
      });
    };

    const rafId = window.requestAnimationFrame(recompute);
    const scrollElement = scrollRef.current;
    scrollElement?.addEventListener('scroll', recompute, { passive: true });
    window.addEventListener('resize', recompute);

    const observer =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => {
            recompute();
          })
        : null;

    if (observer && canvasRef.current) observer.observe(canvasRef.current);

    return () => {
      window.cancelAnimationFrame(rafId);
      scrollElement?.removeEventListener('scroll', recompute);
      window.removeEventListener('resize', recompute);
      observer?.disconnect();
    };
  }, [graph.connectors]);

  if (rows.length === 0) {
    return (
      <ViewControlsFrame>
        <EmptyState title="No entities found" subtitle="Try adjusting your search or filters." />
      </ViewControlsFrame>
    );
  }

  return (
    <ViewControlsFrame>
      <div ref={scrollRef} className={styles.scroll}>
        <div
          ref={canvasRef}
          className={styles.canvas}
          onMouseMove={handleCanvasMouseMove}
          onMouseLeave={() => setConnectorTooltip(null)}
        >
          <svg className={styles.connectors} aria-hidden="true">
            <defs>
              <marker
                id="explore-arrow-reference"
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" fill="context-stroke" />
              </marker>
              <marker
                id="explore-arrow-containment"
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" fill="context-stroke" />
              </marker>
            </defs>
            {connectorLines.map((line, index) => {
              const midX = line.x1 + (line.x2 - line.x1) / 2;
              const strokeDasharray = line.kind === 'containment' ? undefined : '4 4';
              const markerEnd =
                line.kind === 'containment'
                  ? 'url(#explore-arrow-containment)'
                  : 'url(#explore-arrow-reference)';
              return (
                <g key={`${line.fromColumn}:${line.relationKey}:${line.toColumn}:${index}`}>
                  <path
                    d={`M ${line.x1} ${line.y1} C ${midX} ${line.y1}, ${midX} ${line.y2}, ${line.x2} ${line.y2}`}
                    className={styles.connector}
                    data-kind={line.kind}
                    strokeDasharray={strokeDasharray}
                    markerEnd={markerEnd}
                  />
                </g>
              );
            })}
          </svg>

          {connectorTooltip && (
            <div
              className={styles.connectorTooltip}
              style={{ left: connectorTooltip.x, top: connectorTooltip.y }}
            >
              <strong>{connectorTooltip.fromEntityName}</strong>
              <span className={styles.connectorTooltipSep}> --[ </span>
              <span className={styles.connectorTooltipField}>{connectorTooltip.fieldLabel}</span>
              <span className={styles.connectorTooltipSep}> ]-- </span>
              <strong>{connectorTooltip.toEntityName}</strong>
            </div>
          )}

          <div className={styles.columns}>
            {graph.columns.map(column => {
              const columnLabel =
                column.direction === 'center'
                  ? 'Filtered entities'
                  : column.direction === 'left'
                    ? `In ${column.hop}`
                    : `Out ${column.hop}`;
              const selectedSchemaId = normalizedConfig.columnSchemaIds?.[String(column.index)];
              const availableSchemaIds = new Set(column.availableSchemaIds);
              const schemaOptions = column.availableSchemaIds
                .map(schemaId => ({
                  schemaId,
                  name: schemaMap.get(schemaId)?.name ?? schemaId
                }))
                .concat(
                  selectedSchemaId != null && !availableSchemaIds.has(selectedSchemaId)
                    ? [
                        {
                          schemaId: selectedSchemaId,
                          name: schemaMap.get(selectedSchemaId)?.name ?? selectedSchemaId
                        }
                      ]
                    : []
                )
                .sort((a, b) => a.name.localeCompare(b.name));

              const showSchemaFilter =
                !hideToolbar && column.direction !== 'center' && schemaOptions.length > 0;
              const columnDepthActions: Array<{
                label: string;
                disabled?: boolean;
                onClick: () => void;
              }> = [];
              if (column.direction === 'center') {
                if (normalizedConfig.leftDepth === 0) {
                  columnDepthActions.push({
                    label: 'Add left',
                    onClick: () => updateConfig({ leftDepth: 1 })
                  });
                }
                if (normalizedConfig.rightDepth === 0) {
                  columnDepthActions.push({
                    label: 'Add right',
                    onClick: () => updateConfig({ rightDepth: 1 })
                  });
                }
              } else if (column.direction === 'left') {
                // Only the outermost column on this side can be extended or hidden.
                if (column.hop === normalizedConfig.leftDepth) {
                  columnDepthActions.push({
                    label: 'Add column',
                    disabled: column.entities.length === 0,
                    onClick: () => updateConfig({ leftDepth: normalizedConfig.leftDepth + 1 })
                  });
                  columnDepthActions.push({
                    label: 'Hide',
                    onClick: () => updateConfig({ leftDepth: normalizedConfig.leftDepth - 1 })
                  });
                }
              } else {
                // Only the outermost column on this side can be extended or hidden.
                if (column.hop === normalizedConfig.rightDepth) {
                  columnDepthActions.push({
                    label: 'Add column',
                    disabled: column.entities.length === 0,
                    onClick: () => updateConfig({ rightDepth: normalizedConfig.rightDepth + 1 })
                  });
                  columnDepthActions.push({
                    label: 'Hide',
                    onClick: () => updateConfig({ rightDepth: normalizedConfig.rightDepth - 1 })
                  });
                }
              }
              // The relation filter is always about this column's outgoing relations (its entities
              // as the source). The selection is stored under the index of the column those
              // relations populate: the next column outward for the center and right columns, the
              // column itself for a left column (its outgoing relations point toward the center).
              const innerNeighbor =
                column.direction === 'left'
                  ? graph.columns.find(other => other.index === column.index + 1)
                  : undefined;
              const outgoingOptions =
                column.direction === 'left'
                  ? (innerNeighbor?.relationsToLeft ?? [])
                  : column.relationsToRight;
              const relationKeyColumn =
                column.direction === 'left' ? column.index : column.index + 1;
              const selectedRelationKeys =
                normalizedConfig.columnRelationKeys?.[String(relationKeyColumn)] ?? [];
              const relationFilterOptions: Array<
                ExploreRelationOption & { unavailable?: boolean }
              > = [
                ...outgoingOptions,
                // Selected relations that are no longer offered stay visible so they can be unticked.
                ...selectedRelationKeys
                  .filter(key => !outgoingOptions.some(option => option.relationKey === key))
                  .flatMap(key => {
                    try {
                      const [source, label, target] = JSON.parse(key) as [string, string, string];
                      return [
                        {
                          relationKey: key,
                          sourceEntitySchemaId: source,
                          targetEntitySchemaId: target,
                          fieldLabel: label,
                          kind: 'reference' as const,
                          unavailable: true
                        }
                      ];
                    } catch {
                      return [];
                    }
                  })
              ];
              const showRelationFilter = !hideToolbar && relationFilterOptions.length > 0;
              const canResetColumn =
                selectedSchemaId != null ||
                selectedRelationKeys.length > 0 ||
                [...excludedFromColumn.values()].includes(column.index);
              const activeFilterSummary = [
                selectedSchemaId != null ? 'schema filter' : null,
                selectedRelationKeys.length > 0 ? 'relation filter' : null,
                [...excludedFromColumn.values()].includes(column.index) ? 'excluded entities' : null
              ]
                .filter((part): part is string => part != null)
                .join(', ');
              const resetColumn = () => {
                const columnSchemaIds = { ...(normalizedConfig.columnSchemaIds ?? {}) };
                delete columnSchemaIds[String(column.index)];
                const columnRelationKeys = { ...(normalizedConfig.columnRelationKeys ?? {}) };
                delete columnRelationKeys[String(relationKeyColumn)];
                updateConfig({
                  columnSchemaIds:
                    Object.keys(columnSchemaIds).length > 0 ? columnSchemaIds : undefined,
                  columnRelationKeys:
                    Object.keys(columnRelationKeys).length > 0 ? columnRelationKeys : undefined
                });
                setExcludedFromColumn(previous => {
                  const next = new Map(previous);
                  for (const [entityId, columnIndex] of previous) {
                    if (columnIndex === column.index) next.delete(entityId);
                  }
                  return next;
                });
              };
              const columnMenuHasItems = true;

              return (
                <section
                  key={column.index}
                  className={styles.column}
                  data-testid={`explore-column-${column.index}`}
                >
                  <header className={styles.columnHeader}>
                    <div>
                      <div className={styles.columnLabel}>{columnLabel}</div>
                      <div className={styles.columnMeta}>
                        {column.entities.length}{' '}
                        {column.entities.length === 1 ? 'entity' : 'entities'}
                      </div>
                    </div>

                    {columnMenuHasItems && (
                      <div className={styles.columnActions}>
                        {canResetColumn && (
                          <span
                            className={styles.columnFilterIndicator}
                            title={`Active: ${activeFilterSummary}`}
                            role="img"
                            aria-label={`Active: ${activeFilterSummary}`}
                            data-testid={`explore-column-filter-indicator-${column.index}`}
                          >
                            <TbFilter size={13} />
                          </span>
                        )}
                        <MenuButton.Root>
                          <MenuButton.Trigger
                            element={
                              <Button
                                size="xs"
                                variant="ghost"
                                icon={<TbDots size={14} />}
                                aria-label={`${columnLabel} actions`}
                                title="Column actions"
                                data-testid={`explore-column-menu-${column.index}`}
                              />
                            }
                          />
                          <MenuButton.Menu align="end">
                            {showSchemaFilter && (
                              <Menu.SubMenu label="Filter by schema">
                                <Menu.RadioGroup value={selectedSchemaId ?? ''}>
                                  <Menu.RadioItem
                                    value=""
                                    onClick={() => updateColumnSchema(column.index, '')}
                                  >
                                    All schemas
                                  </Menu.RadioItem>
                                  {schemaOptions.map(option => (
                                    <Menu.RadioItem
                                      key={option.schemaId}
                                      value={option.schemaId}
                                      onClick={() =>
                                        updateColumnSchema(column.index, option.schemaId)
                                      }
                                    >
                                      {option.name}
                                      {option.schemaId === selectedSchemaId &&
                                      !availableSchemaIds.has(option.schemaId)
                                        ? ' (unavailable)'
                                        : ''}
                                    </Menu.RadioItem>
                                  ))}
                                </Menu.RadioGroup>
                              </Menu.SubMenu>
                            )}
                            {showRelationFilter && (
                              <Menu.SubMenu label="Filter outgoing relations">
                                {relationFilterOptions.map(option => (
                                  <Menu.CheckboxItem
                                    key={option.relationKey}
                                    checked={selectedRelationKeys.includes(option.relationKey)}
                                    onCheckedChange={checked =>
                                      updateColumnRelations(
                                        relationKeyColumn,
                                        checked
                                          ? [...selectedRelationKeys, option.relationKey]
                                          : selectedRelationKeys.filter(
                                              key => key !== option.relationKey
                                            )
                                      )
                                    }
                                  >
                                    {schemaMap.get(option.sourceEntitySchemaId)?.name ??
                                      option.sourceEntitySchemaId}{' '}
                                    {option.fieldLabel}{' '}
                                    {schemaMap.get(option.targetEntitySchemaId)?.name ??
                                      option.targetEntitySchemaId}
                                    {option.unavailable ? ' (unavailable)' : ''}
                                  </Menu.CheckboxItem>
                                ))}
                              </Menu.SubMenu>
                            )}
                            {(showSchemaFilter || showRelationFilter) &&
                              columnDepthActions.length > 0 && <Menu.Separator />}
                            {columnDepthActions.map(action => (
                              <Menu.Item
                                key={action.label}
                                disabled={action.disabled}
                                onClick={action.onClick}
                              >
                                {action.label}
                              </Menu.Item>
                            ))}
                            <Menu.Separator />
                            <Menu.Item disabled={!canResetColumn} onClick={resetColumn}>
                              Reset
                            </Menu.Item>
                          </MenuButton.Menu>
                        </MenuButton.Root>
                      </div>
                    )}
                  </header>

                  <div className={styles.columnBody}>
                    {column.entities.length === 0 ? (
                      <div className={styles.columnEmpty}>No matching entities at this hop.</div>
                    ) : (
                      column.entities.map(entity => {
                        const schema = schemaMap.get(entity.schemaId);
                        const isDuplicate = graph.duplicateIds.has(entity.entityId);
                        const isLinked =
                          linkedEntityIds == null ? true : linkedEntityIdSet.has(entity.entityId);
                        return (
                          <button
                            key={entity.entityId}
                            ref={setEntityRef(column.index, entity.entityId)}
                            type="button"
                            className={styles.entityCard}
                            onClick={() => onEntityClick(entity.publicId)}
                            onContextMenu={event =>
                              handleEntityContextMenu(event, entity, column.index)
                            }
                          >
                            <div className={styles.entityTop}>
                              <div className={styles.entityIdentity}>
                                {schema && (
                                  <TypeBadge
                                    color={schema.color}
                                    name={schema.name}
                                    icon={schema.icon}
                                    size={18}
                                  />
                                )}
                                <div className={styles.entityText}>
                                  <div
                                    className={styles.entityName}
                                    style={
                                      isLinked ? undefined : { color: 'var(--base-fg-more-dim)' }
                                    }
                                  >
                                    {entity.name ?? entity.slug}
                                  </div>
                                  {selectedDisplayFields.includes('_slug') && (
                                    <div className={styles.entitySlug}>{entity.slug}</div>
                                  )}
                                </div>
                              </div>
                              {isDuplicate && (
                                <span className={styles.duplicateBadge}>Duplicate</span>
                              )}
                            </div>

                            <div className={styles.entityMeta}>
                              {entity.record &&
                                selectedDisplayFields
                                  .filter(id => id !== '_slug' && id !== '_description')
                                  .map(id => {
                                    const field = findEntityDisplayField(
                                      id,
                                      entity.record!,
                                      fullSchemaMap,
                                      displayFields
                                    );
                                    const value = field
                                      ? formatEntityDisplayValue(entity.record!, field)
                                      : null;
                                    return value == null ? null : (
                                      <Chip key={id} tone="ghost">
                                        {field!.label}: {value}
                                      </Chip>
                                    );
                                  })}
                            </div>
                            {entity.record &&
                              selectedDisplayFields.includes('_description') &&
                              entity.record._description && (
                                <div className={styles.entitySlug}>
                                  {entity.record._description}
                                </div>
                              )}
                          </button>
                        );
                      })
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      </div>

      {contextMenu && (
        <EntityContextMenuView
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          items={buildEntityMenuItems(
            {
              _uid: contextMenu.entity.entityId,
              _publicId: contextMenu.entity.publicId,
              _name: contextMenu.entity.name,
              _slug: contextMenu.entity.slug,
              _schema: { id: contextMenu.entity.schemaId }
            },
            {
              actions: commonActions,
              pin: false,
              extra: [
                {
                  id: 'exclude',
                  label: 'Exclude',
                  icon: <TbEyeOff size={14} />,
                  onClick: excludeEntity
                },
                { id: 'focus', label: 'Focus', icon: <TbFocus2 size={14} />, onClick: focusEntity }
              ]
            }
          )}
        />
      )}
    </ViewControlsFrame>
  );
};
