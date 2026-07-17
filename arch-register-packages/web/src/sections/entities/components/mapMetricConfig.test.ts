import { describe, expect, it } from 'vitest';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import {
  getMetricSourceOptions,
  isEnumSource,
  parseMetricConfig,
  sourceKey
} from './mapMetricConfig';
import type { JoinedAssessmentContext } from './entityFieldSources';

describe('parseMetricConfig', () => {
  it('parses a well-formed numeric field metric config', () => {
    const config = parseMetricConfig({
      sourceSchemaId: 's1',
      source: { kind: 'field', fieldId: 'score' },
      aggregation: 'average'
    });
    expect(config).toEqual({
      sourceSchemaId: 's1',
      source: { kind: 'field', fieldId: 'score' },
      aggregation: 'average'
    });
  });

  it('parses a well-formed worst config, keeping worstDirection', () => {
    const config = parseMetricConfig({
      sourceSchemaId: 's1',
      source: { kind: 'lifecycle' },
      aggregation: 'worst',
      worstDirection: 'low'
    });
    expect(config?.worstDirection).toBe('low');
  });

  it.each([undefined, null, 'not an object', 42, []])(
    'returns null for non-object input: %s',
    raw => {
      expect(parseMetricConfig(raw)).toBeNull();
    }
  );

  it('returns null when sourceSchemaId, source, or aggregation is missing', () => {
    expect(parseMetricConfig({ source: { kind: 'lifecycle' }, aggregation: 'count' })).toBeNull();
    expect(parseMetricConfig({ sourceSchemaId: 's1', aggregation: 'count' })).toBeNull();
    expect(
      parseMetricConfig({ sourceSchemaId: 's1', source: { kind: 'lifecycle' } })
    ).toBeNull();
  });

  it('returns null for an unknown aggregation or source kind', () => {
    expect(
      parseMetricConfig({
        sourceSchemaId: 's1',
        source: { kind: 'lifecycle' },
        aggregation: 'median'
      })
    ).toBeNull();
    expect(
      parseMetricConfig({
        sourceSchemaId: 's1',
        source: { kind: 'bogus' },
        aggregation: 'count'
      })
    ).toBeNull();
  });

  it('returns null when a non-lifecycle source is missing fieldId', () => {
    expect(
      parseMetricConfig({ sourceSchemaId: 's1', source: { kind: 'field' }, aggregation: 'count' })
    ).toBeNull();
  });

  it('drops an invalid worstDirection rather than propagating it', () => {
    const config = parseMetricConfig({
      sourceSchemaId: 's1',
      source: { kind: 'lifecycle' },
      aggregation: 'worst',
      worstDirection: 'sideways'
    });
    expect(config?.worstDirection).toBeUndefined();
  });
});

describe('getMetricSourceOptions', () => {
  const schema: EntitySchema = {
    id: 's1',
    name: 'Service',
    description: '',
    color: null,
    icon: null,
    fields: [
      { id: 'score', name: 'Score', type: 'number', requirementLevel: 'optional' },
      { id: 'tier', name: 'Tier', type: 'select', enumId: 'e1', requirementLevel: 'optional' },
      { id: 'notes', name: 'Notes', type: 'text', requirementLevel: 'optional' }
    ]
  } as unknown as EntitySchema;

  it('returns no options when no schema is selected', () => {
    expect(getMetricSourceOptions(undefined)).toEqual([]);
  });

  it('offers lifecycle plus the schema numeric and select fields, excluding other field types', () => {
    const options = getMetricSourceOptions(schema);
    expect(options.map(o => sourceKey(o.source))).toEqual(['lifecycle', 'field:score', 'enum:tier']);
  });

  it('adds joined assessment rating/enum fields, keyed distinctly from schema fields', () => {
    const joined: JoinedAssessmentContext = {
      assessment: {
        fields: [
          { id: 'rating1', label: 'Risk rating', type: 'rating', requirementLevel: 'optional' },
          { id: 'enum1', label: 'Risk level', type: 'enum', enumId: 'e2', requirementLevel: 'optional' },
          { id: 'notes1', label: 'Notes', type: 'text', requirementLevel: 'optional' }
        ]
      },
      enums: []
    } as unknown as JoinedAssessmentContext;

    const options = getMetricSourceOptions(schema, joined);
    expect(options.map(o => sourceKey(o.source))).toEqual([
      'lifecycle',
      'field:score',
      'enum:tier',
      'assessmentRating:rating1',
      'assessmentEnum:enum1'
    ]);
  });
});

describe('isEnumSource', () => {
  it('is true only for enum and assessmentEnum source kinds', () => {
    expect(isEnumSource({ kind: 'enum', fieldId: 'x' })).toBe(true);
    expect(isEnumSource({ kind: 'assessmentEnum', fieldId: 'x' })).toBe(true);
    expect(isEnumSource({ kind: 'field', fieldId: 'x' })).toBe(false);
    expect(isEnumSource({ kind: 'assessmentRating', fieldId: 'x' })).toBe(false);
    expect(isEnumSource({ kind: 'lifecycle' })).toBe(false);
  });
});
