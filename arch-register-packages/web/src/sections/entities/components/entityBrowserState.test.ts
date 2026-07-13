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
      radar: { schemaId: 's', quadrantFieldId: '_assessment:enum1', ringFieldId: 'severity', ringOrder: [] },
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
});
