import { describe, expect, it } from 'vitest';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import { DEFAULT_STRATEGY_VIEW_CONFIG } from '@arch-register/api-types/app/strategy-model/strategyModelViewConfig';
import {
  isNumericFieldType,
  listOps,
  materializeFieldViews,
  numericFieldChoices,
  selectFieldChoices,
  toEditableConfig,
  viewConfigDirty
} from './strategyViewConfigState';

const schema = {
  id: 'business_capability',
  fields: [
    { id: 'maturity', name: 'Maturity', type: 'number' },
    { id: 'annual_investment', name: 'Annual investment', type: 'currency' },
    { id: 'capability_type', name: 'Type', type: 'select' },
    { id: 'archived_field', name: 'Old', type: 'number', archived: true }
  ]
} as unknown as EntitySchema;

describe('strategyViewConfigState', () => {
  it('isNumericFieldType is true for number and currency', () => {
    expect(isNumericFieldType(schema, 'maturity')).toBe(true);
    expect(isNumericFieldType(schema, 'annual_investment')).toBe(true);
    expect(isNumericFieldType(schema, 'capability_type')).toBe(false);
  });

  it('numeric / select field choices exclude archived', () => {
    expect(numericFieldChoices(schema).map(c => c.id)).toEqual(['maturity', 'annual_investment']);
    expect(selectFieldChoices(schema).map(c => c.id)).toEqual(['capability_type']);
  });

  it('toEditableConfig clones the default for an empty blob', () => {
    const config = toEditableConfig(null);
    expect(config).toEqual(DEFAULT_STRATEGY_VIEW_CONFIG);
    expect(config).not.toBe(DEFAULT_STRATEGY_VIEW_CONFIG);
  });

  it('viewConfigDirty compares against the stored blob', () => {
    const config = toEditableConfig(null);
    expect(viewConfigDirty(config, null)).toBe(false);
    expect(viewConfigDirty({ ...config, overviewWidgets: [] }, null)).toBe(true);
  });

  it('materializeFieldViews lists every live schema field, configured first then the rest', () => {
    const config = {
      fields: [
        { fieldId: 'capability_type', table: null, rollup: null, drawer: true, overlay: null }
      ],
      overviewWidgets: []
    };
    const views = materializeFieldViews(config, schema);
    expect(views.map(v => v.fieldId)).toEqual(['capability_type', 'maturity', 'annual_investment']);
    expect(views[0]?.drawer).toBe(true);
  });

  it('listOps.move is a no-op at the ends', () => {
    expect(listOps.move([1, 2, 3], 0, -1)).toEqual([1, 2, 3]);
    expect(listOps.move([1, 2, 3], 0, 2)).toEqual([2, 3, 1]);
  });
});
