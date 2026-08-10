import {
  useMemo,
  useCallback,
  useEffect,
  useRef,
  type KeyboardEvent,
  type MouseEvent
} from 'react';
import styles from './MapView.module.css';
import { TbChevronDown, TbEyeOff, TbTrash } from 'react-icons/tb';
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
  getChildLevelOptions,
  getContainmentChildren,
  getMapTraversalPath,
  getMapSchemaIds,
  type MapLevelConfig,
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
import { Popover, type PopoverActions } from '@diagram-craft/app-components/Popover';
import { Button } from '@diagram-craft/app-components/Button';
import { FilterBuilder } from '../../../components/FilterBuilder';
import { useWorkspaceAuthorization } from '../../../auth/WorkspaceAuthorizationContext';
import { useMultipleEntityRelations } from '../../../hooks/useEntities';
import { useRelationSchemas } from '../../../hooks/useRelationSchemas';
import { MapLegend } from './MapLegend';
import { formatMetricResultValue, formatMetricSourceValue } from './mapMetricFormatting';

// ── Types ─────────────────────────────────────────────────────────────────────

export type MapConfig = {
  levelConfigs: MapLevelConfig[];
  hideMissingMetricData?: boolean;
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
  levelConfigs: [
    { schemaId: null, columns: 3 },
    { schemaId: null, columns: 3 }
  ],
  fieldIds: undefined,
  metricConfig: undefined,
  hideMissingMetricData: undefined
};

const legacyMapConfigDefaults = {
  ...DEFAULT_CONFIG,
  levels: 2,
  level1SchemaId: null as string | null,
  level1Columns: 3,
  level2SchemaId: null as string | null,
  level2Columns: 3,
  level3SchemaId: null as string | null,
  level3Columns: 3,
  levelConfigs: undefined as MapLevelConfig[] | undefined
};

