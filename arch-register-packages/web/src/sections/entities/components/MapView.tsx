import { useMemo, useCallback, useState, type KeyboardEvent, type MouseEvent } from 'react';
import styles from './MapView.module.css';
import { TbChevronDown } from 'react-icons/tb';
import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import { resolveSchemaColor } from '../../../lib/schemaPresentation';
import type { EntityRecord, TreeNode } from '@arch-register/api-types/entityContract';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import type { WorkspaceLifecycleState } from '@arch-register/api-types/workspaceContract';
import type {
  MetricAggregation,
  MetricConfig,
  MetricLegend as MetricLegendData,
  MetricResult
} from '@arch-register/api-types/metricContract';
import { mapViewConfigSchema } from '@arch-register/api-types/viewContract';
import { useEntityBrowserTreeData } from './useEntityBrowserTreeData';
import { EmptyState } from '../../../components/EmptyState';
import {
  findEntityDisplayField,
  formatEntityDisplayValue,
  getDisplayFieldIds,
  type EntityDisplayField
} from './entityDisplayFields';
import { normalizeViewConfig } from './entityViewConfig';
import { HoverCard } from '../../../components/HoverCard';
import {
  EntityHoverCardBody,
  type EntityHoverCardRow
} from '../../../components/EntityHoverCardBody';
import {
  buildContainmentTreeIndex,
  getChildSchemas,
  getContainmentChildren,
  sortContainmentNodes
} from './mapViewState';
import type { JoinedAssessmentContext } from './entityFieldSources';
import {
  AGGREGATION_OPTIONS,
  getMetricSourceOptions,
  isEnumSource,
  parseMetricConfig,
  sourceKey
} from './mapMetricConfig';
import {
  categoricalColor,
  NEUTRAL_MISSING_COLOR,
  numericColor,
  textColorForFill
} from './mapColorScales';
import { useMapMetricRollup } from './useMapMetricRollup';
import { MapLegend } from './MapLegend';
import { MapBreadcrumb, type MapFocusEntry } from './MapBreadcrumb';

// ── Types ─────────────────────────────────────────────────────────────────────

export type MapConfig = {
  levels: number;
  level1SchemaId: string | null;
  level1Columns: number;
  level2SchemaId: string | null;
  level2Columns: number;
  level3SchemaId: string | null;
  level3Columns: number;
  fieldIds?: string[];
  metricConfig?: unknown;
};

