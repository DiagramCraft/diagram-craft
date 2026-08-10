import { describe, expect, it } from 'vitest';
import { normalizeMapConfig } from './mapViewConfig';

describe('map view config normalization', () => {
  it('migrates the legacy fixed-depth shape into levelConfigs', () => {
    expect(
      normalizeMapConfig({
        levels: 2,
        level1SchemaId: 'domain',
        level1Columns: 2,
        level2SchemaId: 'system',
        level2Columns: 4,
        level3SchemaId: 'contract',
        level3Columns: 1,
        fieldIds: ['_owner'],
        metricConfig: { sourceSchemaId: 'system' }
      })
    ).toEqual({
      levelConfigs: [
        { schemaId: 'domain', columns: 2 },
        { schemaId: 'system', columns: 4 }
      ],
      fieldIds: ['_owner'],
      metricConfig: { sourceSchemaId: 'system' },
      hideMissingMetricData: undefined
    });
  });

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
