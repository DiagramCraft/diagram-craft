import { describe, expect, it } from 'vitest';
import { metricTraversalStepSchema } from './metricContract';

describe('metric traversal steps', () => {
  it('accepts an unbound typed relation in either direction or both directions', () => {
    for (const direction of ['in', 'out', 'both'] as const) {
      expect(
        metricTraversalStepSchema.safeParse({
          kind: 'unboundTypedRelation',
          relationSchemaId: 'relation-1',
          direction
        }).success
      ).toBe(true);
    }
  });

  it('requires a relation schema for an unbound typed relation', () => {
    expect(
      metricTraversalStepSchema.safeParse({
        kind: 'unboundTypedRelation',
        direction: 'in'
      }).success
    ).toBe(false);
  });
});
