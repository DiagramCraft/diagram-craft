import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import type { RelationSchema } from '@arch-register/api-types/relationSchemaContract';
import type { WorkspaceLifecycleState } from '@arch-register/api-types/workspaceContract';
import type { TreeNode } from '@arch-register/api-types/entityContract';
import type {
  MetricAggregation,
  MetricConfig,
  MetricLegend as MetricLegendData,
  MetricResult
} from '@arch-register/api-types/metricContract';
import type { EntityHoverCardRow } from '../../../components/EntityHoverCardBody';
import { AGGREGATION_OPTIONS, isEnumSource } from './mapMetricConfig';
import { categoricalColor, NEUTRAL_MISSING_COLOR, numericColor } from './mapColorScales';
import { formatMetricResultValue, formatMetricSourceValue } from './mapMetricFormatting';
import { isRelationMapNode } from './mapViewTraversal';

export const aggregationLabel = (aggregation: MetricAggregation) =>
  AGGREGATION_OPTIONS.find(o => o.value === aggregation)?.label ?? aggregation;

export const metricValueLabel = (
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
export const resolveBoxColor = (
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

export type DirectMetricValue =
  | { kind: 'number'; value: number }
  | { kind: 'enum'; value: string }
  | { kind: 'lifecycle'; value: string };

export const getDirectMetricValue = (
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

export const hasMissingMetricData = (
  metric: MetricConfig,
  result: MetricResult | undefined
): boolean => {
  if (!result) return true;
  if (result.sourceCount === 0) return true;
  if (metric.aggregation === 'percentage') return result.value == null;
  return isEnumSource(metric.source) ? result.dominantValue == null : result.value == null;
};

/** Extra hover-card rows describing the metric result: value, enum distribution, coverage. */
export const buildMetricRows = (
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
