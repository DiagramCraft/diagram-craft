import { describe, expect, it } from 'vitest';
import type { SchemaField } from '@arch-register/api-types/schemaContract';
import { convertScalarFieldCardinality, normalizeEntityScalarFields } from './entityScalarValues';
import type { WorkspaceEnumDbResult } from './db/catalogDatabase';

describe('entity scalar values', () => {
  it('validates enum values while preserving historical retired and unknown values', () => {
    const field = {
      id: 'classification',
      name: 'Classification',
      type: 'select' as const,
      enumId: 'classification-enum'
    };
    const enumeration: WorkspaceEnumDbResult = {
      id: 'classification-enum',
      workspace: 'ws-1',
      name: 'Classification',
      options: [
        { value: 'public', label: 'Public' },
        { value: 'legacy', label: 'Legacy', retired: true }
      ],
      sort_order: 0,
      created_at: new Date(),
      updated_at: new Date()
    };

    expect(
      normalizeEntityScalarFields({
        schemaFields: [field],
        fields: { classification: 'public' },
        enumDefinitions: [enumeration]
      })
    ).toEqual({ classification: 'public' });

    expect(() =>
      normalizeEntityScalarFields({
        schemaFields: [field],
        fields: { classification: 'legacy' },
        enumDefinitions: [enumeration]
      })
    ).toThrow("cannot be changed to retired enum option 'legacy'");

    expect(
      normalizeEntityScalarFields({
        schemaFields: [field],
        fields: { classification: 'legacy' },
        previousFields: { classification: 'legacy' },
        enumDefinitions: [enumeration]
      })
    ).toEqual({ classification: 'legacy' });

    expect(
      normalizeEntityScalarFields({
        schemaFields: [field],
        fields: { classification: 'old-workspace-value' },
        previousFields: { classification: 'old-workspace-value' },
        enumDefinitions: [enumeration]
      })
    ).toEqual({ classification: 'old-workspace-value' });
  });

  it('wraps legacy scalar values when a field becomes multi-valued', () => {
    const field: SchemaField = {
      id: 'labels',
      name: 'Labels',
      type: 'text',
      maxCardinality: -1
    };

    expect(
      normalizeEntityScalarFields({ schemaFields: [field], fields: { labels: 'legacy' } })
    ).toEqual({ labels: ['legacy'] });
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
