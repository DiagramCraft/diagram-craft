import { describe, expect, it } from 'vitest';
import {
  hierarchyViewConfigSchema,
  radarViewConfigSchema,
  tableViewConfigSchema,
  timelineViewConfigSchema
} from '@arch-register/api-types/viewContract';
import { normalizeViewConfig } from './entityViewConfig';

const defaults = {
  startFieldId: null,
  endFieldId: null,
  groupBy: 'owner' as const,
  zoom: 'quarter' as const
};

describe('normalizeViewConfig', () => {
  it('returns the parsed config as-is when fully valid', () => {
    const raw = { startFieldId: 'start', endFieldId: 'end', groupBy: 'type', zoom: 'month' };
    expect(normalizeViewConfig(timelineViewConfigSchema, raw, defaults)).toEqual(raw);
  });

  it('merges a partially-valid config over the defaults field-by-field', () => {
    const raw = { startFieldId: 'start', endFieldId: null, groupBy: 'snapshot', zoom: 'month' };
    expect(normalizeViewConfig(timelineViewConfigSchema, raw, defaults)).toEqual({
      startFieldId: 'start',
      endFieldId: null,
      groupBy: 'snapshot',
      zoom: 'month'
    });
  });

  it('returns the defaults unchanged when the raw config fails to parse', () => {
    expect(
      normalizeViewConfig(timelineViewConfigSchema, { groupBy: 'nonsense' }, defaults)
    ).toEqual(defaults);
    expect(normalizeViewConfig(timelineViewConfigSchema, null, defaults)).toEqual(defaults);
    expect(normalizeViewConfig(timelineViewConfigSchema, undefined, defaults)).toEqual(defaults);
  });

  it('fills every field from defaults when given an empty object against an all-optional schema', () => {
    const tableDefaults = { fieldIds: ['_description', '_owner'] };
    expect(normalizeViewConfig(tableViewConfigSchema, {}, tableDefaults)).toEqual(tableDefaults);
  });

  it('passes through an optional field from the parsed config when defaults declares it as undefined', () => {
    const hierarchyDefaults = {
      levels: 2,
      level1SchemaId: null as string | null,
      level1Columns: 3,
      level2SchemaId: null as string | null,
      level2Columns: 3,
      level3SchemaId: null as string | null,
      level3Columns: 3,
      fieldIds: undefined as string[] | undefined
    };
    const raw = { levels: 1, level1SchemaId: 'service', level1Columns: 2, fieldIds: ['_owner'] };
    expect(normalizeViewConfig(hierarchyViewConfigSchema, raw, hierarchyDefaults)).toEqual({
      ...hierarchyDefaults,
      levels: 1,
      level1SchemaId: 'service',
      level1Columns: 2,
      fieldIds: ['_owner']
    });
  });

  it('supports an empty-sentinel default for views with no natural default value (e.g. Radar)', () => {
    const emptyRadarConfig = {
      schemaId: '',
      quadrantFieldId: '',
      ringFieldId: '',
      ringOrder: [] as string[]
    };

    // Invalid/missing config -> caller can treat the empty sentinel as "unconfigured".
    const unconfigured = normalizeViewConfig(radarViewConfigSchema, undefined, emptyRadarConfig);
    expect(unconfigured).toEqual(emptyRadarConfig);
    expect(unconfigured.schemaId).toBe('');

    // Fully valid config -> passed straight through, non-empty schemaId signals "configured".
    const raw = {
      schemaId: 'service',
      quadrantFieldId: 'phase',
      ringFieldId: 'tier',
      ringOrder: ['a', 'b']
    };
    expect(normalizeViewConfig(radarViewConfigSchema, raw, emptyRadarConfig)).toEqual(raw);
  });
});
