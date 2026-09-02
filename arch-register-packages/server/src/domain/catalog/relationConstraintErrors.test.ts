import { describe, expect, it } from 'vitest';
import {
  MAX_RELATION_CONSTRAINT_DIAGNOSTICS,
  relationConstraintError
} from './relationConstraintErrors';

describe('relationConstraintError', () => {
  it('caps diagnostics while preserving the total and hidden counts', () => {
    const violations = Array.from(
      { length: MAX_RELATION_CONSTRAINT_DIAGNOSTICS + 1 },
      (_, index) => ({
        kind: 'endpoint_pair_unique' as const,
        relation_schema_id: 'relation-schema-1',
        in_entity_id: `in-${index}`,
        out_entity_id: `out-${index}`,
        existing_count: 1,
        projected_count: 2
      })
    );

    const error = relationConstraintError(violations);

    expect(error).toMatchObject({
      status: 409,
      data: {
        code: 'RELATION_CONSTRAINT_VIOLATION',
        total_violation_count: MAX_RELATION_CONSTRAINT_DIAGNOSTICS + 1,
        hidden_violation_count: 1,
        truncated: true
      }
    });
    expect((error.data as { violations: unknown[] }).violations).toHaveLength(
      MAX_RELATION_CONSTRAINT_DIAGNOSTICS
    );
  });
});