const normalizeMapConfig = (raw: unknown): MapConfig => {
  const parsed = normalizeViewConfig(mapViewConfigSchema, raw, legacyMapConfigDefaults);
  if (parsed.levelConfigs?.length) {
    return {
      levelConfigs: parsed.levelConfigs.map(level => ({
        schemaId: level.schemaId,
        columns: level.columns ?? 3,
        ...(level.hidden ? { hidden: true } : {})
      })),
      fieldIds: parsed.fieldIds,
      metricConfig: parsed.metricConfig,
      hideMissingMetricData: parsed.hideMissingMetricData
    };
  }
  const legacyIds = [parsed.level1SchemaId, parsed.level2SchemaId, parsed.level3SchemaId];
  const legacyColumns = [parsed.level1Columns, parsed.level2Columns, parsed.level3Columns];
  return {
    levelConfigs: legacyIds.slice(0, parsed.levels).map((schemaId, index) => ({
      schemaId,
      columns: legacyColumns[index] ?? 3
    })),
    fieldIds: parsed.fieldIds,
    metricConfig: parsed.metricConfig,
    hideMissingMetricData: parsed.hideMissingMetricData
  };
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
  if (metric.aggregation === 'percentage') {
    return result ? formatMetricResultValue(metric, sourceSchema, result) : null;
  }
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
  lifecycleStates: WorkspaceLifecycleState[],
  sourceSchema: EntitySchema | RelationSchema | undefined,
  isLeaf: boolean,
  directMetricRange: { min: number | null; max: number | null }
): string | null => {
  if (!metric) return null;
  const result = resultsByBoxId.get(node._uid);
  const directValue = getDirectMetricValue(node, metric, sourceSchema, isLeaf);
  const colorMin = legend.min ?? directMetricRange.min;
  const colorMax = legend.max ?? directMetricRange.max;

  if (metric.aggregation === 'percentage') {
    if (!result || result.value == null || legend.min == null || legend.max == null) {
      return NEUTRAL_MISSING_COLOR;
    }
    return numericColor(result.value, legend.min, legend.max);
  }

  if (
    !result ||
    result.value == null ||
    (isEnumSource(metric.source) && result.dominantValue == null)
  ) {
    if (directValue?.kind === 'number' && colorMin != null && colorMax != null) {
      return numericColor(directValue.value, colorMin, colorMax);
    }
    if (directValue?.kind === 'enum') {
      const index = (legend.categories ?? []).findIndex(
        category => category.value === directValue.value
      );
      return categoricalColor(index === -1 ? Number.MAX_SAFE_INTEGER : index);
    }
    if (directValue?.kind === 'lifecycle') {
      return (
        lifecycleStates.find(state => state.id === directValue.value)?.color ??
        NEUTRAL_MISSING_COLOR
      );
    }
    return NEUTRAL_MISSING_COLOR;
  }

  if (isEnumSource(metric.source)) {
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

type DirectMetricValue =
  | { kind: 'number'; value: number }
  | { kind: 'enum'; value: string }
  | { kind: 'lifecycle'; value: string };

const getDirectMetricValue = (
  node: TreeNode,
  metric: MetricConfig,
  sourceSchema: EntitySchema | RelationSchema | undefined,
  isLeaf: boolean
): DirectMetricValue | null => {
  if (metric.aggregation === 'percentage') return null;
  if (!isLeaf || node._schema.id !== metric.sourceSchemaId) return null;
  const record = node as Record<string, unknown>;
  if (metric.source.kind === 'enum') {
    const raw = record[metric.source.fieldId];
    if (raw == null || raw === '') return null;
    return { kind: 'enum', value: String(raw) };
  }
  if (metric.source.kind === 'field') {
    const fieldId = metric.source.fieldId;
    const raw = record[fieldId];
    if (raw == null || raw === '') return null;
    const field = sourceSchema?.fields.find(candidate => candidate.id === fieldId);
    if (field?.type === 'currency' && typeof raw === 'object' && raw !== null) {
      const amount = (raw as { amount?: unknown }).amount;
      return typeof amount === 'number' ? { kind: 'number', value: amount } : null;
    }
    const value = Number(raw);
    return Number.isFinite(value) ? { kind: 'number', value } : null;
  }
  if (metric.source.kind === 'lifecycle') {
    const lifecycle = node._lifecycle;
    const value = typeof lifecycle === 'string' ? lifecycle : lifecycle?.id;
    return value ? { kind: 'lifecycle', value } : null;
  }
  return null;
};

const hasMissingMetricData = (metric: MetricConfig, result: MetricResult | undefined): boolean => {
  if (!result) return true;
  if (result.sourceCount === 0) return true;
  if (metric.aggregation === 'percentage') return result.value == null;
  return isEnumSource(metric.source) ? result.dominantValue == null : result.value == null;
};

/** Extra hover-card rows describing the metric result: value, enum distribution, coverage. */
const buildMetricRows = (
  node: TreeNode,
  isLeaf: boolean,
  metric: MetricConfig | null,
  metricLabel: string,
  metricSourceLabel: string,
  resultsByBoxId: Map<string, MetricResult>,
  lifecycleStates: WorkspaceLifecycleState[],
  sourceSchema: EntitySchema | RelationSchema | undefined
): EntityHoverCardRow[] => {
  if (!metric) return [];
  const result = resultsByBoxId.get(node._uid);
  const directSourceNode = isLeaf || isRelationMapNode(node);
  if (
    directSourceNode &&
    hasMissingMetricData(metric, result) &&
    getDirectMetricValue(node, metric, sourceSchema, true) != null
  ) {
    let value: string | null = null;
    if (metric.source.kind === 'field' || metric.source.kind === 'enum') {
      const raw = (node as Record<string, unknown>)[metric.source.fieldId];
      value =
        metric.source.kind === 'field'
          ? formatMetricSourceValue(metric, sourceSchema, raw)
          : String(raw);
    } else if (metric.source.kind === 'lifecycle') {
      const lifecycle = node._lifecycle;
      const lifecycleId = typeof lifecycle === 'string' ? lifecycle : lifecycle?.id;
      value =
        lifecycleId == null
          ? null
          : (lifecycleStates.find(state => state.id === lifecycleId)?.label ?? lifecycleId);
    }
    return [{ label: `${metricSourceLabel} (source)`, value: value ?? '—' }];
  }
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
  if (metric.aggregation !== 'percentage' && isEnumSource(metric.source)) {
    rows.push({ label: metricLabel, value: result.dominantLabel ?? '—' });
    if (result.distribution.length > 0) {
      rows.push({
        label: 'Distribution',
        value: result.distribution.map(d => `${d.label}: ${d.count}`).join(', ')
      });
    }
  } else if (
    metric.aggregation !== 'percentage' &&
    metric.source.kind === 'lifecycle' &&
    result.lifecycleId != null
  ) {
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
  const { schemas, currencies, enums, teams } = useWorkspaceContext();
  const { data: relationSchemas = [] } = useRelationSchemas(workspaceId);
  const cfg = useMemo(() => normalizeMapConfig(config), [config]);
  const schemaIds = useMemo(
    () =>
      getMapSchemaIds(cfg).flatMap(id => {
        if (schemas.some(schema => schema.id === id)) return [id];
        const relationSchema = relationSchemas.find(schema => schema.id === id);
        if (!relationSchema) return [];
        return [
          ...(relationSchema.in.schemaIds === 'any'
            ? schemas.map(schema => schema.id)
            : relationSchema.in.schemaIds),
          ...(relationSchema.out.schemaIds === 'any'
            ? schemas.map(schema => schema.id)
            : relationSchema.out.schemaIds)
        ];
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

  const rootSchemaId = cfg.levelConfigs[0]?.schemaId ?? null;

  const levelSchemaOptions = useMemo(
    () =>
      cfg.levelConfigs.map((_, index) =>
        index === 0
          ? schemas
          : getChildLevelOptions(
              schemas,
              cfg.levelConfigs[index - 1]?.schemaId ?? null,
              relationSchemas
            )
      ),
    [cfg.levelConfigs, relationSchemas, schemas]
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
    return sortContainmentNodes(nodes, rootSchemaId);
  }, [nodes, rootSchemaId]);

  const getMapChildrenForNode = useCallback(
    (parent: TreeNode, schemaId: string | null): TreeNode[] => {
      if (!schemaId) return [];
      if (isRelationMapNode(parent)) {
        const endpoint = treeIndex.nodeMap.get(parent._mapRelation.entityId);
        if (endpoint?._schema.id === schemaId) return [endpoint];
      }
      const parentUid = isRelationMapNode(parent) ? parent._mapRelation.entityId : parent._uid;
      if (relationSchemas.some(schema => schema.id === schemaId)) {
        return getRelationMapChildren(parentUid, schemaId);
      }
      return getMapChildren(parentUid, schemaId);
    },
    [getMapChildren, getRelationMapChildren, relationSchemas, treeIndex]
  );

  const schemaMap = useMemo(() => {
    const m = new Map<string, { schema: EntitySchema; index: number }>();
    schemas.forEach((s, i) => m.set(s.id, { schema: s, index: i }));
    return m;
  }, [schemas]);

  // ── Metric configuration ─────────────────────────────────────────────────

  const mapLevelSchemaIds = useMemo(
    () => cfg.levelConfigs.map(level => level.schemaId).filter((id): id is string => id != null),
    [cfg.levelConfigs]
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
  const { getFieldGroupAccess } = useWorkspaceAuthorization(workspaceId);
  const numeratorConditionPopoverRef = useRef<PopoverActions | null>(null);
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

  type RenderTreeNode = { node: TreeNode; levelIndex: number; children: RenderTreeNode[] };
  const renderTree = useMemo(() => {
    const build = (node: TreeNode, levelIndex: number): RenderTreeNode => ({
      node,
      levelIndex,
      children:
        levelIndex + 1 < cfg.levelConfigs.length
          ? getMapChildrenForNode(node, cfg.levelConfigs[levelIndex + 1]?.schemaId ?? null).map(
              child => build(child, levelIndex + 1)
            )
          : []
    });
    return level1Items.map(node => build(node, 0));
  }, [cfg.levelConfigs, getMapChildrenForNode, level1Items]);

  const directMetricRange = useMemo(() => {
    if (!metricConfig || !metricSourceSchema) return { min: null, max: null };
    const values: number[] = [];
    const collect = (entry: RenderTreeNode) => {
      const directValue = getDirectMetricValue(
        entry.node,
        metricConfig,
        metricSourceSchema,
        entry.children.length === 0
      );
      if (directValue?.kind === 'number') values.push(directValue.value);
      entry.children.forEach(collect);
    };
    renderTree.forEach(collect);
    return {
      min: values.length > 0 ? Math.min(...values) : null,
      max: values.length > 0 ? Math.max(...values) : null
    };
  }, [metricConfig, metricSourceSchema, renderTree]);

  const visibleBoxIds = useMemo(() => {
    const ids: string[] = [];
    const collect = (entry: RenderTreeNode) => {
      const level = cfg.levelConfigs[entry.levelIndex];
      if (!isRelationMapNode(entry.node) && (entry.levelIndex === 0 || !level?.hidden)) {
        ids.push(entry.node._uid);
      }
      entry.children.forEach(collect);
    };
    renderTree.forEach(collect);
    return ids;
  }, [cfg.levelConfigs, renderTree]);

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

  const filteredRenderTree = useMemo(() => {
    if (!metricConfig || !cfg.hideMissingMetricData) {
      return renderTree;
    }
    const filter = (entry: RenderTreeNode): RenderTreeNode | null => {
      if (!isRelationMapNode(entry.node)) {
        const result = resultsByBoxId.get(entry.node._uid);
        if (hasMissingMetricData(metricConfig, result)) return null;
      }
      return {
        ...entry,
        children: entry.children
          .map(filter)
          .filter((child): child is RenderTreeNode => child !== null)
      };
    };
    return renderTree.map(filter).filter((entry): entry is RenderTreeNode => entry !== null);
  }, [cfg.hideMissingMetricData, metricConfig, renderTree, resultsByBoxId]);

  const boxStyle = useCallback(
    (node: TreeNode, isLeaf: boolean): React.CSSProperties | undefined => {
      const color = resolveBoxColor(
        node,
        metricConfig,
        resultsByBoxId,
        legend,
        lifecycleStates,
        metricSourceSchema,
        isLeaf,
        directMetricRange
      );
      if (!color) return undefined;
      return { background: color };
    },
    [metricConfig, resultsByBoxId, legend, lifecycleStates, metricSourceSchema, directMetricRange]
  );

  const nameStyle = useCallback(
    (node: TreeNode, dimmed: boolean, isLeaf: boolean): React.CSSProperties | undefined => {
      if (dimmed) return { color: 'var(--base-fg-more-dim)' };
      const color = resolveBoxColor(
        node,
        metricConfig,
        resultsByBoxId,
        legend,
        lifecycleStates,
        metricSourceSchema,
        isLeaf,
        directMetricRange
      );
      return color ? { color: textColorForFill(color) } : undefined;
    },
    [metricConfig, resultsByBoxId, legend, lifecycleStates, metricSourceSchema, directMetricRange]
  );

  const metricRowsFor = useCallback(
    (node: TreeNode, isLeaf: boolean): EntityHoverCardRow[] =>
      buildMetricRows(
        node,
        isLeaf,
        metricConfig,
        metricLabel,
        activeSourceOption?.label ?? metricConfig?.source.kind ?? '',
        resultsByBoxId,
        lifecycleStates,
        metricSourceSchema
      ),
    [
      metricConfig,
      metricLabel,
      activeSourceOption?.label,
      resultsByBoxId,
      lifecycleStates,
      metricSourceSchema
    ]
  );

  const boxHandlers = useCallback(
    (node: TreeNode) => ({
      role: 'button' as const,
      tabIndex: 0,
      onClick: () =>
        onEntityClick(isRelationMapNode(node) ? node._mapRelation.entityId : node._publicId),
      onKeyDown: (e: KeyboardEvent<HTMLDivElement>) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onEntityClick(isRelationMapNode(node) ? node._mapRelation.entityId : node._publicId);
        }
      }
    }),
    [onEntityClick]
  );

  const detailClick = useCallback(
    (publicId: string) => (e: MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      onEntityClick(publicId);
    },
    [onEntityClick]
  );

  const isUnconfigured = !rootSchemaId;

  return (
    <div className={styles.wrap}>
      {/* Config bar */}
      {!hideToolbar && (
        <div className={styles.config}>
          {cfg.levelConfigs.map((level, index) => (
            <div key={index} className={styles.levelControl}>
              {index > 0 && <span className={styles.cross}>›</span>}
              <SchemaSelect
                label={`L${index + 1}`}
                value={level.schemaId}
                options={levelSchemaOptions[index] ?? []}
                onChange={id => {
                  const nextLevels = cfg.levelConfigs
                    .slice(0, index + 1)
                    .map((candidate, candidateIndex) =>
                      candidateIndex === index ? { ...candidate, schemaId: id } : candidate
                    );
                  notify({ levelConfigs: nextLevels });
                }}
              />
              <ColsSelect
                value={level.columns}
                onChange={columns => {
                  const nextLevels = cfg.levelConfigs.map((candidate, candidateIndex) =>
                    candidateIndex === index ? { ...candidate, columns } : candidate
                  );
                  notify({ levelConfigs: nextLevels });
                }}
              />
              {index > 0 && (
                <>
                  <button
                    type="button"
                    className={`${styles.levelAction} ${level.hidden ? styles.levelHidden : ''}`}
                    aria-label={`${level.hidden ? 'Show' : 'Hide'} level ${index + 1}`}
                    aria-pressed={level.hidden === true}
                    title={`${level.hidden ? 'Show' : 'Hide'} level ${index + 1}`}
                    onClick={() => {
                      const nextLevels = cfg.levelConfigs.map((candidate, candidateIndex) =>
                        candidateIndex === index
                          ? { ...candidate, hidden: candidate.hidden !== true }
                          : candidate
                      );
                      notify({ levelConfigs: nextLevels });
                    }}
                  >
                    <TbEyeOff size={13} />
                  </button>
                  {index === cfg.levelConfigs.length - 1 && (
                    <button
                      type="button"
                      className={styles.levelAction}
                      aria-label={`Remove level ${index + 1}`}
                      onClick={() =>
                        notify({
                          levelConfigs: cfg.levelConfigs.filter(
                            (_, candidateIndex) => candidateIndex !== index
                          )
                        })
                      }
                    >
                      <TbTrash size={13} />
                    </button>
                  )}
                </>
              )}
            </div>
          ))}
          {cfg.levelConfigs.at(-1)?.schemaId && <span className={styles.cross}>›</span>}
          <button
            type="button"
            className={styles.levelAction}
            disabled={!cfg.levelConfigs.at(-1)?.schemaId}
            onClick={() =>
              notify({
                levelConfigs: [...cfg.levelConfigs, { schemaId: null, columns: 3, hidden: false }]
              })
            }
          >
            + Add level
          </button>
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
                        aggregation === 'count' || aggregation === 'percentage'
                          ? undefined
                          : metricConfig.targetCurrency,
                      numeratorCondition:
                        aggregation === 'percentage' ? metricConfig.numeratorCondition : undefined
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

              {metricConfig.aggregation === 'percentage' && metricTerminalEntitySchema && (
                <Popover.Root actionsRef={numeratorConditionPopoverRef}>
                  <Popover.Trigger
                    element={
                      <Button
                        size="sm"
                        variant={metricConfig.numeratorCondition ? 'primary' : 'secondary'}
                      >
                        {metricConfig.numeratorCondition ? 'Numerator: 1 condition' : 'Numerator…'}
                      </Button>
                    }
                  />
                  <Popover.Content sideOffset={4} align="start" arrow={false} closeButton={false}>
                    <FilterBuilder
                      conditions={
                        metricConfig.numeratorCondition ? [metricConfig.numeratorCondition] : []
                      }
                      onChange={conditions =>
                        setMetricConfig({
                          ...metricConfig,
                          numeratorCondition: conditions[conditions.length - 1]
                        })
                      }
                      onClose={() => numeratorConditionPopoverRef.current?.close()}
                      schemas={[metricTerminalEntitySchema]}
                      lifecycleStates={lifecycleStates}
                      owners={teams}
                      enums={enums}
                      selectedSchemaId={metricTerminalEntitySchema.id}
                      getFieldGroupAccess={getFieldGroupAccess}
                    />
                  </Popover.Content>
                </Popover.Root>
              )}

              <label className={styles.metricToggle}>
                <input
                  type="checkbox"
                  checked={cfg.hideMissingMetricData === true}
                  onChange={e => notify({ hideMissingMetricData: e.target.checked })}
                />
                Hide missing
              </label>
            </>
          )}
        </div>
      )}

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
            style={{
              gridTemplateColumns: `repeat(${cfg.levelConfigs[0]?.columns ?? 3}, 1fr)`
            }}
          >
            {filteredRenderTree.map(entry => {
              const renderEntry = (treeEntry: RenderTreeNode): React.ReactNode => {
                const { node, levelIndex, children } = treeEntry;
                const level = cfg.levelConfigs[levelIndex] ?? { schemaId: null, columns: 3 };
                const entitySchema = schemaMap.get(node._schema.id);
                const relationSchema = relationSchemas.find(
                  candidate => candidate.id === node._schema.id
                );
                const color = entitySchema
                  ? resolveSchemaColor(entitySchema.schema, entitySchema.index)
                  : (relationSchema?.color ?? 'var(--accent-fg)');
                const linkedId = isRelationMapNode(node) ? node._mapRelation.entityId : node._uid;
                const dimmed = linkedEntityIds != null && !linkedEntityIdSet.has(linkedId);
                const childContent =
                  children.length > 0 ? (
                    <div
                      className={styles.childGrid}
                      style={{
                        gridTemplateColumns: `repeat(${cfg.levelConfigs[levelIndex + 1]?.columns ?? 3}, 1fr)`
                      }}
                    >
                      {children.map(renderEntry)}
                    </div>
                  ) : null;

                if (levelIndex > 0 && level.hidden) return childContent;

                const className =
                  levelIndex === 0
                    ? styles.level1Box
                    : levelIndex === 1
                      ? styles.level2Box
                      : styles.level3Box;
                return (
                  <div
                    key={node._uid}
                    className={`${className} ${styles.focusable}`}
                    style={boxStyle(node, children.length === 0)}
                    {...boxHandlers(node)}
                  >
                    <div className={styles.levelHeader}>
                      <span className={styles.colorDot} style={{ background: color }} />
                      <EntityTooltip
                        node={node}
                        color={color}
                        schemaName={
                          entitySchema?.schema.name ?? relationSchema?.name ?? node._schema.name
                        }
                        isLinked={linkedEntityIds == null || linkedEntityIdSet.has(linkedId)}
                        displayFields={selectedDisplayFields}
                        schemaMap={schemaMap}
                        metricRows={metricRowsFor(node, children.length === 0)}
                      >
                        <button
                          type="button"
                          className={styles.entityLink}
                          onClick={detailClick(
                            isRelationMapNode(node) ? node._mapRelation.entityId : node._publicId
                          )}
                          style={nameStyle(node, dimmed, children.length === 0)}
                        >
                          {nodeName(node)}
                        </button>
                      </EntityTooltip>
                      <MetricValueLabel
                        node={node}
                        isLeaf={children.length === 0}
                        metric={metricConfig}
                        sourceSchema={metricSourceSchema}
                        resultsByBoxId={resultsByBoxId}
                        lifecycleStates={lifecycleStates}
                        style={nameStyle(node, dimmed, children.length === 0)}
                      />
                      <DuplicateBadge count={resultsByBoxId.get(node._uid)?.duplicateCount} />
                    </div>
                    {childContent}
                  </div>
                );
              };
              return renderEntry(entry);
            })}
          </div>

          {filteredRenderTree.length === 0 && (
            <EmptyState
              title={
                level1Items.length === 0 ? 'No entities found' : 'No boxes match the metric filters'
              }
              subtitle="Try adjusting your search or filters."
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
            aggregation={metricConfig.aggregation}
            legend={legend}
            lifecycleStates={lifecycleStates}
          />
        ))}
    </div>
  );
};
