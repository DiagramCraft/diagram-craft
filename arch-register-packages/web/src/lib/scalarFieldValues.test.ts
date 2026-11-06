import { describe, expect, test } from 'vitest';
import type { SchemaField } from '@arch-register/api-types/schemaContract';
import {
  createScalarItem,
  firstScalarValue,
  isMultiValuedScalarField,
  scalarValues
} from './scalarFieldValues';

const field = (type: string, maxCardinality?: number) =>
  ({ id: 'f', name: 'F', type, maxCardinality }) as unknown as SchemaField;

describe('isMultiValuedScalarField', () => {
  test('true for supported scalar types with cardinality above one or unlimited', () => {
    expect(isMultiValuedScalarField(field('text', 3))).toBe(true);
    expect(isMultiValuedScalarField(field('select', -1))).toBe(true);
  });

  test('false for single-valued fields and non-scalar types', () => {
    expect(isMultiValuedScalarField(field('text'))).toBe(false);
    expect(isMultiValuedScalarField(field('text', 1))).toBe(false);
    expect(isMultiValuedScalarField(field('reference', 5))).toBe(false);
  });
});

describe('scalarValues', () => {
  test('normalizes to an array', () => {
    expect(scalarValues(['a', 'b'])).toEqual(['a', 'b']);
    expect(scalarValues('a')).toEqual(['a']);
    expect(scalarValues('')).toEqual([]);
    expect(scalarValues(null)).toEqual([]);
    expect(scalarValues(undefined)).toEqual([]);
    expect(scalarValues(false)).toEqual([false]);
  });

  test('firstScalarValue', () => {
    expect(firstScalarValue(['a', 'b'])).toBe('a');
    expect(firstScalarValue(undefined)).toBeUndefined();
  });
});

describe('createScalarItem', () => {
  test('returns type-appropriate defaults', () => {
    expect(createScalarItem('boolean')).toBe(false);
    expect(createScalarItem('text')).toBe('');
    expect(createScalarItem('currency')).toEqual({ amount: undefined, currency: 'USD' });
    expect(createScalarItem('currency', 'SEK')).toEqual({ amount: undefined, currency: 'SEK' });
    expect(createScalarItem('duration')).toEqual({ amount: undefined, unit: 'years' });
  });
});
