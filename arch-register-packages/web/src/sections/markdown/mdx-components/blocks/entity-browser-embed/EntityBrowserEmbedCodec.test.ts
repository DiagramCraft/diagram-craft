import { describe, expect, it } from 'vitest';
import {
  decodeEntityBrowserEmbedConfig,
  encodeEntityBrowserEmbedConfig,
  type EntityBrowserEmbedConfig
} from './EntityBrowserEmbedCodec';

const SAFE_PROP_VALUE = /^[a-zA-Z0-9_\-.,\s]*$/;

const fullConfig: EntityBrowserEmbedConfig = {
  q: 'search "term" with {special}: chars, [brackets]',
  conditions: [
    { fieldId: '_schemaId', op: 'equals', value: 'schema-1' },
    { fieldId: 'name', op: 'contains', value: 'foo/bar & baz' }
  ],
  sort: 'name',
  view: 'radar',
  viewConfigs: {
    radar: { xAxis: 'impact', yAxis: 'effort' },
    explore: { relationFields: ['dependsOn', 'ownedBy'] },
    bubble: { xFieldId: 'cost', yFieldId: 'headcount', sizeFieldId: null, colorFieldId: 'status' },
    map: {
      levels: 3,
      level1SchemaId: 'schema-domain',
      level1Columns: 3,
      level2SchemaId: 'schema-capability',
      level2Columns: 2,
      level3SchemaId: 'schema-service',
      level3Columns: 4,
      metricConfig: {
        sourceSchemaId: 'schema-service',
        source: { kind: 'field', fieldId: 'score' },
        aggregation: 'average'
      }
    }
  },
  projectScope: 'project'
};

describe('EntityBrowserEmbedCodec', () => {
  it('round-trips a full config', () => {
    const encoded = encodeEntityBrowserEmbedConfig(fullConfig);
    const decoded = decodeEntityBrowserEmbedConfig(encoded);
    expect(decoded).toEqual(fullConfig);
  });

  it('round-trips a minimal config', () => {
    const minimal: EntityBrowserEmbedConfig = {
      q: '',
      conditions: [],
      sort: 'name',
      view: 'table',
      viewConfigs: {}
    };
    const encoded = encodeEntityBrowserEmbedConfig(minimal);
    const decoded = decodeEntityBrowserEmbedConfig(encoded);
    expect(decoded).toEqual({ ...minimal, projectScope: undefined });
  });

  it('returns null for undefined input', () => {
    expect(decodeEntityBrowserEmbedConfig(undefined)).toBeNull();
  });

  it('returns null for malformed input', () => {
    expect(decodeEntityBrowserEmbedConfig('not-valid-base64url-json!!!')).toBeNull();
  });

  it('produces an encoded string matching the MDX prop sanitizer regex', () => {
    const encoded = encodeEntityBrowserEmbedConfig(fullConfig);
    expect(SAFE_PROP_VALUE.test(encoded)).toBe(true);
  });
});
