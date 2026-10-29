import { describe, expect, test } from 'vitest';
import { DEFAULT_ENTITY_CONFORMANCE_FILTERS, toViolationQuery } from './entityConformanceFilters';

describe('toViolationQuery', () => {
  test('defaults to active violations only', () => {
    expect(toViolationQuery(DEFAULT_ENTITY_CONFORMANCE_FILTERS, { limit: 50, offset: 0 })).toEqual({
      status: 'active',
      severity: undefined,
      checkId: undefined,
      schemaId: undefined,
      limit: 50,
      offset: 0
    });
  });

  test('maps empty strings to undefined and keeps set filters', () => {
    expect(
      toViolationQuery(
        { status: '', severity: 'error', checkId: 'c1', schemaId: 's1' },
        { limit: 25, offset: 50 }
      )
    ).toEqual({
      status: undefined,
      severity: 'error',
      checkId: 'c1',
      schemaId: 's1',
      limit: 25,
      offset: 50
    });
  });
});
