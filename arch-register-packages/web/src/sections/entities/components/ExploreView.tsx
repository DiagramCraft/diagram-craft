import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { TbFilter, TbMinus, TbPlus } from 'react-icons/tb';
import { TypeBadge } from '../../../components/TypeBadge';
import { Chip } from '../../../components/Chip';
import { useMultipleEntityRelations } from '../../../hooks/useEntities';
import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import { resolveSchemaColor } from '../../../lib/schemaPresentation';
import {
  exploreViewConfigSchema,
  type ExploreViewConfig
} from '@arch-register/api-types/viewContract';
import styles from './ExploreView.module.css';
import { EmptyState } from '../../../components/EmptyState';
import {
  buildExploreGraph,
  buildExploreRelationOptions,
  DEFAULT_EXPLORE_CONFIG,
  normalizeExploreConfig
} from './ExploreView.helpers';
import { connectorDistance, type ExploreConnectorLine } from './exploreGeometry';
import { Button } from '@diagram-craft/app-components/Button';
import { Popover, type PopoverActions } from '@diagram-craft/app-components/Popover';
import type { EntityBrowserRowViewProps } from './entityBrowserViewTypes';
import {
  findEntityDisplayField,
  formatEntityDisplayValue,
  getDisplayFieldIds,
  type EntityDisplayField
} from './entityDisplayFields';

