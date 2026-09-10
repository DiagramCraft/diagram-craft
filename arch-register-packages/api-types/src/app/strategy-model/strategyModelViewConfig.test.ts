import { describe, expect, it } from 'vitest';
import {
  DEFAULT_STRATEGY_VIEW_CONFIG,
  deriveOverlays,
  deriveRollups,
  deriveTableColumns,
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
    expect(parsed.fields).toEqual([]);
    expect(parsed.overviewWidgets).toEqual([]);
  });

  it('rejects an unknown roll-up aggregation', () => {
    expect(
      strategyModelViewConfigSchema.safeParse({
        fields: [{ fieldId: 'maturity', rollup: { aggregation: 'median', format: 'number' } }]
      }).success
    ).toBe(false);
  });
});

describe('resolveStrategyModelViewConfig', () => {
  it('returns the default config unchanged when raw is null and all seed fields exist', () => {
    const { config, diagnostics } = resolveStrategyModelViewConfig(null, seedFields);
    expect(diagnostics).toEqual([]);
    expect(config.fields).toHaveLength(DEFAULT_STRATEGY_VIEW_CONFIG.fields.length);
  });

  it('drops a field entry whose field was archived and reports a diagnostic', () => {
    const { config, diagnostics } = resolveStrategyModelViewConfig(
      {
        fields: [
          { fieldId: 'maturity', rollup: { aggregation: 'avg', format: 'decimal1' } },
          { fieldId: 'retired_field', table: { display: 'plain' } }
        ]
      },
      seedFields
    );
    expect(config.fields.map(field => field.fieldId)).toEqual(['maturity']);
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]).toMatchObject({ surface: 'fields', fieldId: 'retired_field' });
  });
});

describe('derivations', () => {
  const { config } = resolveStrategyModelViewConfig(null, seedFields);

  it('derives roll-up specs from fields with a roll-up', () => {
    expect(deriveRollups(config).map(r => r.fieldId)).toEqual([
      'maturity',
      'maturity_target',
      'gap',
      'annual_investment',
      'risk'
    ]);
  });

  it('puts the four structural columns first, then configured field columns', () => {
    const columns = deriveTableColumns(config);
    expect(columns.slice(0, 4).map(c => c.fieldId)).toEqual(['_name', '_level', '_owner', '_apps']);
    expect(columns.filter(c => c.kind === 'field').map(c => c.fieldId)).toEqual([
      'maturity',
      'maturity_target',
      'gap',
      'annual_investment',
      'risk'
    ]);
  });

  it('marks a rolled-up overlay as source "rollup"', () => {
    const overlays = deriveOverlays(config);
    expect(overlays.find(o => o.fieldId === 'maturity')?.source).toBe('rollup');
  });
});
