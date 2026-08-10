import { describe, expect, it } from 'vitest';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import type { TreeNode } from '@arch-register/api-types/entityContract';
import type { MetricConfig, MetricResult } from '@arch-register/api-types/metricContract';
import {
  buildMetricRows,
  getDirectMetricValue,
  hasMissingMetricData,
  metricValueLabel,
  resolveBoxColor
} from './mapMetricPresentation';
import { numericColor, NEUTRAL_MISSING_COLOR } from './mapColorScales';

const schema = {
  id: 'service',
  name: 'Service',
  fields: [
    { id: 'cost', name: 'Cost', type: 'number' },
    { id: 'state', name: 'State', type: 'select' }
  ]
} as unknown as EntitySchema;

const node = {
  _uid: 'service-1',
  _publicId: 'service-1',
  _name: 'Checkout',
  _slug: 'checkout',
  _schema: { id: 'service', name: 'Service' },
  _lifecycle: null,
  cost: 42,
  state: 'active'
} as unknown as TreeNode;

const metric = (
  source: MetricConfig['source'],
  aggregation: MetricConfig['aggregation']
): MetricConfig => ({
  sourceSchemaId: 'service',
  source,
  aggregation
});

const result = (overrides: Partial<MetricResult> = {}): MetricResult =>
  ({
    boxEntityId: 'service-1',
    value: null,
    lifecycleId: null,
    dominantValue: null,
    dominantLabel: null,
    distribution: [],
    sourceCount: 1,
    populatedCount: 1,
    duplicateCount: 0,
    ...overrides
  }) as MetricResult;

describe('map metric presentation', () => {
  it('reads and formats a direct leaf field when no rollup result exists', () => {
    const numericMetric = metric({ kind: 'field', fieldId: 'cost' }, 'sum');

    expect(getDirectMetricValue(node, numericMetric, schema, true)).toEqual({
      kind: 'number',
      value: 42
    });
    expect(metricValueLabel(node, true, numericMetric, schema, undefined, [])).toBe('42');
  });

  it('formats enum rollups with distribution, coverage, and duplicates', () => {
    const enumMetric = metric({ kind: 'enum', fieldId: 'state' }, 'count');
    const rows = buildMetricRows(
      node,
      true,
      enumMetric,
      'State (count)',
      'State',
      new Map([
        [
          node._uid,
          result({
            dominantValue: 'active',
            dominantLabel: 'Active',
            distribution: [
              { value: 'active', label: 'Active', count: 2 },
              { value: 'paused', label: 'Paused', count: 1 }
            ],
            sourceCount: 3,
            populatedCount: 3,
            duplicateCount: 1
          })
        ]
      ]),
      [],
      schema
    );

    expect(rows).toEqual([
      { label: 'State (count)', value: 'Active' },
      { label: 'Distribution', value: 'Active: 2, Paused: 1' },
      { label: 'Coverage', value: '3 of 3 had data' },
      { label: 'Duplicates', value: '1 duplicate path collapsed' }
    ]);
  });

  it('uses direct numeric values for color fallback and neutral color for percentage gaps', () => {
    const numericMetric = metric({ kind: 'field', fieldId: 'cost' }, 'sum');
    expect(
      resolveBoxColor(node, numericMetric, new Map(), { min: null, max: null }, [], schema, true, {
        min: 0,
        max: 100
      })
    ).toBe(numericColor(42, 0, 100));

    const percentageMetric = metric({ kind: 'field', fieldId: 'cost' }, 'percentage');
    expect(
      resolveBoxColor(
        node,
        percentageMetric,
        new Map(),
        { min: null, max: null },
        [],
        schema,
        true,
        { min: 0, max: 100 }
      )
    ).toBe(NEUTRAL_MISSING_COLOR);
  });

  it('treats absent and empty rollup data as missing', () => {
    const numericMetric = metric({ kind: 'field', fieldId: 'cost' }, 'average');
    expect(hasMissingMetricData(numericMetric, undefined)).toBe(true);
    expect(hasMissingMetricData(numericMetric, result({ sourceCount: 0 }))).toBe(true);
    expect(hasMissingMetricData(numericMetric, result({ value: null }))).toBe(true);
    expect(hasMissingMetricData(numericMetric, result({ value: 42 }))).toBe(false);
  });
});
