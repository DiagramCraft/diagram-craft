import { describe, expect, it } from 'vitest';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import type {
  MetricConfig,
  MetricLegend,
  MetricResult
} from '@arch-register/api-types/metricContract';
import {
  formatMetricLegendValue,
  formatMetricResultValue,
  formatMetricSourceValue
} from './mapMetricFormatting';

const schema: EntitySchema = {
  id: 'contract',
  name: 'Contract',
  description: '',
  color: null,
  icon: null,
  fields: [{ id: 'annual_cost', name: 'Annual Cost', type: 'currency' }]
} as EntitySchema;

const metric: MetricConfig = {
  sourceSchemaId: 'contract',
  source: { kind: 'field', fieldId: 'annual_cost' },
  aggregation: 'sum'
};

const result = (overrides: Partial<MetricResult> = {}): MetricResult => ({
  boxEntityId: 'vendor-1',
  value: 125000,
  lifecycleId: null,
  dominantValue: null,
  dominantLabel: null,
  distribution: [],
  sourceCount: 1,
  populatedCount: 1,
  duplicateCount: 0,
  ...overrides
});

describe('map metric currency formatting', () => {
  it('formats homogeneous currency results with the returned code', () => {
    expect(formatMetricResultValue(metric, schema, result({ currencyCode: 'USD' }))).toContain(
      '125,000'
    );
  });

  it('labels mixed-currency results as unconverted', () => {
    expect(formatMetricResultValue(metric, schema, result({ currencyMixed: true }))).toBe(
      '125000 (Unconverted)'
    );
  });

  it('formats currency legend ranges and mixed ranges', () => {
    const homogeneous: MetricLegend = { min: 10, max: 20, currencyCode: 'EUR' };
    const mixed: MetricLegend = { min: 10, max: 20, currencyMixed: true };
    expect(formatMetricLegendValue(10, homogeneous)).toContain('10');
    expect(formatMetricLegendValue(10, mixed)).toBe('10 (Unconverted)');
  });

  it('formats a leaf currency source value directly', () => {
    expect(formatMetricSourceValue(metric, schema, { amount: 125000, currency: 'USD' })).toContain(
      '125,000'
    );
  });
});