type MapViewProps = {
  workspaceId: string;
  projectId?: string;
  projectScope: 'project' | 'all';
  q: string;
  typeFilter: string | null;
  ownerFilter: string | null;
  statusFilter: string | null;
  onEntityClick: (entityId: string) => void;
  config: unknown;
  onConfigChange: (cfg: MapConfig) => void;
  linkedEntityIds?: string[];
  hideToolbar?: boolean;
  displayFields: EntityDisplayField[];
  lifecycleStates: WorkspaceLifecycleState[];
  joinAssessmentId?: string | null;
  joinedAssessment?: JoinedAssessmentContext | null;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

// `fieldIds`/`metricConfig` are explicitly included (as undefined) so normalizeViewConfig's
// field-merge loop picks them up from a parsed config when present.
const DEFAULT_CONFIG: MapConfig = {
  levels: 2,
  level1SchemaId: null,
  level1Columns: 3,
  level2SchemaId: null,
  level2Columns: 3,
  level3SchemaId: null,
  level3Columns: 3,
  fieldIds: undefined,
  metricConfig: undefined
};

const nodeName = (n: TreeNode) => n._name || n._slug;

const aggregationLabel = (aggregation: MetricAggregation) =>
  AGGREGATION_OPTIONS.find(o => o.value === aggregation)?.label ?? aggregation;

/** Box fill color for `node`'s metric result, or null when no metric is configured. */
const resolveBoxColor = (
  node: TreeNode,
  metric: MetricConfig | null,
  resultsByBoxId: Map<string, MetricResult>,
  legend: MetricLegendData,
  lifecycleStates: WorkspaceLifecycleState[]
): string | null => {
  if (!metric) return null;
  const result = resultsByBoxId.get(node._uid);
  if (!result) return NEUTRAL_MISSING_COLOR;

  if (isEnumSource(metric.source)) {
    if (result.dominantValue == null) return NEUTRAL_MISSING_COLOR;
    const categories = legend.categories ?? [];
    const index = categories.findIndex(c => c.value === result.dominantValue);
    return categoricalColor(index === -1 ? Number.MAX_SAFE_INTEGER : index);
  }
  if (metric.source.kind === 'lifecycle' && result.lifecycleId != null) {
    return lifecycleStates.find(s => s.id === result.lifecycleId)?.color ?? NEUTRAL_MISSING_COLOR;
  }
  if (result.value == null || legend.min == null || legend.max == null)
    return NEUTRAL_MISSING_COLOR;
  return numericColor(result.value, legend.min, legend.max);
};

/** Extra hover-card rows describing the metric result: value, enum distribution, coverage. */
const buildMetricRows = (
  node: TreeNode,
  metric: MetricConfig | null,
  metricLabel: string,
  resultsByBoxId: Map<string, MetricResult>,
  lifecycleStates: WorkspaceLifecycleState[]
): EntityHoverCardRow[] => {
  if (!metric) return [];
  const result = resultsByBoxId.get(node._uid);
  if (!result) return [];

  const rows: EntityHoverCardRow[] = [];
  if (isEnumSource(metric.source)) {
    rows.push({ label: metricLabel, value: result.dominantLabel ?? '—' });
    if (result.distribution.length > 0) {
      rows.push({
        label: 'Distribution',
        value: result.distribution.map(d => `${d.label}: ${d.count}`).join(', ')
      });
    }
  } else if (metric.source.kind === 'lifecycle' && result.lifecycleId != null) {
    const label =
      lifecycleStates.find(s => s.id === result.lifecycleId)?.label ?? result.lifecycleId;
    rows.push({ label: metricLabel, value: label });
  } else {
    rows.push({
      label: metricLabel,
      value: result.value == null ? '—' : String(Math.round(result.value * 100) / 100)
    });
  }
  rows.push({
    label: 'Coverage',
    value: `${result.populatedCount} of ${result.sourceCount} had data`
  });
  return rows;
};

// ── EntityTooltip ─────────────────────────────────────────────────────────────

const EntityTooltip = ({
  node,
  color,
  schemaName,
  isLinked,
  children,
  displayFields,
  schemaMap,
  metricRows
}: {
  node: TreeNode;
  color: string;
  schemaName: string;
  isLinked: boolean;
  children: React.ReactNode;
  displayFields: EntityDisplayField[];
  schemaMap: Map<string, { schema: EntitySchema; index: number }>;
  metricRows: EntityHoverCardRow[];
}) => {
  const fieldRows = displayFields
    .filter(f => f.id !== '_description' && f.id !== '_tags')
    .map(option => {
      const field = findEntityDisplayField(option.id, node, schemaMap, displayFields);
      const value = field ? formatEntityDisplayValue(node as EntityRecord, field) : null;
      return value == null ? null : { label: field!.label, value };
    })
    .filter((row): row is { label: string; value: string } => row !== null);
  const rows: EntityHoverCardRow[] = [...metricRows, ...fieldRows];

  return (
    <HoverCard
      anchorClassName={styles.tooltipAnchor}
      sideOffset={6}
      content={
        <EntityHoverCardBody
          name={nodeName(node)}
          description={displayFields.some(f => f.id === '_description') ? node._description : null}
          schemaName={schemaName}
          schemaColor={color}
          tags={displayFields.some(f => f.id === '_tags') ? node._tags : undefined}
          rows={rows}
          titleStyle={isLinked ? undefined : { color: 'var(--base-fg-more-dim)' }}
        />
      }
    >
      {children}
    </HoverCard>
  );
};

// ── Config sub-components ─────────────────────────────────────────────────────

const SchemaSelect = ({
  label,
  value,
  options,
  onChange
}: {
  label: string;
  value: string | null;
  options: EntitySchema[];
  onChange: (id: string | null) => void;
}) => (
  <div className={styles.axisPill}>
    <span className={styles.axisKicker}>{label}</span>
    <div className={styles.selectWrap}>
      <select
        className={styles.select}
        value={value ?? ''}
        onChange={e => onChange(e.target.value || null)}
      >
        <option value="">— select —</option>
        {options.map(s => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
      <TbChevronDown size={11} />
    </div>
  </div>
);

const ColsSelect = ({ value, onChange }: { value: number; onChange: (n: number) => void }) => (
  <div className={styles.selectWrap}>
    <select
      className={styles.select}
      value={value}
      onChange={e => onChange(Number(e.target.value))}
    >
      {[1, 2, 3, 4].map(n => (
        <option key={n} value={n}>
          {n} col{n > 1 ? 's' : ''}
        </option>
      ))}
    </select>
    <TbChevronDown size={11} />
  </div>
);

// ── Main component ────────────────────────────────────────────────────────────

export const MapView = ({
  workspaceId,
  projectId,
  projectScope,
  q,
  typeFilter,
  ownerFilter,
  statusFilter,
  onEntityClick,
  config,
  onConfigChange,
  linkedEntityIds,
  hideToolbar,
  displayFields,
  lifecycleStates,
  joinAssessmentId,
  joinedAssessment
}: MapViewProps) => {
  const { schemas } = useWorkspaceContext();
  const { treeNodes: nodes, treeEdges: edges } = useEntityBrowserTreeData({
    workspaceId,
    projectId,
    projectScope,
    q,
    typeFilter,
    ownerFilter,
    statusFilter
  });
  const cfg = useMemo(
    () => normalizeViewConfig(mapViewConfigSchema, config, DEFAULT_CONFIG),
    [config]
  );
  const linkedEntityIdSet = useMemo(() => new Set(linkedEntityIds ?? []), [linkedEntityIds]);

  const selectedDisplayFields = getDisplayFieldIds('map', cfg).map(
    id => displayFields.find(field => field.id === id) ?? { id, label: id, group: 'Fields' }
  );

  const notify = useCallback(
    (patch: Partial<MapConfig>) => {
      onConfigChange({ ...cfg, ...patch });
    },
    [cfg, onConfigChange]
  );

  // ── Focus / breadcrumb navigation ────────────────────────────────────────
  // Activating a box re-roots the map on that entity, rendering its descendants (still capped
  // at 3 rendered levels below the new root); the breadcrumb stack lets the user navigate back
  // up. This is session-local state, not persisted in the URL/saved view - matching the
  // established pattern for in-view navigation elsewhere in the browser (ExploreView's
  // center-node re-focusing is likewise local `useState`, not URL-backed).
  const [focusStack, setFocusStack] = useState<MapFocusEntry[]>([]);
  const currentFocus = focusStack[focusStack.length - 1] ?? null;

  const focusOn = useCallback((node: TreeNode) => {
    setFocusStack(prev => [...prev, { uid: node._uid, name: nodeName(node) }]);
  }, []);

  const navigateBreadcrumb = useCallback((index: number) => {
    setFocusStack(prev => (index < 0 ? [] : prev.slice(0, index + 1)));
  }, []);

  const level2SchemaOptions = useMemo(
    () => getChildSchemas(schemas, cfg.level1SchemaId),
    [schemas, cfg.level1SchemaId]
  );

  const level3SchemaOptions = useMemo(
    () => getChildSchemas(schemas, cfg.level2SchemaId ?? null),
    [schemas, cfg.level2SchemaId]
  );

  const treeIndex = useMemo(() => buildContainmentTreeIndex(nodes, edges), [nodes, edges]);

  const level1Items = useMemo(() => {
    if (currentFocus) {
      return cfg.level1SchemaId
        ? getContainmentChildren(currentFocus.uid, cfg.level1SchemaId, treeIndex)
        : [];
    }
    return sortContainmentNodes(nodes, cfg.level1SchemaId);
  }, [nodes, cfg.level1SchemaId, currentFocus, treeIndex]);

  const getLevel2Children = useCallback(
    (parentUid: string): TreeNode[] => {
      if (!cfg.level2SchemaId) return [];
      return getContainmentChildren(parentUid, cfg.level2SchemaId, treeIndex);
    },
    [treeIndex, cfg.level2SchemaId]
  );

  const getLevel3Children = useCallback(
    (parentUid: string): TreeNode[] => {
      if (!cfg.level3SchemaId) return [];
      return getContainmentChildren(parentUid, cfg.level3SchemaId, treeIndex);
    },
    [treeIndex, cfg.level3SchemaId]
  );

  const schemaMap = useMemo(() => {
    const m = new Map<string, { schema: EntitySchema; index: number }>();
    schemas.forEach((s, i) => m.set(s.id, { schema: s, index: i }));
    return m;
  }, [schemas]);

  // ── Metric configuration ─────────────────────────────────────────────────

  const metricConfig = useMemo(() => parseMetricConfig(cfg.metricConfig), [cfg.metricConfig]);
  const metricSourceSchema = metricConfig
    ? schemaMap.get(metricConfig.sourceSchemaId)?.schema
    : undefined;
  const metricSourceOptions = useMemo(
    () => getMetricSourceOptions(metricSourceSchema, joinedAssessment),
    [metricSourceSchema, joinedAssessment]
  );
  const activeSourceOption = metricConfig
    ? metricSourceOptions.find(o => sourceKey(o.source) === sourceKey(metricConfig.source))
    : undefined;
  const metricLabel = metricConfig
    ? isEnumSource(metricConfig.source)
      ? (activeSourceOption?.label ?? metricConfig.source.kind)
      : `${activeSourceOption?.label ?? metricConfig.source.kind} (${aggregationLabel(metricConfig.aggregation)})`
    : '';

  const setMetricConfig = useCallback(
    (next: MetricConfig | null) => notify({ metricConfig: next ?? undefined }),
    [notify]
  );

  const visibleBoxIds = useMemo(() => {
    const ids: string[] = [];
    for (const l1 of level1Items) {
      ids.push(l1._uid);
      if (cfg.levels < 2) continue;
      for (const l2 of getLevel2Children(l1._uid)) {
        ids.push(l2._uid);
        if (cfg.levels < 3) continue;
        for (const l3 of getLevel3Children(l2._uid)) ids.push(l3._uid);
      }
    }
    return ids;
  }, [level1Items, cfg.levels, getLevel2Children, getLevel3Children]);

  const { resultsByBoxId, legend } = useMapMetricRollup({
    workspaceId,
    boxEntityIds: visibleBoxIds,
    metric: metricConfig,
    schemaId: typeFilter,
    owner: ownerFilter,
    lifecycle: statusFilter,
    q,
    assessmentId: joinAssessmentId,
    projectId,
    projectScope
  });

  const boxStyle = useCallback(
    (node: TreeNode): React.CSSProperties | undefined => {
      const color = resolveBoxColor(node, metricConfig, resultsByBoxId, legend, lifecycleStates);
      if (!color) return undefined;
      return { background: color };
    },
    [metricConfig, resultsByBoxId, legend, lifecycleStates]
  );

  const nameStyle = useCallback(
    (node: TreeNode, dimmed: boolean): React.CSSProperties | undefined => {
      if (dimmed) return { color: 'var(--base-fg-more-dim)' };
      const color = resolveBoxColor(node, metricConfig, resultsByBoxId, legend, lifecycleStates);
      return color ? { color: textColorForFill(color) } : undefined;
    },
    [metricConfig, resultsByBoxId, legend, lifecycleStates]
  );

  const metricRowsFor = useCallback(
    (node: TreeNode): EntityHoverCardRow[] =>
      buildMetricRows(node, metricConfig, metricLabel, resultsByBoxId, lifecycleStates),
    [metricConfig, metricLabel, resultsByBoxId, lifecycleStates]
  );

  const focusHandlers = useCallback(
    (node: TreeNode) => ({
      role: 'button' as const,
      tabIndex: 0,
      onClick: () => focusOn(node),
      onKeyDown: (e: KeyboardEvent<HTMLDivElement>) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          focusOn(node);
        }
      }
    }),
    [focusOn]
  );

  const detailClick = useCallback(
    (publicId: string) => (e: MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      onEntityClick(publicId);
    },
    [onEntityClick]
  );

  const rootLabel = (cfg.level1SchemaId && schemaMap.get(cfg.level1SchemaId)?.schema.name) || 'Map';

  const isUnconfigured = !cfg.level1SchemaId;

  return (
    <div className={styles.wrap}>
      {/* Config bar */}
      {!hideToolbar && (
        <div className={styles.config}>
          <div className={styles.axisPill}>
            <span className={styles.axisKicker}>Levels</span>
            <div className={styles.selectWrap}>
              <select
                className={styles.select}
                value={cfg.levels}
                onChange={e => {
                  const n = Number(e.target.value);
                  notify({ levels: n, level3SchemaId: n < 3 ? null : cfg.level3SchemaId });
                }}
              >
                <option value={1}>1</option>
                <option value={2}>2</option>
                <option value={3}>3</option>
              </select>
              <TbChevronDown size={11} />
            </div>
          </div>

          <span className={styles.cross}>|</span>

          <SchemaSelect
            label="L1"
            value={cfg.level1SchemaId}
            options={schemas}
            onChange={id => {
              notify({ level1SchemaId: id, level2SchemaId: null, level3SchemaId: null });
              setFocusStack([]);
            }}
          />
          <ColsSelect value={cfg.level1Columns} onChange={n => notify({ level1Columns: n })} />

          {cfg.levels >= 2 && (
            <>
              <span className={styles.cross}>›</span>
              <SchemaSelect
                label="L2"
                value={cfg.level2SchemaId ?? null}
                options={level2SchemaOptions}
                onChange={id => notify({ level2SchemaId: id, level3SchemaId: null })}
              />
              <ColsSelect value={cfg.level2Columns} onChange={n => notify({ level2Columns: n })} />
            </>
          )}

          {cfg.levels >= 3 && (
            <>
              <span className={styles.cross}>›</span>
              <SchemaSelect
                label="L3"
                value={cfg.level3SchemaId ?? null}
                options={level3SchemaOptions}
                onChange={id => notify({ level3SchemaId: id })}
              />
              <ColsSelect value={cfg.level3Columns} onChange={n => notify({ level3Columns: n })} />
            </>
          )}
        </div>
      )}

      {!hideToolbar && (
        <div className={styles.config}>
          <div className={styles.axisPill}>
            <span className={styles.axisKicker}>Metric</span>
            <div className={styles.selectWrap}>
              <select
                className={styles.select}
                value={metricConfig?.sourceSchemaId ?? ''}
                onChange={e => {
                  const schemaId = e.target.value || null;
                  setMetricConfig(
                    schemaId
                      ? {
                          sourceSchemaId: schemaId,
                          source: { kind: 'lifecycle' },
                          aggregation: 'count'
                        }
                      : null
                  );
                }}
              >
                <option value="">None</option>
                {schemas.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <TbChevronDown size={11} />
            </div>
          </div>

          {metricConfig && (
            <>
              <span className={styles.cross}>›</span>
              <div className={styles.selectWrap}>
                <select
                  className={styles.select}
                  value={sourceKey(metricConfig.source)}
                  onChange={e => {
                    const option = metricSourceOptions.find(
                      o => sourceKey(o.source) === e.target.value
                    );
                    if (!option) return;
                    const nextIsEnum = isEnumSource(option.source);
                    setMetricConfig({
                      ...metricConfig,
                      source: option.source,
                      aggregation: nextIsEnum ? 'count' : metricConfig.aggregation,
                      worstDirection: nextIsEnum ? undefined : metricConfig.worstDirection
                    });
                  }}
                >
                  {metricSourceOptions.map(o => (
                    <option key={sourceKey(o.source)} value={sourceKey(o.source)}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <TbChevronDown size={11} />
              </div>

              <div className={styles.selectWrap}>
                <select
                  className={styles.select}
                  value={metricConfig.aggregation}
                  disabled={isEnumSource(metricConfig.source)}
                  onChange={e => {
                    const aggregation = e.target.value as MetricAggregation;
                    setMetricConfig({
                      ...metricConfig,
                      aggregation,
                      worstDirection:
                        aggregation === 'worst'
                          ? (metricConfig.worstDirection ?? 'high')
                          : undefined
                    });
                  }}
                >
                  {AGGREGATION_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <TbChevronDown size={11} />
              </div>

              {metricConfig.aggregation === 'worst' && (
                <div className={styles.selectWrap}>
                  <select
                    className={styles.select}
                    value={metricConfig.worstDirection ?? 'high'}
                    onChange={e =>
                      setMetricConfig({
                        ...metricConfig,
                        worstDirection: e.target.value as 'low' | 'high'
                      })
                    }
                  >
                    <option value="high">High is worse</option>
                    <option value="low">Low is worse</option>
                  </select>
                  <TbChevronDown size={11} />
                </div>
              )}
            </>
          )}
        </div>
      )}

      <MapBreadcrumb rootLabel={rootLabel} stack={focusStack} onNavigate={navigateBreadcrumb} />

      {/* Content */}
      {isUnconfigured ? (
        <EmptyState
          title="Select a schema for Level 1"
          subtitle="Use the controls above to choose which entity types to display at each level."
        />
      ) : (
        <div className={styles.scroll}>
          <div
            className={styles.level1Grid}
            style={{ gridTemplateColumns: `repeat(${cfg.level1Columns}, 1fr)` }}
          >
            {level1Items.map(l1 => {
              const l2Children = cfg.levels >= 2 ? getLevel2Children(l1._uid) : [];
              const schemaEntry = schemaMap.get(l1._schema.id);
              const color = schemaEntry
                ? resolveSchemaColor(schemaEntry.schema, schemaEntry.index)
                : 'var(--accent-fg)';
              const l1Dimmed = linkedEntityIds != null && !linkedEntityIdSet.has(l1._uid);

              return (
                <div
                  key={l1._uid}
                  className={`${styles.level1Box} ${styles.focusable}`}
                  style={boxStyle(l1)}
                  {...focusHandlers(l1)}
                >
                  <div className={styles.levelHeader}>
                    <span className={styles.colorDot} style={{ background: color }} />
                    <EntityTooltip
                      node={l1}
                      color={color}
                      schemaName={schemaEntry?.schema.name ?? l1._schema.name}
                      isLinked={linkedEntityIds == null || linkedEntityIdSet.has(l1._uid)}
                      displayFields={selectedDisplayFields}
                      schemaMap={schemaMap}
                      metricRows={metricRowsFor(l1)}
                    >
                      <button
                        type="button"
                        className={styles.entityLink}
                        onClick={detailClick(l1._publicId)}
                        style={nameStyle(l1, l1Dimmed)}
                      >
                        {nodeName(l1)}
                      </button>
                    </EntityTooltip>
                  </div>

                  {cfg.levels >= 2 && l2Children.length > 0 && (
                    <div
                      className={styles.childGrid}
                      style={{ gridTemplateColumns: `repeat(${cfg.level2Columns}, 1fr)` }}
                    >
                      {l2Children.map(l2 => {
                        const l3Children = cfg.levels >= 3 ? getLevel3Children(l2._uid) : [];
                        const l2SchemaEntry = schemaMap.get(l2._schema.id);
                        const l2Color = l2SchemaEntry
                          ? resolveSchemaColor(l2SchemaEntry.schema, l2SchemaEntry.index)
                          : 'var(--accent-fg)';
                        const l2Dimmed = linkedEntityIds != null && !linkedEntityIdSet.has(l2._uid);

                        return (
                          <div
                            key={l2._uid}
                            className={`${styles.level2Box} ${styles.focusable}`}
                            style={boxStyle(l2)}
                            {...focusHandlers(l2)}
                          >
                            <div className={styles.levelHeader}>
                              <span className={styles.colorDot} style={{ background: l2Color }} />
                              <EntityTooltip
                                node={l2}
                                color={l2Color}
                                schemaName={l2SchemaEntry?.schema.name ?? l2._schema.name}
                                isLinked={linkedEntityIds == null || linkedEntityIdSet.has(l2._uid)}
                                displayFields={selectedDisplayFields}
                                schemaMap={schemaMap}
                                metricRows={metricRowsFor(l2)}
                              >
                                <button
                                  type="button"
                                  className={styles.entityLink}
                                  onClick={detailClick(l2._publicId)}
                                  style={nameStyle(l2, l2Dimmed)}
                                >
                                  {nodeName(l2)}
                                </button>
                              </EntityTooltip>
                            </div>

                            {cfg.levels >= 3 && l3Children.length > 0 && (
                              <div
                                className={styles.childGrid}
                                style={{
                                  gridTemplateColumns: `repeat(${cfg.level3Columns}, 1fr)`
                                }}
                              >
                                {l3Children.map(l3 => {
                                  const l3SchemaEntry = schemaMap.get(l3._schema.id);
                                  const l3Color = l3SchemaEntry
                                    ? resolveSchemaColor(l3SchemaEntry.schema, l3SchemaEntry.index)
                                    : 'var(--accent-fg)';
                                  const l3Dimmed =
                                    linkedEntityIds != null && !linkedEntityIdSet.has(l3._uid);

                                  return (
                                    <div
                                      key={l3._uid}
                                      className={`${styles.level3Box} ${styles.focusable}`}
                                      style={boxStyle(l3)}
                                      {...focusHandlers(l3)}
                                    >
                                      <span
                                        className={styles.colorDot}
                                        style={{ background: l3Color }}
                                      />
                                      <EntityTooltip
                                        node={l3}
                                        color={l3Color}
                                        schemaName={l3SchemaEntry?.schema.name ?? l3._schema.name}
                                        isLinked={
                                          linkedEntityIds == null || linkedEntityIdSet.has(l3._uid)
                                        }
                                        displayFields={selectedDisplayFields}
                                        schemaMap={schemaMap}
                                        metricRows={metricRowsFor(l3)}
                                      >
                                        <button
                                          type="button"
                                          className={styles.entityLink}
                                          onClick={detailClick(l3._publicId)}
                                          style={nameStyle(l3, l3Dimmed)}
                                        >
                                          {nodeName(l3)}
                                        </button>
                                      </EntityTooltip>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {level1Items.length === 0 && (
            <EmptyState
              title="No entities found"
              subtitle={
                currentFocus
                  ? `${currentFocus.name} has no matching descendants at this level.`
                  : 'Try adjusting your search or filters.'
              }
            />
          )}
        </div>
      )}

      {metricConfig && (
        <MapLegend
          metricLabel={metricLabel}
          source={metricConfig.source}
          legend={legend}
          lifecycleStates={lifecycleStates}
        />
      )}
    </div>
  );
};
