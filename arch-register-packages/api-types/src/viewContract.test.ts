import { describe, expect, it } from 'vitest';
import { entityFiltersSchema } from './viewContract';

describe('saved view filters', () => {
  it('requires a canonical EntityQuery', () => {
    expect(entityFiltersSchema.safeParse({ schemaId: 'component' }).success).toBe(false);
  });

  it('allows legacy supplemental conditions for filters without SQL IR support', () => {
    expect(
      entityFiltersSchema.safeParse({
        conditions: [{ fieldId: '_completeness', op: 'lt', value: 50 }],
        entityQuery: { root: { kind: 'and', children: [] } }
      }).success
    ).toBe(true);
  });
});
