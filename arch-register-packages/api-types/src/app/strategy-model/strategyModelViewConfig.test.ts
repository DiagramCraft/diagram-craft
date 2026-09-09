import { describe, expect, it } from 'vitest';
import {
  DEFAULT_STRATEGY_VIEW_CONFIG,
  resolveStrategyModelViewConfig,
  strategyModelViewConfigSchema,
  type ViewConfigSchemaField
} from './strategyModelViewConfig';

const seedFields: ViewConfigSchemaField[] = [
  { id: 'maturity', type: 'number' },
  { id: 'maturity_target', type: 'number' },
  { id: 'gap', type: 'derived' },
  { id: 'risk', type: 'number' },
  { id: 'annual_investment', type: 'currency' },
  { id: 'criticality', type: 'number' },
  { id: 'capability_type', type: 'select' },
  { id: 'value_stream', type: 'text' },
  { id: 'strategic_importance', type: 'select' },
  { id: 'investment_priority', type: 'select' },
  { id: 'status', type: 'select' },
  { id: 'retired_field', type: 'number', archived: true }
];

describe('strategyModelViewConfigSchema', () => {
  it('accepts an empty object and fills defaults', () => {
    const parsed = strategyModelViewConfigSchema.parse({});
    expect(parsed.tableColumns).toEqual([]);
    expect(parsed.heatmap).toBeNull();
  });

  it('rejects an out-of-range bucket count', () => {
    expect(
      strategyModelViewConfigSchema.safeParse({
        heatmap: { xFieldId: 'a', yFieldId: 'b', colorFieldId: null, buckets: 9 }
      }).success
    ).toBe(false);
  });
});

describe('resolveStrategyModelViewConfig', () => {
  it('returns the default config unchanged when raw is null and all seed fields exist', () => {
    const { config, diagnostics } = resolveStrategyModelViewConfig(null, seedFields);
    expect(diagnostics).toEqual([]);
    expect(config.rollups).toHaveLength(DEFAULT_STRATEGY_VIEW_CONFIG.rollups.length);
    expect(config.heatmap).toEqual(DEFAULT_STRATEGY_VIEW_CONFIG.heatmap);
  });

  it('drops a roll-up whose field was archived and reports a diagnostic', () => {
    const { config, diagnostics } = resolveStrategyModelViewConfig(
      {
        rollups: [
          { fieldId: 'maturity', aggregation: 'avg', format: 'decimal1' },
          { fieldId: 'retired_field', aggregation: 'sum', format: 'number' }
        ]
      },
      seedFields
    );
    expect(config.rollups.map(r => r.fieldId)).toEqual(['maturity']);
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]).toMatchObject({ surface: 'rollups', fieldId: 'retired_field' });
  });

  it('nulls the heatmap when an axis field is missing', () => {
    const { config, diagnostics } = resolveStrategyModelViewConfig(
      { heatmap: { xFieldId: 'criticality', yFieldId: 'gone', colorFieldId: null, buckets: 4 } },
      seedFields
    );
    expect(config.heatmap).toBeNull();
    expect(diagnostics.some(d => d.surface === 'heatmap' && d.fieldId === 'gone')).toBe(true);
  });

  it('keeps structural pseudo table columns', () => {
    const { config } = resolveStrategyModelViewConfig(
      { tableColumns: [{ fieldId: '_level', visible: true }, { fieldId: 'nope', visible: true }] },
      seedFields
    );
    expect(config.tableColumns.map(c => c.fieldId)).toEqual(['_level']);
  });
});
