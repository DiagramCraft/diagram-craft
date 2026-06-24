import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { TbMinus, TbPlus } from 'react-icons/tb';
import { TypeBadge } from '../../../components/TypeBadge';
import { Chip } from '../../../components/Chip';
import { useMultipleEntityRelations } from '../../../hooks/useEntities';
import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import { resolveSchemaColor } from '../../../lib/api';
import type { EntityRecord } from '@arch-register/api-types/entityContract';
import type { ExploreViewConfig } from '@arch-register/api-types/viewContract';
import styles from './ExploreView.module.css';
import {
  buildDefaultRelationFieldNames,
  buildExploreGraph,
  buildRelationFieldOptions,
  DEFAULT_EXPLORE_CONFIG,
  normalizeExploreConfig,
  type ExploreConnector
} from './ExploreView.helpers';
import { Button } from '@diagram-craft/app-components/Button';

type ExploreViewProps = {
  rows: EntityRecord[];
  onEntityClick: (entityPublicId: string) => void;
  config: ExploreViewConfig | null;
  onConfigChange: (cfg: ExploreViewConfig) => void;
};

type ConnectorLine = ExploreConnector & {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

type ConnectorTooltip = {
  fromEntityName: string;
  fieldName: string;
  toEntityName: string;
  x: number;
  y: number;
} | null;

const pointToSegmentDistance = (
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
) => {
  const dx = x2 - x1;
  const dy = y2 - y1;
  if (dx === 0 && dy === 0) return Math.hypot(px - x1, py - y1);

  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)));
  const cx = x1 + t * dx;
  const cy = y1 + t * dy;
  return Math.hypot(px - cx, py - cy);
};

const cubicPoint = (
  t: number,
  x1: number,
  y1: number,
  cx1: number,
  cy1: number,
  cx2: number,
  cy2: number,
  x2: number,
  y2: number
) => {
  const mt = 1 - t;
  const x = mt * mt * mt * x1 + 3 * mt * mt * t * cx1 + 3 * mt * t * t * cx2 + t * t * t * x2;
  const y = mt * mt * mt * y1 + 3 * mt * mt * t * cy1 + 3 * mt * t * t * cy2 + t * t * t * y2;
  return { x, y };
};

const connectorDistance = (line: ConnectorLine, px: number, py: number) => {
  const cx = line.x1 + (line.x2 - line.x1) / 2;
  let minDistance = Number.POSITIVE_INFINITY;
  let prev = { x: line.x1, y: line.y1 };

  for (let i = 1; i <= 24; i++) {
    const t = i / 24;
    const next = cubicPoint(t, line.x1, line.y1, cx, line.y1, cx, line.y2, line.x2, line.y2);
    minDistance = Math.min(
      minDistance,
      pointToSegmentDistance(px, py, prev.x, prev.y, next.x, next.y)
    );
    prev = next;
  }

  return minDistance;
};

export const ExploreView = ({ rows, onEntityClick, config, onConfigChange }: ExploreViewProps) => {
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

  const [localConfig, setLocalConfig] = useState<ExploreViewConfig>(
    normalizeExploreConfig(config ?? DEFAULT_EXPLORE_CONFIG)
  );
  const defaultRelationFieldNames = useMemo(
    () => buildDefaultRelationFieldNames(schemas),
    [schemas]
  );
  const normalizedConfig = useMemo(
    () => normalizeExploreConfig(config ?? localConfig),
    [config, localConfig]
  );
  const [connectorTooltip, setConnectorTooltip] = useState<ConnectorTooltip>(null);

  useEffect(() => {
    if (config == null) return;
    setLocalConfig(normalizeExploreConfig(config));
  }, [config]);

  useEffect(() => {
    if (config != null || defaultRelationFieldNames.length === 0) return;
    if (localConfig.relationFieldNames.length > 0) return;

    const nextConfig = normalizeExploreConfig({
      ...localConfig,
      relationFieldNames: defaultRelationFieldNames
    });
    setLocalConfig(nextConfig);
    onConfigChange(nextConfig);
  }, [config, defaultRelationFieldNames, localConfig, onConfigChange]);

  const updateConfig = useCallback(
    (patch: Partial<ExploreViewConfig>) => {
      const nextConfig = normalizeExploreConfig({ ...normalizedConfig, ...patch });
      setLocalConfig(nextConfig);
      onConfigChange(nextConfig);
    },
    [normalizedConfig, onConfigChange]
  );

  const relationFieldOptions = useMemo(() => buildRelationFieldOptions(schemas), [schemas]);
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
        fieldName: line.fieldName,
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
        <div className={styles.toolbar}>
          <div className={styles.toolbarBlock}>
            <div className={styles.toolbarLabel}>Relation fields</div>
            <div className={styles.toggleRow}>
              <span className={styles.emptyToggle}>No relations available</span>
            </div>
          </div>
        </div>
        <div className={styles.empty}>
          <div className={styles.emptyTitle}>No entities found</div>
          <div>Try adjusting your search or filters.</div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.toolbar}>
        <div className={styles.toolbarBlock}>
          <div className={styles.toolbarLabel}>Relation fields</div>
          <div className={styles.toggleRow}>
            {relationFieldOptions.map(option => {
              const active = normalizedConfig.relationFieldNames.includes(option.value);
              return (
                <button
                  key={option.value}
                  type="button"
                  className={`${styles.toggleButton} ${active ? styles.toggleButtonActive : ''}`}
                  aria-pressed={active}
                  onClick={() => {
                    const nextValues = active
                      ? normalizedConfig.relationFieldNames.filter(value => value !== option.value)
                      : [...normalizedConfig.relationFieldNames, option.value];
                    updateConfig({ relationFieldNames: nextValues });
                  }}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

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
                <g
                  key={`${line.fromColumn}:${line.fromEntityId}:${line.toColumn}:${line.toEntityId}:${line.fieldName}:${index}`}
                >
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
              <span className={styles.connectorTooltipField}>{connectorTooltip.fieldName}</span>
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
                                <div className={styles.entityName}>
                                  {entity.name || entity.slug}
                                </div>
                                <div className={styles.entitySlug}>{entity.slug}</div>
                              </div>
                            </div>
                            {isDuplicate && (
                              <span className={styles.duplicateBadge}>Duplicate</span>
                            )}
                          </div>

                          <div className={styles.entityMeta}>
                            {schema && <Chip tone="ghost">{schema.name}</Chip>}
                            {entity.ownerName && <Chip tone="ghost">{entity.ownerName}</Chip>}
                          </div>
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
