import {
  useMemo,
  useCallback,
  useEffect,
  useState,
  type KeyboardEvent,
  type MouseEvent
} from 'react';
import styles from './MapView.module.css';
import { TbChevronDown } from 'react-icons/tb';
import { useWorkspaceContext } from '../../../layouts/WorkspaceContext';
import { resolveSchemaColor } from '../../../lib/schemaPresentation';
import type {
  EntityRecord,
  EntityRelation,
  TreeNode
} from '@arch-register/api-types/entityContract';
import type { RelationSchema } from '@arch-register/api-types/relationSchemaContract';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import type { WorkspaceLifecycleState } from '@arch-register/api-types/workspaceContract';
import type {
  MetricAggregation,
  MetricConfig,
  MetricLegend as MetricLegendData,
  MetricResult
} from '@arch-register/api-types/metricContract';
import { mapViewConfigSchema, type FilterCondition } from '@arch-register/api-types/viewContract';
import type { EntityQuery } from '@arch-register/api-types/entityQueryIR';
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
  getChildRelationSchemas,
  getContainmentChildren,
  getMapTraversalPath,
  getMapSchemaIds,
  sortContainmentNodes
} from './mapViewState';
import type { JoinedAssessmentContext } from './entityFieldSources';
import {
  AGGREGATION_OPTIONS,
  getMetricSourceOptions,
  isCurrencyMetric,
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
import { useFieldGroupAccess } from '../../../auth/useFieldGroupAccess';
import { useMultipleEntityRelations } from '../../../hooks/useEntities';
import { useRelationSchemas } from '../../../hooks/useRelationSchemas';
import { MapLegend } from './MapLegend';
import { MapBreadcrumb, type MapFocusEntry } from './MapBreadcrumb';
import { formatMetricResultValue, formatMetricSourceValue } from './mapMetricFormatting';

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
  conditions?: FilterCondition[];
  entityQuery?: EntityQuery | null;
  onEntityClick: (entityId: string) => void;
  config: unknown;
  onConfigChange: (cfg: MapConfig) => void;
  linkedEntityIds?: string[];
  hideToolbar?: boolean;
  displayFields: EntityDisplayField[];
  lifecycleStates: WorkspaceLifecycleState[];
  joinAssessmentId?: string | null;
  joinedAssessment?: JoinedAssessmentContext | null;
  onCountChange?: (count: number) => void;
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

const nodeName = (n: TreeNode) => n._name ?? n._slug;

type RelationMapNode = TreeNode & { _mapRelation: EntityRelation };

const isRelationMapNode = (node: TreeNode): node is RelationMapNode => '_mapRelation' in node;

const makeRelationMapNode = (
  relation: EntityRelation,
  relationSchema: RelationSchema
): RelationMapNode =>
  ({
    ...relation.relationFields,
    _uid: `relation:${relation.relationId}`,
    _publicId: relation.relationId,
    _schema: { id: relationSchema.id, name: relationSchema.name },
    _name: `${relation.fieldName}: ${relation.entityName}`,
    _slug: relation.relationId,
    _namespace: '',
    _description: '',
    _owner: null,
    _lifecycle: null,
    _targetLifecycle: null,
    _targetLifecycleDate: null,
    _tags: [],
    _links: [],
    _isMatch: true,
    _mapRelation: relation
  }) as unknown as RelationMapNode;

const aggregationLabel = (aggregation: MetricAggregation) =>
  AGGREGATION_OPTIONS.find(o => o.value === aggregation)?.label ?? aggregation;

const metricValueLabel = (
  node: TreeNode,
  isLeaf: boolean,
  metric: MetricConfig | null,
  sourceSchema: EntitySchema | RelationSchema | undefined,
  result: MetricResult | undefined,
  lifecycleStates: WorkspaceLifecycleState[]
): string | null => {
  if (!metric) return null;
  if (
    isLeaf &&
    metric.source.kind === 'field' &&
    node._schema.id === metric.sourceSchemaId &&
    (node as Record<string, unknown>)[metric.source.fieldId] != null
  ) {
    return formatMetricSourceValue(
      metric,
      sourceSchema,
      (node as Record<string, unknown>)[metric.source.fieldId]
    );
  }
  if (!result) return null;
  if (isEnumSource(metric.source)) return result.dominantLabel ?? '—';
  if (metric.source.kind === 'lifecycle') {
    return result.lifecycleId == null
      ? '—'
      : (lifecycleStates.find(state => state.id === result.lifecycleId)?.label ??
          result.lifecycleId);
  }
  return formatMetricResultValue(metric, sourceSchema, result);
};

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
  lifecycleStates: WorkspaceLifecycleState[],
  sourceSchema: EntitySchema | RelationSchema | undefined
): EntityHoverCardRow[] => {
  if (!metric) return [];
  const result = resultsByBoxId.get(node._uid);
  if (!result) {
    if (isRelationMapNode(node) && metric.source.kind === 'field') {
      return [
        {
          label: metricLabel,
          value:
            formatMetricSourceValue(
              metric,
              sourceSchema,
              (node as Record<string, unknown>)[metric.source.fieldId]
            ) ?? '—'
        }
      ];
    }
    return [];
  }

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
      value: formatMetricResultValue(metric, sourceSchema, result)
    });
  }
  rows.push({
    label: 'Coverage',
    value: `${result.populatedCount} of ${result.sourceCount} had data`
  });
  if (result.duplicateCount > 0) {
    rows.push({
      label: 'Duplicates',
      value: `${result.duplicateCount} duplicate path${result.duplicateCount === 1 ? '' : 's'} collapsed`
    });
  }
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

