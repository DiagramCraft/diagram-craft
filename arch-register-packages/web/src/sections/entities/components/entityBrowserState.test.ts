import { describe, expect, it } from 'vitest';
import {
  parseJsonConfig,
  parseViewConfigs,
  pruneAssessmentReferences,
  serializeViewConfigs,
  toSavedViewConfig
} from './entityBrowserState';

describe('entity browser view field persistence', () => {
  it.each(['table', 'cards', 'tree'] as const)('saves %s field configuration', view => {
    expect(toSavedViewConfig(view, { [view]: { fieldIds: ['_owner', 'technology'] } })).toEqual({
      [view]: { fieldIds: ['_owner', 'technology'] }
    });
  });

  it('round trips independent selections through the URL payload', () => {
    const configs = { table: { fieldIds: ['a'] }, cards: { fieldIds: ['b'] } };
    expect(parseViewConfigs(serializeViewConfigs(configs))).toEqual(configs);
  });

  it('saves a map configuration, including levels/columns and metricConfig', () => {
    const mapConfig = {
      levels: 3,
      level1SchemaId: 's-domain',
      level1Columns: 3,
      level2SchemaId: 's-capability',
      level2Columns: 2,
      level3SchemaId: 's-service',
      level3Columns: 4,
      metricConfig: {
        sourceSchemaId: 's-service',
        source: { kind: 'field', fieldId: 'score' },
        aggregation: 'average'
      }
    };
    expect(toSavedViewConfig('map', { map: mapConfig })).toEqual({ map: mapConfig });
    expect(parseViewConfigs(serializeViewConfigs({ map: mapConfig }))).toEqual({ map: mapConfig });
  });

  it('rejects malformed and non-object view-config payloads', () => {
    expect(parseViewConfigs('{')).toEqual({});
    expect(parseViewConfigs('[]')).toEqual({});
    expect(parseViewConfigs('null')).toEqual({});
    expect(serializeViewConfigs({})).toBeUndefined();
  });

  it('returns null for missing or malformed individual JSON configs', () => {
    expect(parseJsonConfig(undefined)).toBeNull();
    expect(parseJsonConfig('')).toBeNull();
    expect(parseJsonConfig('{')).toBeNull();
    expect(parseJsonConfig<{ fieldIds: string[] }>(JSON.stringify({ fieldIds: ['a'] }))).toEqual({
      fieldIds: ['a']
    });
  });
});

describe('pruneAssessmentReferences', () => {
  it('strips assessment presence and field conditions', () => {
    const { conditions } = pruneAssessmentReferences(
      [
        { fieldId: '_schemaId', op: 'equals', value: 'x' },
        { fieldId: '_assessment', op: 'not_empty', value: undefined },
        { fieldId: '_assessment:rating1', op: 'gte', value: 3 }
      ],
      {}
    );
    expect(conditions).toEqual([{ fieldId: '_schemaId', op: 'equals', value: 'x' }]);
  });

  it('strips assessment field ids from table/cards/tree fieldIds arrays', () => {
    const { viewConfigs } = pruneAssessmentReferences([], {
      table: { fieldIds: ['_owner', '_assessment:rating1', 'technology'] }
    });
    expect(viewConfigs.table).toEqual({ fieldIds: ['_owner', 'technology'] });
  });

  it('clears radar quadrant/ring fields and matrix colEnumFieldId when they reference the assessment', () => {
    const { viewConfigs } = pruneAssessmentReferences([], {
      radar: {
        schemaId: 's',
        quadrantFieldId: '_assessment:enum1',
        ringFieldId: 'severity',
        ringOrder: []
      },
      matrix: {
        colMode: 'attribute',
        colSchemaId: null,
        colEnumFieldId: '_assessment:enum1',
        filterFieldName: null,
        hideEmptyRows: false,
        hideEmptyCols: false
      }
    });
    expect(viewConfigs.radar).toMatchObject({ quadrantFieldId: '', ringFieldId: 'severity' });
    expect(viewConfigs.matrix).toMatchObject({ colEnumFieldId: null });
  });

  it('leaves configs without assessment references untouched', () => {
    const configs = { table: { fieldIds: ['_owner', 'technology'] } };
    const { viewConfigs } = pruneAssessmentReferences([], configs);
    expect(viewConfigs).toEqual(configs);
  });

  it('clears an assessment-sourced map metricConfig entirely', () => {
    const { viewConfigs } = pruneAssessmentReferences([], {
      map: {
        levels: 2,
        level1SchemaId: 's1',
        level1Columns: 3,
        level2SchemaId: null,
        level2Columns: 3,
        level3SchemaId: null,
        level3Columns: 3,
        metricConfig: {
          sourceSchemaId: 's1',
          source: { kind: 'assessmentRating', fieldId: 'rating1' },
          aggregation: 'average'
        }
      }
    });
    expect(viewConfigs.map).toMatchObject({ level1SchemaId: 's1', metricConfig: null });
  });

  it('leaves a non-assessment-sourced map metricConfig untouched', () => {
    const configs = {
      map: {
        levels: 2,
        level1SchemaId: 's1',
        level1Columns: 3,
        level2SchemaId: null,
        level2Columns: 3,
        level3SchemaId: null,
        level3Columns: 3,
        metricConfig: {
          sourceSchemaId: 's1',
          source: { kind: 'lifecycle' },
          aggregation: 'worst',
          worstDirection: 'high'
        }
      }
    };
    const { viewConfigs } = pruneAssessmentReferences([], configs);
    expect(viewConfigs).toEqual(configs);
  });
});
