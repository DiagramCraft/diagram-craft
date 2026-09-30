import type {
  DashboardSidebarConfig,
  DashboardWidget
} from '@arch-register/api-types/dashboardContract';

export const API_INTEGRATION_CATALOG_APP_KEY = 'api-integration-catalog';
export const API_INTEGRATION_CATALOG_IMPACT_APP_KEY = 'api-integration-catalog-impact';
export const BUSINESS_GLOSSARY_APP_KEY = 'business-glossary';

/** The `entity-browser-embed` widget type, shared with the markdown/wiki embed block (see
 *  `web/src/sections/markdown/mdx-components/blocks/entity-browser-embed/EntityBrowserEmbedEditable.tsx`'s
 *  `ENTITY_BROWSER_EMBED_TYPE`). Not re-exported from there to avoid a client package importing
 *  from the server, or vice versa; kept in sync by convention (both are `'EntityBrowserEmbed'`). */
const ENTITY_BROWSER_EMBED_WIDGET_TYPE = 'EntityBrowserEmbed';

export type AppDashboardSeed = {
  name: string;
  description: string;
  widgets: DashboardWidget[];
  sidebar?: DashboardSidebarConfig;
};

export const APP_DASHBOARD_SEEDS: Record<string, AppDashboardSeed> = {
  [API_INTEGRATION_CATALOG_APP_KEY]: {
    name: 'Overview',
    description: 'API specifications, operations and integration relations at a glance.',
    widgets: [
      {
        id: 'seed-stat-needs-attention',
        type: 'api-integration-catalog-needs-attention-count',
        config: {},
        x: 0,
        y: 0,
        w: 3,
        h: 5
      },
      {
        id: 'seed-stat-crossing-boundary',
        type: 'AggregateStat',
        config: {
          query: 'schema:"Data Flow" AND cross_boundary = "cross-boundary"',
          label: 'Crossing a boundary',
          subtextTemplate: 'source and destination regions differ',
          severity: { warnAt: 1 },
          showLink: false
        },
        x: 3,
        y: 0,
        w: 3,
        h: 5
      },
      {
        id: 'seed-stat-restricted-data',
        type: 'AggregateStat',
        config: {
          query: 'schema:"Data Flow" AND data_classification in ("sensitive", "highly-sensitive")',
          label: 'Carrying restricted data',
          subtextQuery: 'schema:"Data Flow" AND data_classification = "highly-sensitive"',
          subtextTemplate: '{sub} highly sensitive',
          severity: { critAt: 1 },
          showLink: false
        },
        x: 6,
        y: 0,
        w: 3,
        h: 5
      },
      {
        id: 'seed-stat-pair-gaps',
        type: 'api-integration-catalog-pair-gaps',
        config: {},
        x: 9,
        y: 0,
        w: 3,
        h: 5
      },
      {
        id: 'seed-needs-attention',
        type: 'api-integration-catalog-needs-attention',
        config: { limit: 8 },
        x: 0,
        y: 5,
        w: 6,
        h: 20
      },
      {
        id: 'seed-most-consumed',
        type: 'api-integration-catalog-most-consumed',
        config: { limit: 6 },
        x: 6,
        y: 5,
        w: 6,
        h: 20
      },
      {
        id: 'seed-at-risk',
        type: 'api-integration-catalog-at-risk',
        config: { limit: 8 },
        x: 0,
        y: 25,
        w: 12,
        h: 20
      }
    ]
  },
  [API_INTEGRATION_CATALOG_IMPACT_APP_KEY]: {
    name: 'Impact',
    description:
      'What a change to an API would reach: registered consumers, then whatever consumes their APIs in turn.',
    widgets: [
      {
        id: 'seed-impact',
        type: 'api-integration-catalog-impact',
        config: { entityId: '$apiEntityId' },
        x: 0,
        y: 0,
        w: 12,
        h: 30
      }
    ],
    sidebar: {
      kind: 'entity-picker',
      schemaName: 'API',
      variableName: 'apiEntityId',
      itemLabel: 'APIs'
    }
  },
  [BUSINESS_GLOSSARY_APP_KEY]: {
    name: 'Business glossary',
    description: 'Governed business terms, aliases, categories, and quality reports.',
    widgets: [
      {
        id: 'seed-terms',
        type: ENTITY_BROWSER_EMBED_WIDGET_TYPE,
        config: {
          q: '',
          conditions: [],
          sort: 'name',
          view: 'table',
          viewConfigs: {
            table: {
              fieldIds: [
                'Synonyms',
                'Abbreviations',
                '_owner',
                '_lifecycle',
                'Status',
                '_projection:Category',
                '_usageCount'
              ]
            }
          },
          // `schemaName`/name-based field references below are resolved at render time against
          // the live workspace's Term schema — see EntityBrowserEmbedFieldResolution.ts's doc
          // comment; a schema's actual field ids are workspace-specific.
          schemaName: 'Term',
          entityQuery: {
            root: {
              kind: 'and',
              children: [
                {
                  kind: 'relationExists',
                  path: [
                    {
                      kind: 'forward',
                      fieldId: 'Categories',
                      filter: {
                        kind: 'predicate',
                        path: [],
                        fieldId: '_id',
                        op: 'in',
                        value: ['$categoryIds']
                      }
                    }
                  ]
                },
                { kind: 'predicate', path: [], fieldId: '_owner', op: 'in', value: ['$ownerIds'] },
                {
                  kind: 'predicate',
                  path: [],
                  fieldId: '_lifecycle',
                  op: 'in',
                  value: ['$lifecycleIds']
                }
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
        },
        x: 0,
        y: 0,
        w: 12,
        h: 40
      }
    ],
    sidebar: {
      kind: 'facets',
      schemaName: 'Term',
      facets: [
        { fieldId: 'Categories', variableName: 'categoryIds', itemLabel: 'Category' },
        { fieldId: '_owner', variableName: 'ownerIds', itemLabel: 'Owner' },
        { fieldId: '_lifecycle', variableName: 'lifecycleIds', itemLabel: 'Lifecycle' }
      ]
    }
  }
};
