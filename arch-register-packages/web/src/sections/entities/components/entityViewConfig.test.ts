import { describe, expect, it } from 'vitest';
import { tableViewConfigSchema, timelineViewConfigSchema } from '@arch-register/api-types/viewContract';
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
    expect(normalizeViewConfig(timelineViewConfigSchema, { groupBy: 'nonsense' }, defaults)).toEqual(
      defaults
    );
    expect(normalizeViewConfig(timelineViewConfigSchema, null, defaults)).toEqual(defaults);
    expect(normalizeViewConfig(timelineViewConfigSchema, undefined, defaults)).toEqual(defaults);
  });

  it('fills every field from defaults when given an empty object against an all-optional schema', () => {
    const tableDefaults = { fieldIds: ['_description', '_owner'] };
    expect(normalizeViewConfig(tableViewConfigSchema, {}, tableDefaults)).toEqual(tableDefaults);
  });
});