type ExploreViewProps = EntityBrowserRowViewProps & {
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

export const ExploreView = ({
  rows,
  onEntityClick,
  config,
  onConfigChange,
  linkedEntityIds,
  hideToolbar,
  displayFields
}: ExploreViewProps) => {
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
  const selectedDisplayFields = getDisplayFieldIds('explore', normalizedConfig);
  const linkedEntityIdSet = useMemo(() => new Set(linkedEntityIds ?? []), [linkedEntityIds]);
  const [connectorTooltip, setConnectorTooltip] = useState<ConnectorTooltip>(null);

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
  const [fetchIds, setFetchIds] = useState<string[]>(centerIds);

  useEffect(() => {
    setFetchIds(centerIds);
  }, [centerIds]);

  const relationsMap = useMultipleEntityRelations(workspaceSlug, fetchIds);
  const graph = useMemo(
    () =>
      buildExploreGraph({
        centerEntities: rows,
        relationsMap,
        config: normalizedConfig
      }),
    [rows, relationsMap, normalizedConfig]
  );

  const relationOptionGraph = useMemo(
    () =>
      buildExploreGraph({
        centerEntities: rows,
        relationsMap,
        config: { ...normalizedConfig, relationKeys: undefined }
      }),
    [rows, relationsMap, normalizedConfig]
  );
  const relationOptions = useMemo(
    () => buildExploreRelationOptions(relationOptionGraph.connectors),
    [relationOptionGraph.connectors]
  );
  const relationOptionGroups = useMemo(() => {
    const groups = new Map<string, { name: string; options: typeof relationOptions }>();
    for (const option of relationOptions) {
      const schema = schemaMap.get(option.sourceEntitySchemaId);
      const group = groups.get(option.sourceEntitySchemaId) ?? {
        name: schema?.name ?? option.sourceEntitySchemaId,
        options: []
      };
      group.options.push(option);
      groups.set(option.sourceEntitySchemaId, group);
    }
    return [...groups.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [relationOptions, schemaMap]);
  const relationFilterActionsRef = useRef<PopoverActions | null>(null);
  const selectedRelationKeys = normalizedConfig.relationKeys ?? [];
  const hasRelationFilter = selectedRelationKeys.length > 0;

  const toggleRelationKey = useCallback(
    (relationKey: string) => {
      const nextKeys = selectedRelationKeys.includes(relationKey)
        ? selectedRelationKeys.filter(key => key !== relationKey)
        : [...selectedRelationKeys, relationKey];
      updateConfig({ relationKeys: nextKeys, relationFieldNames: [] });
    },
    [selectedRelationKeys, updateConfig]
  );

  useEffect(() => {
    const nextIds = [...new Set([...centerIds, ...graph.visibleEntityIds])].sort();
    setFetchIds(prev => (prev.join('|') === nextIds.join('|') ? prev : nextIds));
  }, [centerIds, graph.visibleEntityIds]);

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

      setConnectorLines(lines);
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
      <div className={styles.wrap}>
        {!hideToolbar && (
          <div className={styles.toolbar}>
            <span className={`${styles.emptyToggle} ${styles.toolbarActions}`}>
              No relations available
            </span>
          </div>
        )}
        <EmptyState title="No entities found" subtitle="Try adjusting your search or filters." />
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      {!hideToolbar && (
        <div className={styles.toolbar}>
          <div className={styles.toolbarActions}>
            <Popover.Root actionsRef={relationFilterActionsRef}>
              <Popover.Trigger
                element={
                  <Button
                    size="sm"
                    variant={hasRelationFilter ? 'primary' : 'secondary'}
                    icon={<TbFilter size={13} />}
                    aria-label="Filter relations"
                    title="Filter relations"
                    disabled={relationOptions.length === 0 && !hasRelationFilter}
                  >
                    Filter relations
                    {hasRelationFilter && (
                      <span className={styles.filterCount}>{selectedRelationKeys.length}</span>
                    )}
                  </Button>
                }
              />
              <Popover.Content
                sideOffset={4}
                align="start"
                arrow={false}
                closeButton={false}
                className={styles.relationFilterPopover}
              >
                <div className={styles.relationFilterHeader}>
                  <div>
                    <div className={styles.relationFilterTitle}>Relations in scope</div>
                    <div className={styles.relationFilterHint}>
                      Choose the schema relationships to show.
                    </div>
                  </div>
                  <Button
                    size="xs"
                    variant="ghost"
                    disabled={!hasRelationFilter}
                    onClick={() =>
                      updateConfig({ relationKeys: undefined, relationFieldNames: [] })
                    }
                  >
                    Show all
                  </Button>
                </div>
                {relationOptionGroups.length === 0 ? (
                  <div className={styles.relationFilterEmpty}>No relations are in scope.</div>
                ) : (
                  <div className={styles.relationFilterGroups}>
                    {relationOptionGroups.map(group => (
                      <div key={group.name} className={styles.relationFilterGroup}>
                        <div className={styles.relationFilterGroupTitle}>{group.name}</div>
                        {group.options.map(option => {
                          const active = selectedRelationKeys.includes(option.relationKey);
                          return (
                            <label key={option.relationKey} className={styles.relationFilterOption}>
                              <input
                                type="checkbox"
                                checked={active}
                                onChange={() => toggleRelationKey(option.relationKey)}
                              />
                              <span>
                                {schemaMap.get(option.sourceEntitySchemaId)?.name ??
                                  option.sourceEntitySchemaId}{' '}
                                <span className={styles.relationFilterPredicate}>
                                  {option.fieldLabel}
                                </span>{' '}
                                {schemaMap.get(option.targetEntitySchemaId)?.name ??
                                  option.targetEntitySchemaId}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                )}
              </Popover.Content>
            </Popover.Root>
          </div>
        </div>
      )}

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
            {graph.columns.map(column => (
              <section key={column.index} className={styles.column}>
                <header className={styles.columnHeader}>
                  <div>
                    <div className={styles.columnLabel}>
                      {column.direction === 'center'
                        ? 'Filtered entities'
                        : column.direction === 'left'
                          ? `Incoming hop ${column.hop}`
                          : `Outgoing hop ${column.hop}`}
                    </div>
                    <div className={styles.columnMeta}>
                      {column.entities.length}{' '}
                      {column.entities.length === 1 ? 'entity' : 'entities'}
                    </div>
                  </div>

                  <div className={styles.columnActions}>
                    {column.direction === 'center' && normalizedConfig.leftDepth === 0 && (
                      <Button
                        size={'xs'}
                        onClick={() => updateConfig({ leftDepth: 1 })}
                        aria-label="Show left column"
                        title="Show left column"
                      >
                        <TbPlus size={12} />
                      </Button>
                    )}

                    {column.direction === 'left' && column.hop === normalizedConfig.leftDepth && (
                      <Button
                        size={'xs'}
                        onClick={() => updateConfig({ leftDepth: normalizedConfig.leftDepth - 1 })}
                        aria-label="Hide left column"
                        title="Hide left column"
                      >
                        <TbMinus size={12} />
                      </Button>
                    )}

                    {column.direction === 'left' ? (
                      <Button
                        size={'xs'}
                        onClick={() => updateConfig({ leftDepth: normalizedConfig.leftDepth + 1 })}
                        disabled={column.entities.length === 0}
                        aria-label="Add left column"
                        title="Add left column"
                      >
                        <TbPlus size={12} />
                      </Button>
                    ) : null}

                    {column.direction === 'right' && column.hop === normalizedConfig.rightDepth && (
                      <Button
                        size={'xs'}
                        onClick={() =>
                          updateConfig({ rightDepth: normalizedConfig.rightDepth - 1 })
                        }
                        aria-label="Hide right column"
                        title="Hide right column"
                      >
                        <TbMinus size={12} />
                      </Button>
                    )}

                    {column.direction === 'right' ? (
                      <Button
                        size={'xs'}
                        onClick={() =>
                          updateConfig({ rightDepth: normalizedConfig.rightDepth + 1 })
                        }
                        disabled={column.entities.length === 0}
                        aria-label="Add right column"
                        title="Add right column"
                      >
                        <TbPlus size={12} />
                      </Button>
                    ) : null}

                    {column.direction === 'center' && normalizedConfig.rightDepth === 0 && (
                      <Button
                        size={'xs'}
                        onClick={() => updateConfig({ rightDepth: 1 })}
                        aria-label="Show right column"
                        title="Show right column"
                      >
                        <TbPlus size={12} />
                      </Button>
                    )}
                  </div>
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
                              <div className={styles.entitySlug}>{entity.record._description}</div>
                            )}
                        </button>
                      );
                    })
                  )}
                </div>
              </section>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
