import type {
  DashboardSidebarConfig,
  DashboardWidget
} from '@arch-register/api-types/dashboardContract';

export const API_INTEGRATION_CATALOG_APP_KEY = 'api-integration-catalog';
export const API_INTEGRATION_CATALOG_IMPACT_APP_KEY = 'api-integration-catalog-impact';
export const BUSINESS_GLOSSARY_APP_KEY = 'business-glossary';
export const VENDOR_MANAGEMENT_VENDORS_APP_KEY = 'vendor-management-vendors';
export const RISK_COMPLIANCE_OVERVIEW_APP_KEY = 'risk-compliance-overview';
export const RISK_COMPLIANCE_RETENTION_APP_KEY = 'risk-compliance-retention';
export const DATA_STEWARDSHIP_APP_KEY = 'data-stewardship';
export const DATA_STEWARDSHIP_ASSESSMENTS_APP_KEY = 'data-stewardship-assessments';
export const DATA_STEWARDSHIP_STEWARDSHIP_APP_KEY = 'data-stewardship-stewardship';
export const DATA_STEWARDSHIP_CHANGE_CASES_APP_KEY = 'data-stewardship-change-cases';

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
  [DATA_STEWARDSHIP_ASSESSMENTS_APP_KEY]: {
    name: 'Assessments',
    description:
      'Impact assessments, transfer assessments, records surveys and data-quality runs bound to datasets.',
    widgets: [
      {
        id: 'seed-stat-overdue',
        type: 'AssessmentStatusStat',
        config: {
          schemaName: 'Data Entity',
          status: 'overdue',
          label: 'Overdue',
          subtextTemplate: 'past the scheduled date'
        },
        x: 0,
        y: 0,
        w: 3,
        h: 5
      },
      {
        id: 'seed-stat-in-progress',
        type: 'AssessmentStatusStat',
        config: {
          schemaName: 'Data Entity',
          status: 'in_progress',
          label: 'In progress',
          subtextTemplate: '{notStarted} not started'
        },
        x: 3,
        y: 0,
        w: 3,
        h: 5
      },
      {
        id: 'seed-stat-not-started',
        type: 'AssessmentStatusStat',
        config: {
          schemaName: 'Data Entity',
          status: 'not_started',
          label: 'Not started',
          subtextTemplate: 'no response recorded yet'
        },
        x: 6,
        y: 0,
        w: 3,
        h: 5
      },
      {
        id: 'seed-stat-complete',
        type: 'AssessmentStatusStat',
        config: {
          schemaName: 'Data Entity',
          status: 'complete',
          label: 'Complete',
          subtextTemplate: 'of {total} assessments'
        },
        x: 9,
        y: 0,
        w: 3,
        h: 5
      },
      {
        id: 'seed-assessments-table',
        type: 'AssessmentProgressTable',
        config: { schemaName: 'Data Entity', label: 'Assessments' },
        x: 0,
        y: 5,
        w: 12,
        h: 20
      }
    ]
  },
  [DATA_STEWARDSHIP_CHANGE_CASES_APP_KEY]: {
    name: 'Change cases & exceptions',
    description: 'Change proposals against governed datasets, in every status.',
    widgets: [
      {
        id: 'seed-change-cases-table',
        type: 'ChangeCaseTable',
        config: {
          schemaName: 'Data Entity',
          caseKinds: ['entity.change-case'],
          severity: 'due-date',
          status: '$status',
          label: 'Change cases'
        },
        x: 0,
        y: 0,
        w: 12,
        h: 25
      }
    ],
    sidebar: {
      kind: 'options',
      variableName: 'status',
      itemLabel: 'Status',
      allLabel: 'All change cases',
      options: [
        { value: 'open', label: 'Open' },
        { value: 'completed', label: 'Completed' },
        { value: 'cancelled', label: 'Cancelled' }
      ]
    }
  },
  [DATA_STEWARDSHIP_STEWARDSHIP_APP_KEY]: {
    name: 'Stewardship',
    description:
      'Coverage across every dataset: who owns each, who stewards it and when it was last reviewed.',
    widgets: [
      {
        id: 'seed-stat-covered',
        type: 'AggregateStat',
        config: {
          query: 'schema:"Data Entity" AND _conformanceStatus = "conformant"',
          denominatorQuery: 'schema:"Data Entity"',
          display: 'percent',
          subtextTemplate: '{count} of {total} datasets clean',
          label: 'Fully covered',
          severity: { warnAt: 60, direction: 'below' },
          showLink: false
        },
        x: 0,
        y: 0,
        w: 3,
        h: 5
      },
      {
        id: 'seed-stat-no-owner',
        type: 'AggregateStat',
        config: {
          query: 'schema:"Data Entity" AND _owner = empty',
          subtextQuery: 'schema:"Data Entity" AND steward = empty',
          subtextTemplate: '{sub} missing a steward',
          severity: { critAt: 1 },
          label: 'Missing an owner',
          showLink: false
        },
        x: 3,
        y: 0,
        w: 3,
        h: 5
      },
      {
        id: 'seed-stat-overdue',
        type: 'AggregateStat',
        config: {
          query: 'schema:"Data Entity" AND review_status = "overdue"',
          subtextTemplate: 'scheduled date passed',
          severity: { warnAt: 1 },
          label: 'Reviews overdue',
          showLink: false
        },
        x: 6,
        y: 0,
        w: 3,
        h: 5
      },
      {
        id: 'seed-stat-no-steward',
        type: 'AggregateStat',
        config: {
          query: 'schema:"Data Entity" AND steward = empty',
          subtextQuery: 'schema:"Data Entity" AND _owner = empty',
          subtextTemplate: '{sub} missing an owner',
          severity: { critAt: 1 },
          label: 'Missing a steward',
          showLink: false
        },
        x: 9,
        y: 0,
        w: 3,
        h: 5
      },
      {
        id: 'seed-gaps-to-close',
        type: 'ConformanceViolations',
        config: { schemaName: 'Data Entity', limit: 8, label: 'Gaps to close' },
        x: 0,
        y: 5,
        w: 12,
        h: 14
      }
    ]
  },
  [DATA_STEWARDSHIP_APP_KEY]: {
    name: 'My work',
    description: 'Reviews, change-case approvals and deprecation approvals awaiting action.',
    widgets: [
      {
        id: 'seed-stat-assigned',
        type: 'data-stewardship-case-count',
        config: {
          label: 'Assigned to me',
          scope: 'mine',
          caseKinds: [],
          tone: 'none',
          subtextTemplate: '{due} due within a week',
          dueWithinDays: 7
        },
        x: 0,
        y: 0,
        w: 3,
        h: 5
      },
      {
        id: 'seed-stat-past-due',
        type: 'data-stewardship-case-count',
        config: {
          label: 'Past due',
          scope: 'late',
          caseKinds: [],
          tone: 'danger',
          subtextTemplate: 'across all assignees',
          dueWithinDays: 7
        },
        x: 3,
        y: 0,
        w: 3,
        h: 5
      },
      {
        id: 'seed-stat-awaiting-decision',
        type: 'data-stewardship-case-count',
        config: {
          label: 'Cases awaiting a decision',
          scope: 'workspace',
          caseKinds: ['entity.change-case', 'entity.deprecation'],
          tone: 'warning',
          subtextTemplate: 'change-case & deprecation approvals',
          dueWithinDays: 7
        },
        x: 6,
        y: 0,
        w: 3,
        h: 5
      },
      {
        id: 'seed-stat-reviews-overdue',
        type: 'data-stewardship-reviews-overdue',
        config: { subtextTemplate: 'scheduled review date passed' },
        x: 9,
        y: 0,
        w: 3,
        h: 5
      },
      {
        id: 'seed-calendar',
        type: 'data-stewardship-case-calendar',
        config: { label: 'Next six weeks', scope: 'mine', caseKinds: [] },
        x: 0,
        y: 5,
        w: 12,
        h: 14
      },
      {
        id: 'seed-queue',
        type: 'data-stewardship-case-queue',
        config: { label: 'Assigned to me', scope: 'mine', caseKinds: [] },
        x: 0,
        y: 19,
        w: 12,
        h: 22
      }
    ]
  },
  [RISK_COMPLIANCE_OVERVIEW_APP_KEY]: {
    name: 'Overview',
    description: 'Risk posture, control coverage and what falls due next.',
    widgets: [
      {
        id: 'seed-stat-outside-appetite',
        type: 'AggregateStat',
        config: {
          query: 'schema:Risk AND status != "closed" AND residual_risk_score >= 10',
          label: 'Outside appetite',
          subtextTemplate: 'residual banded high or critical',
          severity: { warnAt: 1 },
          showLink: false
        },
        x: 0,
        y: 0,
        w: 4,
        h: 5
      },
      {
        id: 'seed-stat-control-coverage',
        type: 'AggregateStat',
        config: {
          query: 'schema:Control AND operating_effectiveness = "effective"',
          denominatorQuery: 'schema:Control',
          display: 'percent',
          label: 'Control coverage',
          subtextTemplate: '{count} of {total} tested effective',
          severity: { warnAt: 80, critAt: 50, direction: 'below' },
          showLink: false
        },
        x: 4,
        y: 0,
        w: 4,
        h: 5
      },
      {
        id: 'seed-stat-due-soon',
        type: 'AssessmentCount',
        config: {
          mode: 'active',
          schemaNames: ['Risk', 'Control'],
          dueWithinDays: 30,
          label: 'Due in 30 days',
          subtext: 'open risk reviews and control tests'
        },
        x: 8,
        y: 0,
        w: 4,
        h: 5
      },
      {
        id: 'seed-risk-matrix',
        type: 'risk-compliance-risk-matrix',
        config: {
          schemaName: 'Risk',
          axis: 'residual',
          label: 'Risk matrix — likelihood × impact'
        },
        x: 0,
        y: 5,
        w: 6,
        h: 24
      },
      {
        id: 'seed-coverage-by-control-type',
        type: 'RatioBarList',
        config: {
          schemaName: 'Control',
          groupByFieldId: 'control_type',
          numeratorFieldId: 'operating_effectiveness',
          numeratorValue: 'effective',
          label: 'Control effectiveness by control type'
        },
        x: 6,
        y: 5,
        w: 6,
        h: 12
      },
      {
        id: 'seed-upcoming-reviews',
        type: 'Assessments',
        config: {
          mode: 'active',
          schemaNames: ['Risk', 'Control'],
          relativeDue: true,
          label: 'Upcoming risk and control reviews'
        },
        x: 6,
        y: 17,
        w: 6,
        h: 12
      },
      {
        id: 'seed-highest-residual-risks',
        type: ENTITY_BROWSER_EMBED_WIDGET_TYPE,
        config: {
          title: 'Highest residual risks',
          limit: 7,
          q: '',
          conditions: [],
          // Highest residual score first; the field NAME is resolved to its id at render time.
          sort: 'field:Residual Risk Score:desc',
          view: 'table',
          viewConfigs: {
            table: {
              fieldIds: ['Category', 'Risk Owner', 'Risk Coverage', 'Residual Risk Score']
            }
          },
          // Live (not closed) risks; field NAMES are resolved against the Risk schema at render
          // time — see EntityBrowserEmbedFieldResolution.ts.
          schemaName: 'Risk',
          entityQuery: {
            root: {
              kind: 'predicate',
              path: [],
              fieldId: 'Status',
              op: 'not_equals',
              value: 'closed'
            }
          }
        },
        x: 0,
        y: 29,
        w: 6,
        h: 24
      },
      {
        id: 'seed-weak-control-risks',
        type: ENTITY_BROWSER_EMBED_WIDGET_TYPE,
        config: {
          title: 'Risks with weak or missing control',
          q: '',
          conditions: [],
          sort: 'field:Residual Risk Score:desc',
          view: 'table',
          viewConfigs: {
            table: { fieldIds: ['Category', 'Risk Coverage', 'Residual Risk Score'] }
          },
          // Live risks whose coverage is missing or below 40%.
          schemaName: 'Risk',
          entityQuery: {
            root: {
              kind: 'and',
              children: [
                {
                  kind: 'predicate',
                  path: [],
                  fieldId: 'Status',
                  op: 'not_equals',
                  value: 'closed'
                },
                {
                  kind: 'or',
                  children: [
                    {
                      kind: 'predicate',
                      path: [],
                      fieldId: 'Risk Coverage',
                      op: 'empty',
                      value: null
                    },
                    {
                      kind: 'predicate',
                      path: [],
                      fieldId: 'Risk Coverage',
                      op: 'lt',
                      value: 40
                    }
                  ]
                }
              ]
            }
          }
        },
        x: 6,
        y: 29,
        w: 6,
        h: 24
      }
    ]
  },
  [RISK_COMPLIANCE_RETENTION_APP_KEY]: {
    name: 'Retention',
    description: 'Retention policy assignments with governed entity, period and activation date.',
    widgets: [
      {
        id: 'seed-retention-assignments',
        type: ENTITY_BROWSER_EMBED_WIDGET_TYPE,
        config: {
          q: '',
          conditions: [],
          sort: 'name',
          view: 'table',
          viewConfigs: {
            table: {
              fieldIds: [
                '_projection:Policy',
                '_projection:Duration',
                '_projection:Time Unit',
                '_projection:Activated From'
              ]
            }
          },
          // A Data Entity category sits under at most one retention policy, so one row per
          // governed entity equals one row per assignment. The `Retention Policy` hop and the
          // projected terminal field NAMES are resolved at render time (typed-relation upgrade in
          // EntityBrowserEmbedFieldResolution.ts). The path predicate filters the policy entity itself (a
          // hop filter would run against the relation row); an unpicked `$policyId` becomes a plain
          // "has a policy" check.
          schemaName: 'Data Entity',
          entityQuery: {
            root: {
              kind: 'predicate',
              path: [{ kind: 'forward', fieldId: 'Retention Policy' }],
              fieldId: '_id',
              op: 'in',
              value: ['$policyId']
            },
            projections: [
              {
                path: [{ kind: 'forward', fieldId: 'Retention Policy' }],
                fieldId: '_name',
                alias: 'Policy'
              },
              {
                path: [{ kind: 'forward', fieldId: 'Retention Policy' }],
                fieldId: 'Duration',
                alias: 'Duration'
              },
              {
                path: [{ kind: 'forward', fieldId: 'Retention Policy' }],
                fieldId: 'Time Unit',
                alias: 'Time Unit'
              },
              {
                path: [{ kind: 'forward', fieldId: 'Retention Policy' }],
                fieldId: 'Activated From',
                source: 'relation',
                alias: 'Activated From'
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
      kind: 'entity-picker',
      schemaName: 'Retention Policy',
      variableName: 'policyId',
      itemLabel: 'Policies',
      // The `_id` predicate matches the internal id, not the public id.
      valueKind: 'id'
    }
  },
  [VENDOR_MANAGEMENT_VENDORS_APP_KEY]: {
    name: 'Vendors',
    description: 'Vendor register with tier, category, owner, spend, risk and next renewal.',
    widgets: [
      {
        id: 'seed-vendors',
        type: ENTITY_BROWSER_EMBED_WIDGET_TYPE,
        config: {
          q: '',
          conditions: [],
          sort: 'name',
          view: 'table',
          viewConfigs: {
            table: {
              fieldIds: [
                'Tier',
                'Category',
                'Relationship Owner',
                'Annual Spend',
                'Risk',
                'Next Renewal'
              ]
            }
          },
          // Field NAMES are resolved at render time against the live Vendor schema — see
          // EntityBrowserEmbedFieldResolution.ts. Annual Spend / Risk / Next Renewal are derived
          // fields on the Vendor schema, so they render as plain columns.
          schemaName: 'Vendor',
          entityQuery: {
            root: {
              kind: 'and',
              children: [
                { kind: 'predicate', path: [], fieldId: 'Tier', op: 'in', value: ['$tiers'] },
                {
                  kind: 'predicate',
                  path: [],
                  fieldId: 'Category',
                  op: 'in',
                  value: ['$categories']
                },
                {
                  kind: 'predicate',
                  path: [],
                  fieldId: 'Relationship Owner',
                  op: 'in',
                  value: ['$relationshipOwners']
                }
              ]
            }
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
      schemaName: 'Vendor',
      facets: [
        { fieldId: 'Tier', variableName: 'tiers', itemLabel: 'Tier' },
        { fieldId: 'Category', variableName: 'categories', itemLabel: 'Category' },
        {
          fieldId: 'Relationship Owner',
          variableName: 'relationshipOwners',
          itemLabel: 'Owner'
        }
      ]
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
