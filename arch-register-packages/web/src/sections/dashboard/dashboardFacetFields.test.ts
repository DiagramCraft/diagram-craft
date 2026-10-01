import { describe, expect, it } from 'vitest';
import type { SchemaField } from '@arch-register/api-types/schemaContract';
import { facetKindForField } from './dashboardFacetFields';

const field = (overrides: Record<string, unknown>) =>
  ({ id: 'f', name: 'F', ...overrides }) as unknown as SchemaField;

describe('facetKindForField', () => {
  it.each([
    [{ type: 'reference' }, 'reference'],
    [{ type: 'select' }, 'select'],
    [{ type: 'text' }, 'text'],
    [{ type: 'derived', resultType: 'select' }, 'select'],
    [{ type: 'derived', resultType: 'text' }, 'text'],
    [{ type: 'derived', resultType: 'number' }, undefined],
    [{ type: 'number' }, undefined]
  ])('maps %j to %s', (overrides, expected) => {
    expect(facetKindForField(field(overrides))).toBe(expected);
  });
});
