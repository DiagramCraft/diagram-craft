import { describe, expect, it } from 'vitest';
import type { SchemaField } from '@arch-register/api-types/schemaContract';
import {
  scalarCardinalityPatchForMin,
  scalarCardinalityPatchForRequirement
} from './scalarCardinality';

const field = (patch: Partial<Extract<SchemaField, { type: 'text' }>> = {}) =>
  ({ id: 'name', name: 'Name', type: 'text', ...patch }) as Extract<SchemaField, { type: 'text' }>;

describe('scalar cardinality editor helpers', () => {
  it('raises the minimum when completeness is changed to required', () => {
    expect(scalarCardinalityPatchForRequirement(field({ minCardinality: 0 }), 'required')).toEqual({
      requirementLevel: 'required',
      minCardinality: 1
    });
  });

  it('clears the minimum when required completeness is changed away', () => {
    expect(
      scalarCardinalityPatchForRequirement(
        field({ requirementLevel: 'required', minCardinality: 2, maxCardinality: 3 }),
        'expected'
      )
    ).toEqual({ requirementLevel: 'expected', minCardinality: 0 });
  });

  it('promotes completeness when a positive minimum is entered', () => {
    expect(scalarCardinalityPatchForMin(field({ requirementLevel: 'optional' }), 1)).toEqual({
      minCardinality: 1,
      requirementLevel: 'required'
    });
  });

  it('downgrades required completeness when the minimum is cleared', () => {
    expect(scalarCardinalityPatchForMin(field({ requirementLevel: 'required' }), 0)).toEqual({
      minCardinality: 0,
      requirementLevel: 'optional'
    });
  });
});
