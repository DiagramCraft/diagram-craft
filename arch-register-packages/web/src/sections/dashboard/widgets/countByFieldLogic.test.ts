import { describe, expect, it } from 'vitest';
import type { EntityRecord } from '@arch-register/api-types/entityContract';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import { buildCountBuckets } from './countByFieldLogic';

const entity = (value: unknown) => ({ status: value }) as unknown as EntityRecord;

const schema = {
  fields: [
    {
      id: 'status',
      type: 'select',
      options: [
        { value: 'draft', label: 'Draft' },
        { value: 'active', label: 'Active' }
      ]
    }
  ]
} as unknown as EntitySchema;

describe('buildCountBuckets', () => {
  it('orders by option order, labels from options and puts unassigned last', () => {
    const buckets = buildCountBuckets(
      [entity('active'), entity(null), entity('draft'), entity('active'), entity('other')],
      schema,
      'status'
    );
    expect(buckets.map(b => [b.label, b.count])).toEqual([
      ['Draft', 1],
      ['Active', 2],
      ['other', 1],
      ['Unassigned', 1]
    ]);
    expect(buckets.reduce((sum, b) => sum + b.percent, 0)).toBeCloseTo(100);
  });

  it('sorts alphabetically without options', () => {
    const buckets = buildCountBuckets([entity('b'), entity('a')], undefined, 'status');
    expect(buckets.map(b => b.label)).toEqual(['a', 'b']);
  });

  it('returns no buckets for no entities', () => {
    expect(buildCountBuckets([], schema, 'status')).toEqual([]);
  });
});