const MetricValueLabel = ({
  node,
  isLeaf,
  metric,
  sourceSchema,
  resultsByBoxId,
  lifecycleStates,
  style
}: {
  node: TreeNode;
  isLeaf: boolean;
  metric: MetricConfig | null;
  sourceSchema: EntitySchema | RelationSchema | undefined;
  resultsByBoxId: Map<string, MetricResult>;
  lifecycleStates: WorkspaceLifecycleState[];
  style?: React.CSSProperties;
}) => {
  const value = metricValueLabel(
    node,
    isLeaf,
    metric,
    sourceSchema,
    resultsByBoxId.get(node._uid),
    lifecycleStates
  );
  if (value == null) return null;
  return (
    <span className={styles.metricValue} style={style}>
      {value}
    </span>
  );
};

const DuplicateBadge = ({ count }: { count: number | undefined }) =>
  count && count > 0 ? (
    <span className={styles.duplicateBadge} title={`${count} duplicate paths collapsed`}>
      Duplicate ×{count}
    </span>
  ) : null;

// ── Config sub-components ─────────────────────────────────────────────────────

const SchemaSelect = ({
  label,
  value,
  options,
  onChange
}: {
  label: string;
  value: string | null;
  options: Array<{ id: string; name: string }>;
  onChange: (id: string | null) => void;
}) => (
  <div className={styles.axisPill}>
    <span className={styles.axisKicker}>{label}</span>
    <div className={styles.selectWrap}>
      <select
        className={styles.select}
        value={value ?? ''}
        onChange={e => onChange(e.target.value ?? null)}
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
  conditions,
  entityQuery,
  onEntityClick,
  config,
  onConfigChange,
  linkedEntityIds,
  hideToolbar,
  displayFields,
  lifecycleStates,
  joinAssessmentId,
  joinedAssessment,
  onCountChange
}: MapViewProps) => {
  const { schemas, currencies } = useWorkspaceContext();
  const { data: relationSchemas = [] } = useRelationSchemas(workspaceId);
  const cfg = useMemo(
    () => normalizeViewConfig(mapViewConfigSchema, config, DEFAULT_CONFIG),
    [config]
  );
  const schemaIds = useMemo(
    () =>
      getMapSchemaIds(cfg).flatMap(id => {
        if (schemas.some(schema => schema.id === id)) return [id];
        const relationSchema = relationSchemas.find(schema => schema.id === id);
        return relationSchema
          ? [...relationSchema.in.schemaIds, ...relationSchema.out.schemaIds]
          : [];
      }),
    [cfg, relationSchemas, schemas]
  );
  const { treeNodes: nodes, treeEdges: edges } = useEntityBrowserTreeData({
    workspaceId,
    projectId,
    projectScope,
    q,
    typeFilter,
    ownerFilter,
    statusFilter,
    schemaIds
  });
  const nodeIds = useMemo(() => nodes.map(node => node._uid), [nodes]);
  const entityRelations = useMultipleEntityRelations(workspaceId, nodeIds);
  useEffect(() => {
    onCountChange?.(nodes.filter(node => node._isMatch).length);
  }, [nodes, onCountChange]);
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
    () => getChildSchemas(schemas, cfg.level1SchemaId, relationSchemas),
    [schemas, cfg.level1SchemaId, relationSchemas]
  );

  const level3SchemaOptions = useMemo(
    () => [
      ...getChildSchemas(schemas, cfg.level2SchemaId ?? null, relationSchemas),
      ...getChildRelationSchemas(schemas, cfg.level2SchemaId ?? null, relationSchemas)
    ],
    [schemas, cfg.level2SchemaId, relationSchemas]
  );

  const treeIndex = useMemo(() => buildContainmentTreeIndex(nodes, edges), [nodes, edges]);

  const getRelationMapChildren = useCallback(
    (parentUid: string, relationSchemaId: string): RelationMapNode[] => {
      const relationSchema = relationSchemas.find(schema => schema.id === relationSchemaId);
      if (!relationSchema) return [];
      const relationData = entityRelations.get(parentUid);
      const unique = new Map<string, RelationMapNode>();
      for (const relation of [
        ...(relationData?.outgoing ?? []),
        ...(relationData?.incoming ?? [])
      ]) {
        if (relation.kind !== 'typed' || relation.relationSchemaId !== relationSchemaId) continue;
        if (!relation.relationId || !treeIndex.nodeMap.get(relation.entityId)?._isMatch) continue;
        unique.set(relation.relationId, makeRelationMapNode(relation, relationSchema));
      }
      return [...unique.values()].sort((a, b) => nodeName(a).localeCompare(nodeName(b)));
    },
    [entityRelations, relationSchemas, treeIndex]
  );

  const getMapChildren = useCallback(
    (parentUid: string, schemaId: string | null): TreeNode[] => {
      if (!schemaId) return [];
      const containmentChildren = getContainmentChildren(parentUid, schemaId, treeIndex);
      const relationData = entityRelations.get(parentUid);
      const relatedIds = [...(relationData?.outgoing ?? []), ...(relationData?.incoming ?? [])]
        .filter(relation => relation.kind === 'typed' && relation.entitySchemaId === schemaId)
        .map(relation => relation.entityId);
      const relatedChildren = relatedIds
        .map(id => treeIndex.nodeMap.get(id))
        .filter((node): node is TreeNode => node?._isMatch === true);
      const unique = new Map<string, TreeNode>();
      for (const node of [...containmentChildren, ...relatedChildren]) unique.set(node._uid, node);
      return [...unique.values()].sort((a, b) => nodeName(a).localeCompare(nodeName(b)));
    },
    [entityRelations, treeIndex]
  );

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
      return getMapChildren(parentUid, cfg.level2SchemaId);
    },
    [cfg.level2SchemaId, getMapChildren]
  );

  const getLevel3Children = useCallback(
    (parentUid: string): TreeNode[] => {
      if (!cfg.level3SchemaId) return [];
      if (relationSchemas.some(schema => schema.id === cfg.level3SchemaId)) {
        return getRelationMapChildren(parentUid, cfg.level3SchemaId);
      }
      return getMapChildren(parentUid, cfg.level3SchemaId);
    },
    [cfg.level3SchemaId, getMapChildren, getRelationMapChildren, relationSchemas]
  );

  const schemaMap = useMemo(() => {
    const m = new Map<string, { schema: EntitySchema; index: number }>();
    schemas.forEach((s, i) => m.set(s.id, { schema: s, index: i }));
    return m;
  }, [schemas]);

  // ── Metric configuration ─────────────────────────────────────────────────

  const mapLevelSchemaIds = useMemo(
    () =>
      [cfg.level1SchemaId, cfg.level2SchemaId, cfg.level3SchemaId]
        .slice(0, cfg.levels)
        .filter((id): id is string => id != null),
    [cfg.level1SchemaId, cfg.level2SchemaId, cfg.level3SchemaId, cfg.levels]
  );
  const mapTraversalPath = useMemo(
    () => getMapTraversalPath(mapLevelSchemaIds, schemas, relationSchemas),
    [mapLevelSchemaIds, schemas, relationSchemas]
  );
  const metricTerminalSchemaId = mapLevelSchemaIds[mapLevelSchemaIds.length - 1] ?? null;
  const metricTerminalEntitySchema = metricTerminalSchemaId
    ? schemaMap.get(metricTerminalSchemaId)?.schema
    : undefined;
  const metricTerminalRelationSchema = relationSchemas.find(
    schema => schema.id === metricTerminalSchemaId
  );
  const metricTerminalSchema = metricTerminalEntitySchema ?? metricTerminalRelationSchema;
  const metricTerminalContext: 'entity' | 'relation' = metricTerminalRelationSchema
    ? 'relation'
    : 'entity';
  const storedMetricConfig = useMemo(() => parseMetricConfig(cfg.metricConfig), [cfg.metricConfig]);
  const metricConfig = storedMetricConfig
    ? {
        ...storedMetricConfig,
        sourceSchemaId: metricTerminalSchemaId ?? storedMetricConfig.sourceSchemaId,
        sourceContext: metricTerminalContext,
        path: mapTraversalPath.length > 0 ? mapTraversalPath : undefined
      }
    : null;
  const metricSourceSchema = metricTerminalSchema;
  const getFieldGroupAccess = useFieldGroupAccess(workspaceId);
  const metricSourceOptions = useMemo(
    () =>
      getMetricSourceOptions(
        metricSourceSchema,
        joinedAssessment,
        getFieldGroupAccess,
        metricTerminalContext
      ),
    [metricSourceSchema, joinedAssessment, getFieldGroupAccess, metricTerminalContext]
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
        for (const l3 of getLevel3Children(l2._uid)) {
          if (!isRelationMapNode(l3)) ids.push(l3._uid);
        }
      }
    }
    return ids;
  }, [level1Items, cfg.levels, getLevel2Children, getLevel3Children]);

  const {
    resultsByBoxId,
    legend,
    error: metricError
  } = useMapMetricRollup({
    workspaceId,
    boxEntityIds: visibleBoxIds,
    metric: metricConfig,
    schemaId: typeFilter,
    owner: ownerFilter,
    lifecycle: statusFilter,
    q,
    conditions,
    entityQuery,
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
      buildMetricRows(
        node,
        metricConfig,
        metricLabel,
        resultsByBoxId,
        lifecycleStates,
        metricSourceSchema
      ),
    [metricConfig, metricLabel, resultsByBoxId, lifecycleStates, metricSourceSchema]
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

  const rootLabel = (cfg.level1SchemaId && schemaMap.get(cfg.level1SchemaId)?.schema.name) ?? 'Map';

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
            <span className={styles.pathSummary}>
              {metricTerminalSchema?.name ?? 'Select the final map level'}
            </span>
            <div className={styles.selectWrap}>
              <select
                className={styles.select}
                value={metricConfig ? sourceKey(metricConfig.source) : ''}
                onChange={e => {
                  const option = metricSourceOptions.find(
                    candidate => sourceKey(candidate.source) === e.target.value
                  );
                  if (!option || !metricTerminalSchemaId) {
                    setMetricConfig(null);
                    return;
                  }
                  const nextIsEnum = isEnumSource(option.source);
                  setMetricConfig({
                    ...(metricConfig ?? {
                      sourceSchemaId: metricTerminalSchemaId,
                      source: option.source,
                      aggregation: 'count'
                    }),
                    sourceSchemaId: metricTerminalSchemaId,
                    sourceContext: metricTerminalContext,
                    path: mapTraversalPath.length > 0 ? mapTraversalPath : undefined,
                    source: option.source,
                    aggregation: nextIsEnum ? 'count' : (metricConfig?.aggregation ?? 'count'),
                    worstDirection: nextIsEnum ? undefined : metricConfig?.worstDirection,
                    targetCurrency: undefined
                  });
                }}
              >
                <option value="">None</option>
                {metricSourceOptions.map(option => (
                  <option key={sourceKey(option.source)} value={sourceKey(option.source)}>
                    {option.label}
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
                  value={metricConfig.aggregation}
                  onChange={e => {
                    const aggregation = e.target.value as MetricAggregation;
                    setMetricConfig({
                      ...metricConfig,
                      aggregation,
                      worstDirection:
                        aggregation === 'worst'
                          ? (metricConfig.worstDirection ?? 'high')
                          : undefined,
                      targetCurrency:
                        aggregation === 'count' ? undefined : metricConfig.targetCurrency
                    });
                  }}
                >
                  {(isEnumSource(metricConfig.source)
                    ? AGGREGATION_OPTIONS.filter(o => o.value === 'count' || o.value === 'worst')
                    : AGGREGATION_OPTIONS
                  ).map(o => (
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
                    {isEnumSource(metricConfig.source) ? (
                      <>
                        <option value="high">Last option is worst</option>
                        <option value="low">First option is worst</option>
                      </>
                    ) : (
                      <>
                        <option value="high">High is worse</option>
                        <option value="low">Low is worse</option>
                      </>
                    )}
                  </select>
                  <TbChevronDown size={11} />
                </div>
              )}

              {isCurrencyMetric(metricConfig, metricSourceSchema) && (
                <div className={styles.selectWrap}>
                  <select
                    className={styles.select}
                    value={metricConfig.targetCurrency ?? currencies.default_currency}
                    onChange={e =>
                      setMetricConfig({
                        ...metricConfig,
                        targetCurrency: e.target.value
                      })
                    }
                  >
                    {currencies.currencies.map(currency => (
                      <option key={currency.code} value={currency.code}>
                        {currency.code} — {currency.label}
                      </option>
                    ))}
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
                    <MetricValueLabel
                      node={l1}
                      isLeaf={cfg.levels < 2 || l2Children.length === 0}
                      metric={metricConfig}
                      sourceSchema={metricSourceSchema}
                      resultsByBoxId={resultsByBoxId}
                      lifecycleStates={lifecycleStates}
                      style={nameStyle(l1, l1Dimmed)}
                    />
                    <DuplicateBadge count={resultsByBoxId.get(l1._uid)?.duplicateCount} />
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
                              <MetricValueLabel
                                node={l2}
                                isLeaf={cfg.levels < 3 || l3Children.length === 0}
                                metric={metricConfig}
                                sourceSchema={metricSourceSchema}
                                resultsByBoxId={resultsByBoxId}
                                lifecycleStates={lifecycleStates}
                                style={nameStyle(l2, l2Dimmed)}
                              />
                              <DuplicateBadge count={resultsByBoxId.get(l2._uid)?.duplicateCount} />
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
                                  const l3RelationSchema = relationSchemas.find(
                                    schema => schema.id === l3._schema.id
                                  );
                                  const l3Color = l3SchemaEntry
                                    ? resolveSchemaColor(l3SchemaEntry.schema, l3SchemaEntry.index)
                                    : (l3RelationSchema?.color ?? 'var(--accent-fg)');
                                  const l3LinkId = isRelationMapNode(l3)
                                    ? l3._mapRelation.entityId
                                    : l3._uid;
                                  const l3Dimmed =
                                    linkedEntityIds != null && !linkedEntityIdSet.has(l3LinkId);

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
                                        schemaName={
                                          l3SchemaEntry?.schema.name ??
                                          l3RelationSchema?.name ??
                                          l3._schema.name
                                        }
                                        isLinked={
                                          linkedEntityIds == null || linkedEntityIdSet.has(l3LinkId)
                                        }
                                        displayFields={selectedDisplayFields}
                                        schemaMap={schemaMap}
                                        metricRows={metricRowsFor(l3)}
                                      >
                                        <button
                                          type="button"
                                          className={styles.entityLink}
                                          onClick={detailClick(
                                            isRelationMapNode(l3)
                                              ? l3._mapRelation.entityId
                                              : l3._publicId
                                          )}
                                          style={nameStyle(l3, l3Dimmed)}
                                        >
                                          {nodeName(l3)}
                                        </button>
                                      </EntityTooltip>
                                      <MetricValueLabel
                                        node={l3}
                                        isLeaf
                                        metric={metricConfig}
                                        sourceSchema={metricSourceSchema}
                                        resultsByBoxId={resultsByBoxId}
                                        lifecycleStates={lifecycleStates}
                                        style={nameStyle(l3, l3Dimmed)}
                                      />
                                      <DuplicateBadge
                                        count={resultsByBoxId.get(l3._uid)?.duplicateCount}
                                      />
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

      {metricConfig &&
        (metricError ? (
          <div className={styles.metricError}>{metricError.message}</div>
        ) : (
          <MapLegend
            metricLabel={metricLabel}
            source={metricConfig.source}
            legend={legend}
            lifecycleStates={lifecycleStates}
          />
        ))}
    </div>
  );
};
