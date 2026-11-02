import { describe, expect, it } from 'vitest';
import { normalizeMapConfig } from './mapViewConfig';

describe('map view config normalization', () => {
  it('preserves arbitrary levels and hidden intermediate levels', () => {
    expect(
      normalizeMapConfig({
        levelConfigs: [
          { schemaId: 'domain', columns: 3 },
          { schemaId: 'system', columns: 2, hidden: true },
          { schemaId: 'contract', columns: 1 }
        ],
        hideMissingMetricData: true
      })
    ).toEqual({
      levelConfigs: [
        { schemaId: 'domain', columns: 3 },
        { schemaId: 'system', columns: 2, hidden: true },
        { schemaId: 'contract', columns: 1 }
      ],
      fieldIds: undefined,
      metricConfig: undefined,
      hideMissingMetricData: true
    });
  });

  it('round-trips displayMode and drops invalid values', () => {
    const levels = [{ schemaId: 'a', columns: 3 }];
    expect(normalizeMapConfig({ levelConfigs: levels, displayMode: 'table' }).displayMode).toBe(
      'table'
    );
    expect(normalizeMapConfig({ levelConfigs: levels }).displayMode).toBeUndefined();
  });

  it('returns the compatibility defaults for invalid or absent configs', () => {
    expect(normalizeMapConfig(undefined)).toEqual({
      levelConfigs: [
        { schemaId: null, columns: 3 },
        { schemaId: null, columns: 3 }
      ],
      fieldIds: undefined,
      metricConfig: undefined,
      hideMissingMetricData: undefined
    });
  });
});
