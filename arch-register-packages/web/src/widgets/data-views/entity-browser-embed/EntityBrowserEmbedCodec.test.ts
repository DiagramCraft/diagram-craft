import { describe, expect, it } from 'vitest';
import { entityBrowserEmbedCodec, type EntityBrowserEmbedConfig } from './EntityBrowserEmbedCodec';

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
    bubble: {
      xFieldId: 'cost',
      yFieldId: 'headcount',
      sizeFieldId: null,
      colorFieldId: 'status',
      quadrants: {
        enabled: true,
        labels: {
          topLeft: 'Invest',
          topRight: 'Strategic',
          bottomLeft: 'Deprioritize',
          bottomRight: 'Maintain'
        }
      }
    },
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
    },
    graph: {
      maxDepth: 3,
      direction: 'upstream',
      relationSchemaIds: ['relation-schema']
    }
  },
  projectScope: 'project'
};

describe('EntityBrowserEmbedCodec', () => {
  it('round-trips a full config', () => {
    const encoded = entityBrowserEmbedCodec.encode(fullConfig);
    const decoded = entityBrowserEmbedCodec.decode(encoded);
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
    const encoded = entityBrowserEmbedCodec.encode(minimal);
    const decoded = entityBrowserEmbedCodec.decode(encoded);
    expect(decoded).toEqual({ ...minimal, projectScope: undefined });
  });

  it('returns null for undefined input', () => {
    expect(entityBrowserEmbedCodec.decode(undefined)).toBeNull();
  });

  it('returns null for malformed input', () => {
    expect(entityBrowserEmbedCodec.decode('not-valid-base64url-json!!!')).toBeNull();
  });

  it('produces an encoded string matching the MDX prop sanitizer regex', () => {
    const encoded = entityBrowserEmbedCodec.encode(fullConfig);
    expect(SAFE_PROP_VALUE.test(encoded)).toBe(true);
  });

  it('round-trips an advanced entityQuery', () => {
    const withEntityQuery: EntityBrowserEmbedConfig = {
      ...fullConfig,
      entityQuery: {
        root: {
          kind: 'and',
          children: [
            {
              kind: 'relationExists',
              path: [{ kind: 'forward', fieldId: 'Categories' }]
            },
            { kind: 'predicate', path: [], fieldId: '_owner', op: 'in', value: ['$ownerIds'] }
          ]
        },
        projections: [
          {
            path: [{ kind: 'forward', fieldId: 'Categories' }],
            fieldId: '_name',
            alias: 'Category'
          }
        ]
      }
    };
    const encoded = entityBrowserEmbedCodec.encode(withEntityQuery);
    const decoded = entityBrowserEmbedCodec.decode(encoded);
    expect(decoded).toEqual(withEntityQuery);
  });
});

describe('limit', () => {
  const base: EntityBrowserEmbedConfig = {
    q: '',
    conditions: [],
    sort: 'name',
    view: 'table',
    viewConfigs: {}
  };

  it('round-trips a row limit', () => {
    const decoded = entityBrowserEmbedCodec.decode(
      entityBrowserEmbedCodec.encode({ ...base, limit: 10 })
    );
    expect(decoded?.limit).toBe(10);
  });

  it('drops an invalid limit', () => {
    const decoded = entityBrowserEmbedCodec.decode(
      entityBrowserEmbedCodec.encode({ ...base, limit: 0 })
    );
    expect(decoded?.limit).toBeUndefined();
  });

  it('round-trips interactive and leaves it unset by default', () => {
    expect(
      entityBrowserEmbedCodec.decode(entityBrowserEmbedCodec.encode({ ...base, interactive: true }))
        ?.interactive
    ).toBe(true);
    expect(
      entityBrowserEmbedCodec.decode(entityBrowserEmbedCodec.encode(base))?.interactive
    ).toBeUndefined();
  });
});

describe('column renderers', () => {
  it('round-trips columnRenderers inside table viewConfigs', () => {
    const config: EntityBrowserEmbedConfig = {
      q: '',
      conditions: [],
      sort: 'name',
      view: 'table',
      viewConfigs: {
        table: {
          fieldIds: ['Spend', '_projection:Count'],
          columnRenderers: {
            Spend: { type: 'bar', min: 0, max: 1000 },
            '_projection:Count': { type: 'colorBand', bands: [{ max: null, tone: 'good' }] }
          }
        }
      }
    };
    expect(entityBrowserEmbedCodec.decode(entityBrowserEmbedCodec.encode(config))).toEqual(config);
  });
});
