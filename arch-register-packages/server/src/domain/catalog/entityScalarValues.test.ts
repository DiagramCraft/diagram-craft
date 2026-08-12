import { describe, expect, it } from 'vitest';
import type { SchemaField } from '@arch-register/api-types/schemaContract';
import {
  convertScalarFieldCardinality,
  normalizeEntityScalarFields
} from './entityScalarValues';

describe('entity scalar values', () => {
  it('wraps legacy scalar values when a field becomes multi-valued', () => {
    const field: SchemaField = {
      id: 'labels',
      name: 'Labels',
      type: 'text',
      maxCardinality: -1
    };

    expect(normalizeEntityScalarFields({ schemaFields: [field], fields: { labels: 'legacy' } }))
      .toEqual({ labels: ['legacy'] });
  });

  it('preserves ordered multi-valued items and removes blank items', () => {
    const field: SchemaField = {
      id: 'labels',
      name: 'Labels',
      type: 'text',
      maxCardinality: -1
    };

    expect(
      normalizeEntityScalarFields({
        schemaFields: [field],
        fields: { labels: ['first', '', 'second'] }
      })
    ).toEqual({ labels: ['first', 'second'] });
  });

  it('uses the effective minimum and maximum cardinality', () => {
    const field: SchemaField = {
      id: 'score',
      name: 'Score',
      type: 'number',
      min: 0,
      max: 10,
      minCardinality: 2,
      maxCardinality: 3
    };

    expect(() =>
      normalizeEntityScalarFields({ schemaFields: [field], fields: { score: [1] } })
    ).toThrow('Score requires at least 2 values');
    expect(() =>
      normalizeEntityScalarFields({ schemaFields: [field], fields: { score: [1, 2, 3, 4] } })
    ).toThrow('Score allows at most 3 values');
    expect(
      normalizeEntityScalarFields({ schemaFields: [field], fields: { score: [1, 2] } })
    ).toEqual({ score: [1, 2] });
  });

  it('validates each typed scalar item, including currency allowlists', () => {
    const fields: SchemaField[] = [
      { id: 'active', name: 'Active', type: 'boolean', maxCardinality: -1 },
      { id: 'when', name: 'When', type: 'date', maxCardinality: -1 },
      { id: 'cost', name: 'Cost', type: 'currency', maxCardinality: -1 }
    ];

    expect(
      normalizeEntityScalarFields({
        schemaFields: fields,
        fields: {
          active: [true, false],
          when: ['2026-06-30'],
          cost: [{ amount: 12, currency: 'EUR' }]
        },
        supportedCurrencies: new Set(['EUR'])
      })
    ).toEqual({
      active: [true, false],
      when: ['2026-06-30'],
      cost: [{ amount: 12, currency: 'EUR' }]
    });
    expect(() =>
      normalizeEntityScalarFields({
        schemaFields: fields,
        fields: { cost: [{ amount: 12, currency: 'USD' }] },
        supportedCurrencies: new Set(['EUR'])
      })
    ).toThrow("Cost uses unsupported currency 'USD'");
  });

  it('collapses one-item arrays and rejects lossy multi-to-scalar migration', () => {
    const field = {
      id: 'labels',
      name: 'Labels',
      type: 'text'
    } as Extract<SchemaField, { type: 'text' }>;

    expect(convertScalarFieldCardinality(field, ['only'])).toBe('only');
    expect(() => convertScalarFieldCardinality(field, ['first', 'second'])).toThrow(
      'Labels is a single-valued field'
    );
  });

  it('stores an empty list for an empty multi-valued field', () => {
    const field: SchemaField = {
      id: 'labels',
      name: 'Labels',
      type: 'text',
      maxCardinality: -1
    };

    expect(normalizeEntityScalarFields({ schemaFields: [field], fields: { labels: '' } })).toEqual({
      labels: []
    });
  });
});
