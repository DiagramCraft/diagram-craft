import { describe, expect, it } from 'vitest';
import type { EntitySchema } from '@arch-register/api-types/schemaContract';
import type { RelationSchema } from '@arch-register/api-types/relationSchemaContract';
import {
  getMetricPathOptions,
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
    expect(parseMetricConfig({ sourceSchemaId: 's1', source: { kind: 'lifecycle' } })).toBeNull();
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

  it('parses a percentage aggregation with a numeratorCondition', () => {
    const config = parseMetricConfig({
      sourceSchemaId: 's1',
      source: { kind: 'lifecycle' },
      aggregation: 'percentage',
      numeratorCondition: { fieldId: 'status', op: 'equals', value: 'satisfied' }
    });
    expect(config?.aggregation).toBe('percentage');
    expect(config?.numeratorCondition).toEqual({
      fieldId: 'status',
      op: 'equals',
      value: 'satisfied'
    });
  });

  it('drops a malformed numeratorCondition rather than propagating it', () => {
    const config = parseMetricConfig({
      sourceSchemaId: 's1',
      source: { kind: 'lifecycle' },
      aggregation: 'percentage',
      numeratorCondition: { fieldId: 'status', op: 'bogus_op', value: 'satisfied' }
    });
    expect(config?.numeratorCondition).toBeUndefined();

    const missingField = parseMetricConfig({
      sourceSchemaId: 's1',
      source: { kind: 'lifecycle' },
      aggregation: 'percentage',
      numeratorCondition: { op: 'equals', value: 'satisfied' }
    });
    expect(missingField?.numeratorCondition).toBeUndefined();
  });

  it('keeps relation-aware path and source context settings', () => {
    expect(
      parseMetricConfig({
        sourceSchemaId: 'rel-1',
        sourceContext: 'relation',
        path: [
          {
            kind: 'relation',
            fieldId: 'domain',
            direction: 'backward',
            ownerSchemaId: 'system'
          },
          {
            kind: 'typedRelation',
            fieldId: 'contracts',
            relationSchemaId: 'rel-1',
            direction: 'in'
          }
        ],
        source: { kind: 'lifecycle' },
        aggregation: 'count'
      })
    ).toMatchObject({ sourceContext: 'relation', path: expect.any(Array) });
  });
});

describe('getMetricPathOptions', () => {
  const domain = { id: 'domain', name: 'Domain', fields: [] } as unknown as EntitySchema;
  const system = {
    id: 'system',
    name: 'System',
    fields: [
      {
        id: 'domain',
        name: 'Domain',
        type: 'containment',
        schemaId: 'domain',
        minCount: 0,
        maxCount: 1,
        requirementLevel: 'optional'
      },
      {
        id: 'contracts',
        name: 'Contracts',
        type: 'typedRelation',
        relationSchemaId: 'system-contract',
        direction: 'out',
        requirementLevel: 'optional'
      }
    ]
  } as unknown as EntitySchema;
  const relationSchema = {
    id: 'system-contract',
    name: 'System Contract',
    in: { schemaIds: ['system'] },
    out: { schemaIds: ['contract'] },
    fields: []
  } as unknown as RelationSchema;

  it('offers backward containment and typed relation hops for a Domain map', () => {
    const options = getMetricPathOptions(domain, [relationSchema], undefined, [domain, system]);
    expect(options).toContainEqual({
      step: { kind: 'relation', fieldId: 'domain', direction: 'backward', ownerSchemaId: 'system' },
      label: 'Domain ← system',
      targetSchemaIds: ['system']
    });
  });

  it('offers a typed relation hop for a System map', () => {
    const options = getMetricPathOptions(system, [relationSchema], undefined, [domain, system]);
    expect(options).toContainEqual({
      step: {
        kind: 'typedRelation',
        fieldId: 'contracts',
        relationSchemaId: 'system-contract',
        direction: 'out'
      },
      label: 'Contracts → System Contract',
      targetSchemaIds: ['contract']
    });
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
      { id: 'annual_cost', name: 'Annual Cost', type: 'currency', requirementLevel: 'optional' },
      { id: 'tier', name: 'Tier', type: 'select', enumId: 'e1', requirementLevel: 'optional' },
      { id: 'notes', name: 'Notes', type: 'text', requirementLevel: 'optional' }
    ]
  } as unknown as EntitySchema;

  it('returns no options when no schema is selected', () => {
    expect(getMetricSourceOptions(undefined)).toEqual([]);
  });

  it('offers lifecycle plus the schema numeric, currency, and select fields, excluding other field types', () => {
    const options = getMetricSourceOptions(schema);
    expect(options.map(o => sourceKey(o.source))).toEqual([
      'lifecycle',
      'field:score',
      'field:annual_cost',
      'enum:tier'
    ]);
  });

  it('omits a field in a group the caller cannot view', () => {
    const restrictedSchema: EntitySchema = {
      ...schema,
      fields: schema.fields.map(f => (f.id === 'score' ? { ...f, groupId: 'restricted' } : f)),
      groups: [{ id: 'restricted', name: 'Restricted', accessControl: { teamIds: ['team-1'] } }]
    } as unknown as EntitySchema;

    const options = getMetricSourceOptions(restrictedSchema, undefined, () => 'none');
    expect(options.map(o => sourceKey(o.source))).toEqual([
      'lifecycle',
      'field:annual_cost',
      'enum:tier'
    ]);
  });

  it('keeps a restricted field when the caller has view or edit access', () => {
    const restrictedSchema: EntitySchema = {
      ...schema,
      fields: schema.fields.map(f => (f.id === 'score' ? { ...f, groupId: 'restricted' } : f)),
      groups: [{ id: 'restricted', name: 'Restricted', accessControl: { teamIds: ['team-1'] } }]
    } as unknown as EntitySchema;

    const options = getMetricSourceOptions(restrictedSchema, undefined, () => 'view');
    expect(options.map(o => sourceKey(o.source))).toEqual([
      'lifecycle',
      'field:score',
      'field:annual_cost',
      'enum:tier'
    ]);
  });

  it('adds joined assessment rating/enum fields, keyed distinctly from schema fields', () => {
    const joined: JoinedAssessmentContext = {
      assessment: {
        fields: [
          { id: 'rating1', label: 'Risk rating', type: 'rating', requirementLevel: 'optional' },
          {
            id: 'enum1',
            label: 'Risk level',
            type: 'enum',
            enumId: 'e2',
            requirementLevel: 'optional'
          },
          { id: 'notes1', label: 'Notes', type: 'text', requirementLevel: 'optional' }
        ]
      },
      enums: []
    } as unknown as JoinedAssessmentContext;

    const options = getMetricSourceOptions(schema, joined);
    expect(options.map(o => sourceKey(o.source))).toEqual([
      'lifecycle',
      'field:score',
      'field:annual_cost',
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
