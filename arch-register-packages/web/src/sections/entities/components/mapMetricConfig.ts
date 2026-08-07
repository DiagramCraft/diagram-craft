import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import type {
  MetricAggregation,
  MetricConfig,
  MetricSource
} from '@arch-register/api-types/metricContract';
import type { FieldGroupAccess, FieldGroupAccessControl } from '@arch-register/permissions';
import type { JoinedAssessmentContext } from './entityFieldSources';

// `MapConfig.metricConfig` is stored as `unknown` in the saved-view config schema (the web app
// doesn't depend on zod directly - see entityViewConfig.ts), so it's parsed structurally here
// rather than via a shared zod schema, matching that established pattern.
export const parseMetricConfig = (raw: unknown): MetricConfig | null => {
  if (raw == null || typeof raw !== 'object') return null;
  const candidate = raw as Record<string, unknown>;
  const sourceSchemaId = candidate.sourceSchemaId;
  const aggregation = candidate.aggregation;
  const source = candidate.source as Record<string, unknown> | undefined;
  if (typeof sourceSchemaId !== 'string' || typeof aggregation !== 'string' || !source) {
    return null;
  }
  if (
    !['count', 'sum', 'average', 'minimum', 'maximum', 'worst'].includes(aggregation) ||
    typeof source.kind !== 'string' ||
    !['field', 'assessmentRating', 'lifecycle', 'enum', 'assessmentEnum'].includes(source.kind)
  ) {
    return null;
  }
  if (source.kind !== 'lifecycle' && typeof source.fieldId !== 'string') return null;
  const worstDirection = candidate.worstDirection;
  const targetCurrency = candidate.targetCurrency;
  return {
    sourceSchemaId,
    source: source as MetricSource,
    aggregation: aggregation as MetricAggregation,
    ...(worstDirection === 'low' || worstDirection === 'high' ? { worstDirection } : {}),
    ...(typeof targetCurrency === 'string' && /^[A-Z]{3}$/.test(targetCurrency)
      ? { targetCurrency }
      : {})
  };
};

export type MetricSourceOption = {
  source: MetricSource;
  label: string;
};

/**
 * Selectable metric sources for `schema`'s descendants: numeric/currency/select fields, lifecycle,
 * and (if joined) assessment rating/enum fields. Fields in a group the caller cannot view are
 * omitted - pass `useFieldGroupAccess(workspaceId)` for `getFieldGroupAccess`, matching
 * `FilterBuilder`.
 */
export const getMetricSourceOptions = (
  schema: EntitySchema | undefined,
  joinedAssessment?: JoinedAssessmentContext | null,
  getFieldGroupAccess: (
    accessControl: FieldGroupAccessControl | undefined
  ) => FieldGroupAccess = () => 'edit'
): MetricSourceOption[] => {
  if (!schema) return [];
  const options: MetricSourceOption[] = [{ source: { kind: 'lifecycle' }, label: 'Lifecycle' }];
  for (const field of schema.fields) {
    if (field.groupId) {
      const group = schema.groups?.find(g => g.id === field.groupId);
      if (getFieldGroupAccess(group?.accessControl) === 'none') continue;
    }
    if (field.type === 'number' || field.type === 'currency') {
      options.push({ source: { kind: 'field', fieldId: field.id }, label: field.name });
    } else if (field.type === 'select') {
      options.push({ source: { kind: 'enum', fieldId: field.id }, label: field.name });
    }
  }
  if (joinedAssessment) {
    for (const field of joinedAssessment.assessment.fields) {
      if (field.type === 'rating') {
        options.push({
          source: { kind: 'assessmentRating', fieldId: field.id },
          label: `${field.label} (assessment)`
        });
      } else if (field.type === 'enum') {
        options.push({
          source: { kind: 'assessmentEnum', fieldId: field.id },
          label: `${field.label} (assessment)`
        });
      }
    }
  }
  return options;
};

export const sourceKey = (source: MetricSource): string =>
  source.kind === 'lifecycle' ? 'lifecycle' : `${source.kind}:${source.fieldId}`;

export const isEnumSource = (source: MetricSource): boolean =>
  source.kind === 'enum' || source.kind === 'assessmentEnum';

export const isCurrencyMetric = (
  metric: MetricConfig,
  schema: EntitySchema | undefined
): boolean => {
  if (metric.source.kind !== 'field' || metric.aggregation === 'count') return false;
  const fieldId = metric.source.fieldId;
  return schema?.fields.some(field => field.id === fieldId && field.type === 'currency') === true;
};

export const AGGREGATION_OPTIONS: { value: MetricAggregation; label: string }[] = [
  { value: 'count', label: 'Count' },
  { value: 'sum', label: 'Sum' },
  { value: 'average', label: 'Average' },
  { value: 'minimum', label: 'Minimum' },
  { value: 'maximum', label: 'Maximum' },
  { value: 'worst', label: 'Worst' }
];
