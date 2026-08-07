import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import type { RelationSchema } from '@arch-register/api-types/relationSchemaContract';
import type {
  MetricConfig,
  MetricLegend,
  MetricResult
} from '@arch-register/api-types/metricContract';
import { formatCurrencyValue } from '../../../utils/currencyFormat';

const isCurrencyMetric = (
  metric: MetricConfig,
  sourceSchema: EntitySchema | RelationSchema | undefined
): boolean => {
  if (metric.source.kind !== 'field' || metric.aggregation === 'count') return false;
  const fieldId = metric.source.fieldId;
  return (
    sourceSchema?.fields.some(field => field.id === fieldId && field.type === 'currency') === true
  );
};

const roundedMetricValue = (value: number): number => Math.round(value * 100) / 100;

export const formatMetricResultValue = (
  metric: MetricConfig,
  sourceSchema: EntitySchema | RelationSchema | undefined,
  result: MetricResult
): string => {
  if (result.value == null) return '—';
  if (isCurrencyMetric(metric, sourceSchema)) {
    if (result.currencyMixed) return `${roundedMetricValue(result.value)} (Unconverted)`;
    if (result.currencyCode) {
      return formatCurrencyValue({ amount: result.value, currency: result.currencyCode });
    }
  }
  return String(roundedMetricValue(result.value));
};

export const formatMetricSourceValue = (
  metric: MetricConfig,
  sourceSchema: EntitySchema | RelationSchema | undefined,
  raw: unknown
): string | null => {
  if (metric.source.kind !== 'field') return null;
  if (raw == null || raw === '') return '—';

  const fieldId = metric.source.fieldId;
  const field = sourceSchema?.fields.find(candidate => candidate.id === fieldId);
  if (field?.type === 'currency') {
    if (
      typeof raw !== 'object' ||
      raw === null ||
      Array.isArray(raw) ||
      typeof (raw as { amount?: unknown }).amount !== 'number' ||
      typeof (raw as { currency?: unknown }).currency !== 'string'
    ) {
      return '—';
    }
    return formatCurrencyValue(raw);
  }
  if (field?.type === 'number') {
    const numeric = Number(raw);
    return Number.isNaN(numeric) ? '—' : String(roundedMetricValue(numeric));
  }
  return String(raw);
};

export const formatMetricLegendValue = (value: number | null, legend: MetricLegend): string => {
  if (value == null) return '—';
  if (legend.currencyMixed) return `${roundedMetricValue(value)} (Unconverted)`;
  if (legend.currencyCode) {
    return formatCurrencyValue({ amount: value, currency: legend.currencyCode });
  }
  return String(value);
};

export const formatMetricRateDate = (legend: MetricLegend): string | null =>
  legend.currencyRateDate == null ? null : `Rates as of ${legend.currencyRateDate}`;
