import { describe, expect, it } from 'vitest';
import type { EntityRecord } from '@arch-register/api-types/entityContract';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import { buildRatioBarRows } from './ratioBarListLogic';

const entity = (fields: Record<string, unknown>) => fields as unknown as EntityRecord;

const schema = {
  fields: [
    {
      id: 'control_type',
      name: 'Control type',
      type: 'select',
      options: [{ value: 'preventive', label: 'Preventive' }]
    }
  ]
} as unknown as EntitySchema;

const fields = {
  groupByFieldId: 'control_type',
  numeratorFieldId: 'operating_effectiveness',
  numeratorValue: 'effective'
};

describe('buildRatioBarRows', () => {
  it('groups by field, counts matches and sorts largest first', () => {
    const rows = buildRatioBarRows(
      [
        entity({ control_type: 'detective', operating_effectiveness: 'effective' }),
        entity({ control_type: 'preventive', operating_effectiveness: 'effective' }),
        entity({ control_type: 'preventive', operating_effectiveness: 'ineffective' }),
        entity({ control_type: 'preventive' })
      ],
      schema,
      fields
    );
    expect(rows).toEqual([
      { id: 'preventive', label: 'Preventive', total: 3, effective: 1 },
      { id: 'detective', label: 'detective', total: 1, effective: 1 }
    ]);
  });

  it('puts entities without a group value into a dash group', () => {
    const rows = buildRatioBarRows([entity({})], schema, fields);
    expect(rows).toEqual([{ id: '—', label: '—', total: 1, effective: 0 }]);
  });
});
