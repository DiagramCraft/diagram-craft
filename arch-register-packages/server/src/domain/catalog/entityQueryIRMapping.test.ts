import { describe, expect, it } from 'vitest';
import type { FilterCondition } from '@arch-register/api-types/viewContract';
import { filterConditionsToEntityQueryIR } from './entityQueryIRMapping';

describe('filterConditionsToEntityQueryIR', () => {
  it('maps an empty condition list to a vacuously-true and node, no schemaId/assessmentId', () => {
    expect(filterConditionsToEntityQueryIR(null, null, [])).toEqual({
      root: { kind: 'and', children: [] }
    });
  });

  it('maps each condition to a zero-path predicate under a top-level and', () => {
    const conditions: FilterCondition[] = [
      { fieldId: '_lifecycle', op: 'equals', value: 'active' },
      { fieldId: '_tags', op: 'contains', value: 'third-party' }
    ];
    expect(filterConditionsToEntityQueryIR('schema-1', 'assessment-1', conditions)).toEqual({
      schemaId: 'schema-1',
      assessmentId: 'assessment-1',
      root: {
        kind: 'and',
        children: [
          { kind: 'predicate', path: [], fieldId: '_lifecycle', op: 'equals', value: 'active' },
          { kind: 'predicate', path: [], fieldId: '_tags', op: 'contains', value: 'third-party' }
        ]
      }
    });
  });

  it('omits schemaId/assessmentId when not supplied', () => {
    const result = filterConditionsToEntityQueryIR(null, null, [
      { fieldId: '_name', op: 'contains', value: 'foo' }
    ]);
    expect(result).not.toHaveProperty('schemaId');
    expect(result).not.toHaveProperty('assessmentId');
  });
});
