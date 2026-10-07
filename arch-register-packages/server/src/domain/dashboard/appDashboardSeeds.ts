import type {
  DashboardSidebarConfig,
  DashboardWidget
} from '@arch-register/api-types/dashboardContract';

export const API_INTEGRATION_CATALOG_APP_KEY = 'api-integration-catalog';
export const API_INTEGRATION_CATALOG_IMPACT_APP_KEY = 'api-integration-catalog-impact';
export const BUSINESS_GLOSSARY_APP_KEY = 'business-glossary';
export const VENDOR_MANAGEMENT_VENDORS_APP_KEY = 'vendor-management-vendors';
export const VENDOR_MANAGEMENT_CONTRACTS_APP_KEY = 'vendor-management-contracts';
export const VENDOR_MANAGEMENT_OVERVIEW_APP_KEY = 'vendor-management-overview';
export const VENDOR_MANAGEMENT_SPEND_APP_KEY = 'vendor-management-spend';
export const VENDOR_MANAGEMENT_RISK_APP_KEY = 'vendor-management-risk';
export const STRATEGY_OVERVIEW_APP_KEY = 'strategy-overview';
export const STRATEGY_CAPABILITY_MAP_APP_KEY = 'strategy-capability-map';
export const STRATEGY_CAPABILITIES_APP_KEY = 'strategy-capabilities';
export const STRATEGY_STRATEGY_APP_KEY = 'strategy-strategy';
export const STRATEGY_TRACEABILITY_APP_KEY = 'strategy-traceability';
export const RISK_COMPLIANCE_OVERVIEW_APP_KEY = 'risk-compliance-overview';
export const RISK_COMPLIANCE_RISKS_APP_KEY = 'risk-compliance-risks';
export const RISK_COMPLIANCE_CONTROLS_APP_KEY = 'risk-compliance-controls';
export const RISK_COMPLIANCE_ASSESSMENTS_APP_KEY = 'risk-compliance-assessments';
export const RISK_COMPLIANCE_RETENTION_APP_KEY = 'risk-compliance-retention';
export const DATA_STEWARDSHIP_APP_KEY = 'data-stewardship';
export const DATA_STEWARDSHIP_ASSESSMENTS_APP_KEY = 'data-stewardship-assessments';
export const DATA_STEWARDSHIP_STEWARDSHIP_APP_KEY = 'data-stewardship-stewardship';
export const DATA_STEWARDSHIP_CLASSIFICATION_APP_KEY = 'data-stewardship-classification';
export const DATA_STEWARDSHIP_CHANGE_CASES_APP_KEY = 'data-stewardship-change-cases';

/** The `entity-browser-embed` widget type, shared with the markdown/wiki embed block (see
 *  `web/src/sections/markdown/mdx-components/blocks/entity-browser-embed/EntityBrowserEmbedEditable.tsx`'s
 *  `ENTITY_BROWSER_EMBED_TYPE`). Not re-exported from there to avoid a client package importing
 *  from the server, or vice versa; kept in sync by convention (both are `'EntityBrowserEmbed'`). */
const ENTITY_BROWSER_EMBED_WIDGET_TYPE = 'EntityBrowserEmbed';

/** Control rows narrowed by the Controls sidebar facets (`$types`, `$effectiveness`). */
const controlFacetQuery = {
  root: {
    kind: 'and' as const,
    children: [
      {
        kind: 'predicate' as const,
        path: [],
        fieldId: 'Type',
        op: 'in' as const,
        value: ['$types']
      },
      {
        kind: 'predicate' as const,
        path: [],
        fieldId: 'Operating Effectiveness',
        op: 'in' as const,
        value: ['$effectiveness']
      }
    ]
  }
};

/** Contract rows narrowed by the Contracts sidebar facets (`$contractTypes`, `$vendorIds`). */
const contractFacetQuery = {
  root: {
    kind: 'and' as const,
    children: [
      {
        kind: 'predicate' as const,
        path: [],
        fieldId: 'Contract Type',
        op: 'in' as const,
        value: ['$contractTypes']
      },
      {
        kind: 'relationExists' as const,
        path: [
          {
            kind: 'forward' as const,
            fieldId: 'Vendor',
            filter: {
              kind: 'predicate' as const,
              path: [],
              fieldId: '_id',
              op: 'in' as const,
              value: ['$vendorIds']
            }
          }
        ]
      }
    ]
  }
};

/** Vendor rows narrowed by the Risk sidebar facets (`$tiers`, `$categories`, `$relationshipOwners`). */
const vendorRiskFacetQuery = {
  root: {
    kind: 'and' as const,
    children: [
      {
        kind: 'predicate' as const,
        path: [],
        fieldId: 'Tier',
        op: 'in' as const,
        value: ['$tiers']
      },
      {
        kind: 'predicate' as const,
        path: [],
        fieldId: 'Category',
        op: 'in' as const,
        value: ['$categories']
      },
      {
        kind: 'predicate' as const,
        path: [],
        fieldId: 'Relationship Owner',
        op: 'in' as const,
        value: ['$relationshipOwners']
      }
    ]
  }
};

/** Vendor rows narrowed by the Spend sidebar facets (`$costCentres`, `$relationshipOwners`). */
const vendorSpendFacetQuery = {
  root: {
    kind: 'and' as const,
    children: [
      {
        kind: 'predicate' as const,
        path: [],
        fieldId: 'Cost Centre',
        op: 'in' as const,
        value: ['$costCentres']
      },
      {
        kind: 'predicate' as const,
        path: [],
        fieldId: 'Relationship Owner',
        op: 'in' as const,
        value: ['$relationshipOwners']
      }
    ]
  }
};

/** Vendor spend roll-up table, one row per group (or per vendor when `groupFieldId` is omitted). */
const vendorSpendRollup = (id: string, groupFieldId?: string): DashboardWidget => ({
  id,
  type: 'GroupedRollupTable',
  config: {
    schemaName: 'Vendor',
    entityQuery: vendorSpendFacetQuery,
    ...(groupFieldId ? { groupFieldId } : {}),
    groupLabel: groupFieldId ? 'Cost centre' : 'Vendor',
    valueFieldId: 'spend',
    valueLabel: 'Spend / yr',
    showBar: true,
    showPercent: true,
    showCount: !!groupFieldId
  },
  x: 0,
  y: 0,
  w: 12,
  h: 36
});

/** Control × (Risk | Data Entity) traceability matrix, cells colored by the Control's operating
 *  effectiveness (matching the pre-dashboard screen's "is this control effective" marks). */
const controlTraceMatrix = (
  id: string,
  title: string,
  colSchemaName: string,
  y: number
): DashboardWidget => ({
  id,
  type: ENTITY_BROWSER_EMBED_WIDGET_TYPE,
  config: {
    title,
    q: '',
    conditions: [],
    sort: 'name',
    view: 'matrix',
    viewConfigs: {
      matrix: {
        colMode: 'entity',
        colSchemaId: colSchemaName,
        colEnumFieldId: null,
        filterFieldName: null,
        hideEmptyRows: false,
        hideEmptyCols: false,
        // Colored by the Control (row) itself — its operating effectiveness — so a cell reads the
        // same whichever Risk or Data Entity it links to.
        cellColorSource: 'row',
        cellColorFieldId: 'Operating Effectiveness',
        cellColorTones: {
          effective: 'good',
          'partially-effective': 'warn',
          ineffective: 'bad',
          'not-tested': 'neutral'
        }
      }
    },
    schemaName: 'Control',
    entityQuery: controlFacetQuery
  },
  x: 0,
  y,
  w: 12,
  h: 40
});

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
  [DATA_STEWARDSHIP_CLASSIFICATION_APP_KEY]: {
    name: 'Classification',
    description:
      'Datasets by classification, restricted integration flows, and cross-boundary transfers that carry personal data without a recorded safeguard.',
    widgets: [
      {
        id: 'seed-classification-tabs',
        type: 'tabs',
        config: {
          tabs: [
            {
              id: 'classified',
              label: 'Classified data',
              widgets: [
                {
                  id: 'seed-classification-restricted-datasets',
                  type: 'AggregateStat',
                  config: {
                    query:
                      'schema:"Data Entity" AND classification in ("sensitive", "highly-sensitive")',
                    label: 'Restricted datasets',
                    subtextTemplate: 'sensitive or highly sensitive',
                    severity: { critAt: 1 },
                    showLink: false
                  },
                  x: 0,
                  y: 0,
                  w: 4,
                  h: 5
                },
                {
                  id: 'seed-classification-missing-lawful-basis',
                  type: 'AggregateStat',
                  config: {
                    query:
                      'schema:"Data Entity" AND regulatory_tags = empty AND processing_purposes = empty',
                    label: 'Missing lawful-basis proxy',
                    subtextTemplate: 'no regulatory tags or processing purposes',
                    showLink: false
                  },
                  x: 4,
                  y: 0,
                  w: 4,
                  h: 5
                },
                {
                  id: 'seed-classification-total-datasets',
                  type: 'AggregateStat',
                  config: {
                    query: 'schema:"Data Entity"',
                    label: 'Total datasets',
                    subtextTemplate: 'under governance',
                    showLink: false
                  },
                  x: 8,
                  y: 0,
                  w: 4,
                  h: 5
                },
                {
                  id: 'seed-classification-datasets',
                  type: ENTITY_BROWSER_EMBED_WIDGET_TYPE,
                  config: {
                    title: 'Classified datasets',
                    q: '',
                    conditions: [],
                    sort: 'field:Classification:asc',
                    view: 'table',
                    viewConfigs: {
                      table: {
                        fieldIds: [
                          'Classification',
                          'Regulatory Tags',
                          'Processing Purposes',
                          'Steward',
                          '_owner'
                        ]
                      }
                    },
                    schemaName: 'Data Entity',
                    entityQuery: {
                      root: {
                        kind: 'and',
                        children: [
                          {
                            kind: 'predicate',
                            path: [],
                            fieldId: 'Classification',
                            op: 'in',
                            value: ['$classifications']
                          }
                        ]
                      }
                    }
                  },
                  x: 0,
                  y: 5,
                  w: 12,
                  h: 40
                }
              ]
            },
            {
              id: 'restricted-flows',
              label: 'Restricted flows',
              widgets: [
                {
                  id: 'seed-classification-restricted-flows',
                  type: 'AggregateStat',
                  config: {
                    query:
                      'schema:"Data Flow" AND data_classification in ("sensitive", "highly-sensitive")',
                    label: 'Restricted flows',
                    subtextTemplate: 'sensitive or highly sensitive',
                    showLink: false
                  },
                  x: 0,
                  y: 0,
                  w: 4,
                  h: 5
                },
                {
                  id: 'seed-classification-highly-sensitive',
                  type: 'AggregateStat',
                  config: {
                    query: 'schema:"Data Flow" AND data_classification = "highly-sensitive"',
                    label: 'Highly sensitive',
                    subtextTemplate: 'top classification tier',
                    severity: { critAt: 1 },
                    showLink: false
                  },
                  x: 4,
                  y: 0,
                  w: 4,
                  h: 5
                },
                {
                  id: 'seed-classification-crossing-boundary',
                  type: 'AggregateStat',
                  config: {
                    query:
                      'schema:"Data Flow" AND cross_boundary = "cross-boundary" AND data_classification in ("sensitive", "highly-sensitive")',
                    label: 'Crossing a boundary',
                    subtextTemplate: 'source and destination regions differ',
                    severity: { warnAt: 1 },
                    showLink: false
                  },
                  x: 8,
                  y: 0,
                  w: 4,
                  h: 5
                },
                {
                  id: 'seed-classification-restricted-flows-panel',
                  type: 'RelationTable',
                  config: {
                    relationSchemaName: 'Data Flow',
                    filter: 'data_classification in ("sensitive", "highly-sensitive")',
                    fieldIds: [
                      'data_entities',
                      'data_classification',
                      'protocol',
                      'cross_boundary'
                    ],
                    sort: 'data_classification',
                    limit: 200,
                    label: 'Flows carrying restricted or confidential data'
                  },
                  x: 0,
                  y: 5,
                  w: 12,
                  h: 28
                }
              ]
            },
            {
              id: 'cross-boundary',
              label: 'Cross-boundary transfers',
              widgets: [
                {
                  id: 'seed-classification-cross-boundary',
                  type: 'AggregateStat',
                  config: {
                    query: 'schema:"Data Flow" AND cross_boundary = "cross-boundary"',
                    label: 'Cross-boundary transfers',
                    subtextTemplate: 'source and destination regions differ',
                    showLink: false
                  },
                  x: 0,
                  y: 0,
                  w: 4,
                  h: 5
                },
                {
                  id: 'seed-classification-carrying-personal-data',
                  type: 'AggregateStat',
                  config: {
                    query:
                      'schema:"Data Flow" AND cross_boundary = "cross-boundary" AND data_classification in ("sensitive", "highly-sensitive")',
                    label: 'Carrying personal data',
                    subtextTemplate: 'classification is sensitive or higher',
                    severity: { warnAt: 1 },
                    showLink: false
                  },
                  x: 4,
                  y: 0,
                  w: 4,
                  h: 5
                },
                {
                  id: 'seed-classification-unsafeguarded',
                  type: 'AggregateStat',
                  config: {
                    query:
                      'schema:"Data Flow" AND cross_boundary = "cross-boundary" AND data_classification in ("sensitive", "highly-sensitive")',
                    label: 'Unsafeguarded personal-data transfers',
                    subtextTemplate: 'no exception recorded',
                    severity: { critAt: 1 },
                    showLink: false
                  },
                  x: 8,
                  y: 0,
                  w: 4,
                  h: 5
                },
                {
                  id: 'seed-classification-cross-boundary-panel',
                  type: 'RelationTable',
                  config: {
                    relationSchemaName: 'Data Flow',
                    filter: 'cross_boundary = "cross-boundary"',
                    fieldIds: [
                      'data_classification',
                      'source_residency_region',
                      'destination_residency_region',
                      'protocol',
                      'data_entities',
                      '_owner'
                    ],
                    sort: 'data_classification',
                    limit: 200,
                    label: 'Cross-boundary transfers'
                  },
                  x: 0,
                  y: 5,
                  w: 12,
                  h: 28
                }
              ]
            }
          ]
        },
        x: 0,
        y: 0,
        w: 12,
        h: 40
      }
    ],
    sidebar: {
      kind: 'facets',
      schemaName: 'Data Entity',
      facets: [
        { fieldId: 'Classification', variableName: 'classifications', itemLabel: 'Classification' }
      ]
    }
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
  [STRATEGY_OVERVIEW_APP_KEY]: {
    name: 'Overview',
    description:
      'Capabilities by level, objectives by status, application coverage, orphan capabilities and the largest maturity gaps.',
    widgets: [
      {
        id: 'seed-capabilities-by-level',
        type: 'CountByField',
        config: {
          schemaName: 'Business Capability',
          fieldId: 'capability_level',
          label: 'Capabilities by level'
        },
        x: 0,
        y: 0,
        w: 3,
        h: 7
      },
      {
        id: 'seed-objectives-by-status',
        type: 'CountByField',
        config: { schemaName: 'Objective', fieldId: 'status', label: 'Objectives by status' },
        x: 3,
        y: 0,
        w: 3,
        h: 7
      },
      {
        id: 'seed-application-coverage',
        type: 'AggregateStat',
        config: {
          query: 'schema:"Business Capability" AND supported_entities',
          denominatorQuery: 'schema:"Business Capability"',
          display: 'percent',
          label: 'Application coverage',
          subtextTemplate: '{count} of {total} capabilities have ≥1 application',
          showLink: false
        },
        x: 6,
        y: 0,
        w: 3,
        h: 7
      },
      {
        id: 'seed-orphan-capabilities',
        type: 'AggregateStat',
        config: {
          query: 'schema:"Business Capability" AND NOT supporting_objectives',
          label: 'Orphan capabilities',
          subtextTemplate: 'not supported by any objective',
          severity: { warnAt: 1 },
          showLink: false
        },
        x: 9,
        y: 0,
        w: 3,
        h: 7
      },
      {
        id: 'seed-largest-maturity-gaps',
        type: ENTITY_BROWSER_EMBED_WIDGET_TYPE,
        config: {
          title: 'Largest maturity gaps',
          limit: 5,
          q: '',
          conditions: [],
          // Largest gap first; field NAMES are resolved to ids at render time.
          sort: 'field:Maturity Gap:desc',
          view: 'table',
          viewConfigs: {
            table: { fieldIds: ['Maturity', 'Maturity Target', 'Maturity Gap'] }
          },
          schemaName: 'Business Capability',
          entityQuery: {
            root: {
              kind: 'predicate',
              path: [],
              fieldId: 'Maturity Gap',
              op: 'gt',
              value: 0
            }
          }
        },
        x: 0,
        y: 7,
        w: 12,
        h: 16
      }
    ]
  },
  [STRATEGY_CAPABILITY_MAP_APP_KEY]: {
    name: 'Capability map',
    description:
      'Business Capability model over its containment hierarchy, heat-coloured by an overlay.',
    widgets: [
      {
        id: 'seed-capability-map',
        type: ENTITY_BROWSER_EMBED_WIDGET_TYPE,
        config: {
          title: 'Capability map',
          q: '',
          conditions: [],
          sort: 'name',
          view: 'map',
          viewConfigs: {
            map: {
              // Domains (no parent) → L2 → L3, following the `parent` containment field down.
              // Schema NAMES are resolved to ids at render time.
              levelConfigs: [
                { schemaId: 'Business Capability', columns: 3 },
                {
                  schemaId: 'Business Capability',
                  columns: 2,
                  step: {
                    kind: 'backward',
                    fieldId: 'parent',
                    ownerSchemaId: 'Business Capability'
                  }
                },
                {
                  schemaId: 'Business Capability',
                  columns: 1,
                  step: {
                    kind: 'backward',
                    fieldId: 'parent',
                    ownerSchemaId: 'Business Capability'
                  }
                }
              ]
            }
          },
          // Heat overlays the viewer picks between: a field's subtree roll-up banded into severity
          // colours. Field NAMES are resolved against the map's schema at render time.
          overlays: [
            {
              fieldId: 'Maturity',
              aggregation: 'average',
              colourBands: [
                { max: 2.5, tone: 'bad' },
                { max: 3.5, tone: 'warn' },
                { max: null, tone: 'good' }
              ]
            },
            {
              fieldId: 'Maturity Gap',
              aggregation: 'average',
              colourBands: [
                { max: 0, tone: 'good' },
                { max: 1.5, tone: 'warn' },
                { max: null, tone: 'bad' }
              ]
            },
            {
              fieldId: 'Annual Investment',
              aggregation: 'sum',
              colourBands: [
                { max: 200_000, tone: 'good' },
                { max: 600_000, tone: 'warn' },
                { max: null, tone: 'bad' }
              ]
            },
            {
              fieldId: 'Risk',
              aggregation: 'average',
              colourBands: [
                { max: 2.5, tone: 'good' },
                { max: 3.5, tone: 'warn' },
                { max: null, tone: 'bad' }
              ]
            }
          ],
          // Dims capabilities not owned by the Owner facet's selection (none selected = none dimmed).
          dimOwnerIds: ['$owners'],
          schemaName: 'Business Capability',
          entityQuery: {
            // Level 1 = the domains: capabilities with no parent (derived level 'L1').
            root: {
              kind: 'predicate',
              path: [],
              fieldId: 'capability_level',
              op: 'equals',
              value: 'L1'
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
      schemaName: 'Business Capability',
      facets: [{ fieldId: '_owner', variableName: 'owners', itemLabel: 'Owner' }]
    }
  },
  [STRATEGY_CAPABILITIES_APP_KEY]: {
    name: 'Capabilities',
    description: 'Every Business Capability in its containment hierarchy, filterable by owner.',
    widgets: [
      {
        id: 'seed-capabilities-tree',
        type: ENTITY_BROWSER_EMBED_WIDGET_TYPE,
        config: {
          title: 'Capabilities',
          q: '',
          conditions: [],
          sort: 'name',
          view: 'tree',
          viewConfigs: {
            tree: {
              fieldIds: ['Capability Level', '_owner']
            }
          },
          schemaName: 'Business Capability',
          // The sidebar's Owner facet; an unselected facet resolves to [] and is dropped.
          entityQuery: {
            root: {
              kind: 'and',
              children: [
                {
                  kind: 'predicate',
                  path: [],
                  fieldId: '_owner',
                  op: 'in',
                  value: ['$owners']
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
      schemaName: 'Business Capability',
      facets: [{ fieldId: '_owner', variableName: 'owners', itemLabel: 'Owner' }]
    }
  },
  [STRATEGY_STRATEGY_APP_KEY]: {
    name: 'Strategy',
    description:
      'An objective, the outcomes it promises, the initiatives funding it, the measures that prove it and the capabilities it depends on.',
    widgets: [
      {
        id: 'seed-objective',
        type: 'EntityCard',
        config: { entityId: '$objectiveId', fields: 'status,target_date,owner,description' },
        x: 0,
        y: 0,
        w: 12,
        h: 9
      },
      {
        id: 'seed-outcomes',
        type: 'RelatedEntitiesList',
        config: {
          entityId: '$objectiveId',
          schemaName: 'Outcome',
          referenceField: 'objectives',
          descriptionField: 'description',
          label: 'Outcomes',
          emptyMessage: 'No outcome promised by this objective.'
        },
        x: 0,
        y: 9,
        w: 4,
        h: 14
      },
      {
        id: 'seed-initiatives',
        type: 'RelatedEntitiesList',
        config: {
          entityId: '$objectiveId',
          schemaName: 'Initiative',
          referenceField: 'objectives',
          statusField: 'status',
          descriptionField: 'description',
          label: 'Initiatives',
          emptyMessage: 'No initiative pursues this objective.'
        },
        x: 4,
        y: 9,
        w: 4,
        h: 14
      },
      {
        id: 'seed-measures',
        type: 'RelatedEntitiesList',
        config: {
          entityId: '$objectiveId',
          schemaName: 'Measure',
          referenceField: 'outcomes',
          viaSchemaName: 'Outcome',
          viaReferenceField: 'objectives',
          progressBaselineField: 'baseline',
          progressCurrentField: 'current',
          progressTargetField: 'target_value',
          progressUnitField: 'unit',
          label: 'Measures',
          emptyMessage: 'No measure tracks this objective’s outcomes.'
        },
        x: 8,
        y: 9,
        w: 4,
        h: 14
      },
      {
        id: 'seed-capabilities',
        type: ENTITY_BROWSER_EMBED_WIDGET_TYPE,
        config: {
          title: 'Capabilities this objective depends on',
          q: '',
          conditions: [],
          sort: 'name',
          view: 'table',
          viewConfigs: { table: { fieldIds: ['_owner'] } },
          schemaName: 'Business Capability',
          // The `Supported by Objectives` hop is resolved to a typed-relation step at render time
          // (EntityBrowserEmbedFieldResolution.ts); an unpicked `$objectiveId` becomes a plain
          // "supported by any objective" check.
          entityQuery: {
            root: {
              kind: 'predicate',
              path: [{ kind: 'forward', fieldId: 'Supported by Objectives' }],
              fieldId: '_id',
              op: 'in',
              value: ['$objectiveId']
            }
          }
        },
        x: 0,
        y: 23,
        w: 12,
        h: 16
      }
    ],
    sidebar: {
      kind: 'entity-picker',
      schemaName: 'Objective',
      variableName: 'objectiveId',
      itemLabel: 'Objectives',
      // The `_id` predicate matches the internal id, not the public id.
      valueKind: 'id'
    }
  },
  [STRATEGY_TRACEABILITY_APP_KEY]: {
    name: 'Traceability',
    description:
      'Walk an Objective → Capability → Application chain one hop at a time, and find capabilities no objective supports.',
    widgets: [
      {
        id: 'seed-traceability-tabs',
        type: 'tabs',
        config: {
          tabs: [
            {
              id: 'chain',
              label: 'Trace chain',
              widgets: [
                {
                  id: 'seed-traceability-walker',
                  type: 'PathWalker',
                  config: {
                    rootSchemaName: 'Objective',
                    // Relation schemas are named, not id'd: a seed can't know workspace ids.
                    hops: [
                      {
                        kind: 'unboundTypedRelation',
                        relationSchemaId: 'Objective Supports Business Capability',
                        direction: 'in'
                      },
                      {
                        kind: 'unboundTypedRelation',
                        relationSchemaId: 'Business Capability Supports Entity',
                        direction: 'in'
                      }
                    ]
                  },
                  x: 0,
                  y: 0,
                  w: 12,
                  h: 24
                }
              ]
            },
            {
              id: 'orphans',
              label: 'No strategy link',
              widgets: [
                {
                  id: 'seed-traceability-orphans',
                  type: ENTITY_BROWSER_EMBED_WIDGET_TYPE,
                  config: {
                    title: 'Capabilities no objective supports',
                    q: '',
                    conditions: [],
                    sort: 'name',
                    view: 'table',
                    viewConfigs: { table: { fieldIds: ['Capability Level', '_owner'] } },
                    schemaName: 'Business Capability',
                    // The `Supported by Objectives` hop is resolved to a typed-relation step at
                    // render time (EntityBrowserEmbedFieldResolution.ts).
                    entityQuery: {
                      root: {
                        kind: 'not',
                        child: {
                          kind: 'relationExists',
                          path: [{ kind: 'forward', fieldId: 'Supported by Objectives' }]
                        }
                      }
                    }
                  },
                  x: 0,
                  y: 0,
                  w: 12,
                  h: 20
                }
              ]
            }
          ]
        },
        x: 0,
        y: 0,
        w: 12,
        h: 30
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
  [RISK_COMPLIANCE_ASSESSMENTS_APP_KEY]: {
    name: 'Assessments',
    description: 'Risk reviews and control tests: what is due, and progress across the register.',
    widgets: [
      {
        id: 'seed-risk-reviews-due',
        type: 'Assessments',
        config: {
          mode: 'active',
          schemaNames: ['Risk'],
          relativeDue: true,
          label: 'Risk reviews due'
        },
        x: 0,
        y: 0,
        w: 6,
        h: 12
      },
      {
        id: 'seed-control-tests-due',
        type: 'Assessments',
        config: {
          mode: 'active',
          schemaNames: ['Control'],
          relativeDue: true,
          label: 'Control tests due'
        },
        x: 6,
        y: 0,
        w: 6,
        h: 12
      },
      {
        id: 'seed-assessments-tabs',
        type: 'tabs',
        config: {
          tabs: [
            {
              id: 'risks',
              label: 'Risks',
              widgets: [
                {
                  id: 'seed-risk-assessments-table',
                  type: 'AssessmentProgressTable',
                  config: { schemaName: 'Risk', label: 'Risk assessments' },
                  x: 0,
                  y: 0,
                  w: 12,
                  h: 20
                }
              ]
            },
            {
              id: 'controls',
              label: 'Controls',
              widgets: [
                {
                  id: 'seed-control-assessments-table',
                  type: 'AssessmentProgressTable',
                  config: { schemaName: 'Control', label: 'Control assessments' },
                  x: 0,
                  y: 0,
                  w: 12,
                  h: 20
                }
              ]
            }
          ]
        },
        x: 0,
        y: 12,
        w: 12,
        h: 26
      }
    ]
  },
  [RISK_COMPLIANCE_RISKS_APP_KEY]: {
    name: 'Risks',
    description:
      'Risk register and likelihood × impact matrix, filterable by category, status and owner.',
    widgets: [
      {
        id: 'seed-risks-tabs',
        type: 'tabs',
        config: {
          tabs: [
            {
              id: 'register',
              label: 'Register',
              widgets: [
                {
                  id: 'seed-risks-register',
                  type: ENTITY_BROWSER_EMBED_WIDGET_TYPE,
                  config: {
                    title: 'Risk register',
                    q: '',
                    conditions: [],
                    sort: 'field:Residual Risk Score:desc',
                    view: 'table',
                    viewConfigs: {
                      table: {
                        fieldIds: [
                          'Category',
                          'Risk Owner',
                          'Status',
                          'Inherent Risk Score',
                          'Residual Risk Score',
                          'Risk Coverage',
                          'Treatment Target Date'
                        ]
                      }
                    },
                    // Field NAMES are resolved at render time against the live Risk schema — see
                    // EntityBrowserEmbedFieldResolution.ts.
                    schemaName: 'Risk',
                    entityQuery: {
                      root: {
                        kind: 'and',
                        children: [
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
                            fieldId: 'Status',
                            op: 'in',
                            value: ['$statuses']
                          },
                          {
                            kind: 'predicate',
                            path: [],
                            fieldId: 'Risk Owner',
                            op: 'in',
                            value: ['$owners']
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
              ]
            },
            {
              id: 'matrix',
              label: 'Matrix',
              widgets: [
                {
                  id: 'seed-risks-matrix',
                  type: 'risk-compliance-risk-matrix',
                  config: {
                    schemaName: 'Risk',
                    label: 'Risk matrix — likelihood × impact',
                    axis: 'inherent',
                    includeClosed: true,
                    categories: ['$categories'],
                    statuses: ['$statuses'],
                    owners: ['$owners']
                  },
                  x: 0,
                  y: 0,
                  w: 12,
                  h: 40
                }
              ]
            }
          ]
        },
        x: 0,
        y: 0,
        w: 12,
        h: 46
      }
    ],
    sidebar: {
      kind: 'facets',
      schemaName: 'Risk',
      facets: [
        { fieldId: 'Category', variableName: 'categories', itemLabel: 'Category' },
        { fieldId: 'Status', variableName: 'statuses', itemLabel: 'Status' },
        { fieldId: 'Risk Owner', variableName: 'owners', itemLabel: 'Owner' }
      ]
    }
  },
  [RISK_COMPLIANCE_CONTROLS_APP_KEY]: {
    name: 'Controls',
    description:
      'Control library, coverage gaps and Control × Risk / Data Entity traceability, filterable by type and effectiveness.',
    widgets: [
      {
        id: 'seed-controls-tabs',
        type: 'tabs',
        config: {
          tabs: [
            {
              id: 'library',
              label: 'Library',
              widgets: [
                {
                  id: 'seed-controls-library',
                  type: ENTITY_BROWSER_EMBED_WIDGET_TYPE,
                  config: {
                    title: 'Control library',
                    q: '',
                    conditions: [],
                    sort: 'name',
                    view: 'table',
                    viewConfigs: {
                      table: {
                        fieldIds: ['Type', 'Operating Effectiveness', 'Last Verified']
                      }
                    },
                    schemaName: 'Control',
                    entityQuery: controlFacetQuery
                  },
                  x: 0,
                  y: 0,
                  w: 12,
                  h: 40
                }
              ]
            },
            {
              id: 'coverage',
              label: 'Coverage',
              widgets: [
                {
                  id: 'seed-controls-stat-effective',
                  type: 'AggregateStat',
                  config: {
                    query: 'schema:Control AND operating_effectiveness = "effective"',
                    denominatorQuery: 'schema:Control',
                    label: 'Effective',
                    subtextTemplate: '{count} of {total} controls',
                    showLink: false
                  },
                  x: 0,
                  y: 0,
                  w: 4,
                  h: 5
                },
                {
                  id: 'seed-controls-stat-never-tested',
                  type: 'AggregateStat',
                  config: {
                    query: 'schema:Control AND last_verified = empty',
                    label: 'Never tested',
                    subtextTemplate: 'no verification recorded',
                    severity: { warnAt: 1 },
                    showLink: false
                  },
                  x: 4,
                  y: 0,
                  w: 4,
                  h: 5
                },
                {
                  id: 'seed-controls-stat-uncontrolled-risks',
                  type: 'AggregateStat',
                  config: {
                    query: 'schema:Risk AND status != "closed" AND risk_coverage = empty',
                    label: 'Uncontrolled risks',
                    subtextTemplate: 'open risks with no mitigating control',
                    severity: { warnAt: 1, critAt: 1 },
                    showLink: false
                  },
                  x: 8,
                  y: 0,
                  w: 4,
                  h: 5
                },
                {
                  id: 'seed-controls-coverage-by-risk',
                  type: ENTITY_BROWSER_EMBED_WIDGET_TYPE,
                  config: {
                    title: 'Coverage by risk (weakest first)',
                    q: '',
                    conditions: [],
                    sort: 'field:Risk Coverage:asc',
                    view: 'table',
                    viewConfigs: {
                      table: {
                        fieldIds: ['Category', 'Residual Risk Score', 'Risk Coverage']
                      }
                    },
                    schemaName: 'Risk',
                    limit: 25
                  },
                  x: 0,
                  y: 5,
                  w: 6,
                  h: 24
                },
                {
                  id: 'seed-controls-coverage-by-asset',
                  type: ENTITY_BROWSER_EMBED_WIDGET_TYPE,
                  config: {
                    title: 'Coverage by information asset (fewest controls first)',
                    q: '',
                    conditions: [],
                    sort: 'field:_projection:Controls:asc',
                    view: 'table',
                    viewConfigs: {
                      table: {
                        fieldIds: ['_projection:Risks', '_projection:Controls']
                      }
                    },
                    schemaName: 'Data Entity',
                    entityQuery: {
                      root: { kind: 'and', children: [] },
                      // Relation schemas are given by NAME and resolved at render time.
                      projections: [
                        {
                          kind: 'aggregate',
                          path: [
                            {
                              kind: 'unboundTypedRelation',
                              relationSchemaId: 'Risk Affects',
                              direction: 'both'
                            }
                          ],
                          reducer: 'countDistinct',
                          terminal: 'entity',
                          alias: 'Risks'
                        },
                        {
                          kind: 'aggregate',
                          path: [
                            {
                              kind: 'unboundTypedRelation',
                              relationSchemaId: 'Control Protection',
                              direction: 'both'
                            }
                          ],
                          reducer: 'countDistinct',
                          terminal: 'entity',
                          alias: 'Controls'
                        }
                      ]
                    }
                  },
                  x: 6,
                  y: 5,
                  w: 6,
                  h: 24
                }
              ]
            },
            {
              id: 'traceability-risks',
              label: 'Controls × Risks',
              widgets: [
                controlTraceMatrix(
                  'seed-controls-trace-risks',
                  'Controls × Risks — colored by control effectiveness',
                  'Risk',
                  0
                )
              ]
            },
            {
              id: 'traceability-assets',
              label: 'Controls × Data Entities',
              widgets: [
                controlTraceMatrix(
                  'seed-controls-trace-assets',
                  'Controls × Data Entities',
                  'Data Entity',
                  0
                )
              ]
            }
          ]
        },
        x: 0,
        y: 0,
        w: 12,
        h: 46
      }
    ],
    sidebar: {
      kind: 'facets',
      schemaName: 'Control',
      facets: [
        { fieldId: 'Type', variableName: 'types', itemLabel: 'Type' },
        {
          fieldId: 'Operating Effectiveness',
          variableName: 'effectiveness',
          itemLabel: 'Effectiveness'
        }
      ]
    }
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
  [VENDOR_MANAGEMENT_OVERVIEW_APP_KEY]: {
    name: 'Overview',
    description:
      'Contracted spend, upcoming renewals, vendors above risk tolerance and technology end-of-life exposure.',
    widgets: [
      {
        id: 'seed-contracted-spend',
        type: 'AggregateStat',
        config: {
          query: 'schema:Vendor',
          measure: 'sum',
          sumFieldId: 'spend',
          label: 'Contracted spend',
          subtextTemplate: 'across {count} vendors',
          showLink: false
        },
        x: 0,
        y: 0,
        w: 3,
        h: 7
      },
      {
        id: 'seed-renewals-90d',
        type: 'AggregateStat',
        config: {
          query: 'schema:Contract AND contract_end > now(-1) AND contract_end < now(91)',
          subtextQuery: 'schema:Contract AND contract_end > now(-1) AND contract_end < now(91)',
          sumFieldId: 'annual_cost',
          label: 'Renewals in 90 days',
          subtextTemplate: '{subSum} at stake',
          severity: { warnAt: 1 },
          showLink: false
        },
        x: 3,
        y: 0,
        w: 3,
        h: 7
      },
      {
        id: 'seed-above-tolerance',
        type: 'AggregateStat',
        config: {
          query: 'schema:Vendor AND risk >= 3',
          label: 'Vendors above tolerance',
          subtextTemplate: 'elevated or high risk',
          severity: { critAt: 1 },
          showLink: false
        },
        x: 6,
        y: 0,
        w: 3,
        h: 7
      },
      {
        id: 'seed-auto-renewing',
        type: 'AggregateStat',
        config: {
          query: 'schema:Contract AND auto_renew = "true"',
          denominatorQuery: 'schema:Contract',
          display: 'ofTotal',
          label: 'Auto-renewing',
          subtextTemplate: '{count} of {total} contracts · notice periods apply',
          showLink: false
        },
        x: 9,
        y: 0,
        w: 3,
        h: 7
      },
      {
        id: 'seed-renewal-outlook',
        type: 'DateBucketChart',
        config: {
          query: 'schema:Contract',
          dateFieldId: 'contract_end',
          measureFieldId: 'annual_cost',
          bucketCount: 12,
          foldOverdue: true,
          urgentWithinDays: 30,
          label: 'Renewals, next 12 months'
        },
        x: 0,
        y: 7,
        w: 12,
        h: 10
      },
      {
        id: 'seed-next-renewals',
        type: 'UpcomingByDate',
        config: {
          query: 'schema:Contract',
          dateFieldId: 'contract_end',
          includeOverdue: true,
          limit: 7,
          sublabelFieldId: 'vendor',
          valueFieldId: 'annual_cost',
          label: 'Next renewals'
        },
        x: 0,
        y: 17,
        w: 6,
        h: 16
      },
      {
        id: 'seed-spend-by-vendor',
        type: 'TopEntities',
        config: {
          schema: '',
          schemaName: 'Vendor',
          fieldId: 'spend',
          direction: 'desc',
          limit: 8,
          showShareBar: true,
          showLink: false,
          label: 'Spend by vendor'
        },
        x: 6,
        y: 17,
        w: 6,
        h: 16
      },
      {
        id: 'seed-vendors-above-tolerance',
        type: ENTITY_BROWSER_EMBED_WIDGET_TYPE,
        config: {
          title: 'Vendors above tolerance',
          limit: 8,
          q: '',
          conditions: [],
          sort: 'field:Risk:desc',
          view: 'table',
          viewConfigs: { table: { fieldIds: ['Tier', 'Criticality', 'Risk'] } },
          schemaName: 'Vendor',
          entityQuery: {
            root: { kind: 'predicate', path: [], fieldId: 'Risk', op: 'gte', value: 3 }
          }
        },
        x: 0,
        y: 33,
        w: 6,
        h: 18
      },
      {
        id: 'seed-technology-eol',
        type: ENTITY_BROWSER_EMBED_WIDGET_TYPE,
        config: {
          title: 'Technology end-of-life exposure',
          limit: 8,
          q: '',
          conditions: [],
          sort: 'field:EOL Date:asc',
          view: 'table',
          viewConfigs: {
            table: { fieldIds: ['_projection:Technology', 'EOL Date', 'Security Support Until'] }
          },
          schemaName: 'Technology Release',
          entityQuery: {
            root: {
              kind: 'predicate',
              path: [],
              fieldId: 'EOL Date',
              op: 'before',
              value: { $now: true, offsetDays: 365 }
            },
            // The Technology column is a containment reference, which a plain column renders as
            // a raw id; project the parent's name instead.
            projections: [
              {
                path: [{ kind: 'forward', fieldId: 'Technology' }],
                fieldId: '_name',
                alias: 'Technology'
              }
            ]
          }
        },
        x: 6,
        y: 33,
        w: 6,
        h: 18
      }
    ]
  },
  [VENDOR_MANAGEMENT_SPEND_APP_KEY]: {
    name: 'Spend',
    description:
      'Annualised vendor spend, fixed-term commitment and spend roll-ups by vendor or cost centre.',
    widgets: [
      {
        id: 'seed-spend-total',
        type: 'AggregateStat',
        config: {
          query: 'schema:Contract',
          measure: 'sum',
          sumFieldId: 'annual_cost',
          label: 'Total annualised',
          subtextTemplate: '{count} contracts',
          showLink: false
        },
        x: 0,
        y: 0,
        w: 3,
        h: 7
      },
      {
        id: 'seed-spend-fixed-term',
        type: 'AggregateStat',
        config: {
          query: 'schema:Contract AND NOT auto_renew = "true"',
          measure: 'sum',
          sumFieldId: 'annual_cost',
          label: 'Fixed-term commitment',
          subtextTemplate: 'not auto-renewing',
          showLink: false
        },
        x: 3,
        y: 0,
        w: 3,
        h: 7
      },
      {
        id: 'seed-spend-strategic-share',
        type: 'AggregateStat',
        config: {
          query: 'schema:Vendor AND tier = "strategic"',
          denominatorQuery: 'schema:Vendor',
          display: 'percent',
          measure: 'sum',
          sumFieldId: 'spend',
          label: 'Strategic tier',
          subtextTemplate: 'of annualised spend',
          showLink: false
        },
        x: 6,
        y: 0,
        w: 3,
        h: 7
      },
      {
        id: 'seed-spend-cost-centres',
        type: 'AggregateStat',
        config: {
          query: 'schema:Vendor AND spend = not_empty',
          measure: 'countDistinct',
          distinctFieldId: 'cost_centre',
          label: 'Cost centres',
          subtextTemplate: 'with vendor spend',
          showLink: false
        },
        x: 9,
        y: 0,
        w: 3,
        h: 7
      },
      {
        id: 'seed-spend-tabs',
        type: 'tabs',
        config: {
          tabs: [
            {
              id: 'by-vendor',
              label: 'By vendor',
              widgets: [vendorSpendRollup('seed-spend-by-vendor-table')]
            },
            {
              id: 'by-cost-centre',
              label: 'By cost centre',
              widgets: [vendorSpendRollup('seed-spend-by-cost-centre-table', 'cost_centre')]
            }
          ]
        },
        x: 0,
        y: 7,
        w: 12,
        h: 40
      }
    ],
    sidebar: {
      kind: 'facets',
      schemaName: 'Vendor',
      facets: [
        { fieldId: 'Cost Centre', variableName: 'costCentres', itemLabel: 'Cost centre' },
        {
          fieldId: 'Relationship Owner',
          variableName: 'relationshipOwners',
          itemLabel: 'Owner'
        }
      ]
    }
  },
  [VENDOR_MANAGEMENT_RISK_APP_KEY]: {
    name: 'Risk',
    description:
      'Vendor risk by criticality and band, the risk register and technology end-of-life exposure.',
    widgets: [
      {
        id: 'seed-risk-high',
        type: 'AggregateStat',
        config: {
          query: 'schema:Vendor AND risk >= 3.4',
          label: 'High risk',
          subtextTemplate: 'vendors in the high band',
          severity: { critAt: 1 },
          showLink: false
        },
        x: 0,
        y: 0,
        w: 3,
        h: 7
      },
      {
        id: 'seed-risk-concentration',
        type: 'AggregateStat',
        config: {
          query: 'schema:Vendor AND concentration_risk >= 4',
          label: 'Concentration ≥ 4',
          subtextTemplate: 'vendors with high concentration risk',
          severity: { warnAt: 1 },
          showLink: false
        },
        x: 3,
        y: 0,
        w: 3,
        h: 7
      },
      {
        id: 'seed-risk-eol-soon',
        type: 'AggregateStat',
        config: {
          query: 'schema:"Technology Release" AND eol_date < now(366)',
          label: 'Technologies near EOL',
          subtextTemplate: 'end of life within 12 months',
          severity: { warnAt: 1 },
          showLink: false
        },
        x: 6,
        y: 0,
        w: 3,
        h: 7
      },
      {
        id: 'seed-risk-eol-past',
        type: 'AggregateStat',
        config: {
          query: 'schema:"Technology Release" AND eol_date < now(0)',
          label: 'Past end of life',
          subtextTemplate: 'releases already unsupported',
          severity: { critAt: 1 },
          showLink: false
        },
        x: 9,
        y: 0,
        w: 3,
        h: 7
      },
      {
        id: 'seed-risk-matrix',
        type: 'FieldMatrix',
        config: {
          schemaName: 'Vendor',
          entityQuery: vendorRiskFacetQuery,
          rowFieldId: 'criticality',
          rows: [5, 4, 3, 2],
          valueFieldId: 'risk',
          // Mirrors the Vendor risk bands (low < 2.0 <= moderate < 2.7 <= elevated < 3.4 <= high).
          bands: [
            { label: 'Low', min: 0, tone: 'good' },
            { label: 'Moderate', min: 2, tone: 'neutral' },
            { label: 'Elevated', min: 2.7, tone: 'warn', hot: true },
            { label: 'High', min: 3.4, tone: 'bad', hot: true }
          ],
          hotRowMin: 4,
          cornerLabel: 'criticality ↓ / risk →',
          label: 'Criticality × risk'
        },
        x: 0,
        y: 7,
        w: 6,
        h: 22
      },
      {
        id: 'seed-risk-register',
        type: ENTITY_BROWSER_EMBED_WIDGET_TYPE,
        config: {
          title: 'Risk register',
          q: '',
          conditions: [],
          sort: 'field:Risk:desc',
          view: 'table',
          viewConfigs: {
            table: {
              fieldIds: [
                'Security Risk',
                'Concentration Risk',
                'Financial Risk',
                'Compliance Risk',
                'Risk'
              ]
            }
          },
          schemaName: 'Vendor',
          entityQuery: vendorRiskFacetQuery
        },
        x: 6,
        y: 7,
        w: 6,
        h: 22
      },
      {
        id: 'seed-risk-technology-eol',
        type: ENTITY_BROWSER_EMBED_WIDGET_TYPE,
        config: {
          title: 'Technology end-of-life',
          q: '',
          conditions: [],
          sort: 'field:EOL Date:asc',
          view: 'table',
          viewConfigs: {
            table: {
              fieldIds: [
                '_projection:Technology',
                'Radar Status',
                'EOL Date',
                'Security Support Until'
              ]
            }
          },
          schemaName: 'Technology Release',
          entityQuery: {
            root: {
              kind: 'predicate',
              path: [],
              fieldId: 'EOL Date',
              op: 'before',
              value: { $now: true, offsetDays: 365 }
            },
            projections: [
              {
                path: [{ kind: 'forward', fieldId: 'Technology' }],
                fieldId: '_name',
                alias: 'Technology'
              }
            ]
          }
        },
        x: 0,
        y: 29,
        w: 12,
        h: 20
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
  [VENDOR_MANAGEMENT_CONTRACTS_APP_KEY]: {
    name: 'Contracts',
    description: 'Vendor contracts as a register, a renewal calendar and a term timeline.',
    widgets: [
      {
        id: 'seed-contracts-tabs',
        type: 'tabs',
        config: {
          tabs: [
            {
              id: 'list',
              label: 'List',
              widgets: [
                {
                  id: 'seed-contracts-list',
                  type: ENTITY_BROWSER_EMBED_WIDGET_TYPE,
                  config: {
                    q: '',
                    conditions: [],
                    sort: 'field:Contract End:asc',
                    view: 'table',
                    viewConfigs: {
                      table: {
                        fieldIds: [
                          '_projection:Vendor',
                          'Contract Type',
                          'Annual Cost',
                          'Auto Renew',
                          'Contract End'
                        ]
                      }
                    },
                    schemaName: 'Contract',
                    entityQuery: {
                      ...contractFacetQuery,
                      projections: [
                        {
                          path: [{ kind: 'forward' as const, fieldId: 'Vendor' }],
                          fieldId: '_name',
                          alias: 'Vendor'
                        }
                      ]
                    }
                  },
                  x: 0,
                  y: 0,
                  w: 12,
                  h: 40
                }
              ]
            },
            {
              id: 'calendar',
              label: 'Renewal calendar',
              widgets: [
                {
                  id: 'seed-contracts-calendar',
                  type: 'DateCalendar',
                  config: {
                    schemaName: 'Contract',
                    entityQuery: contractFacetQuery,
                    dateFieldId: 'contract_end',
                    period: 'month',
                    periodCount: 12,
                    sublabelFieldId: 'vendor',
                    valueFieldId: 'annual_cost'
                  },
                  x: 0,
                  y: 0,
                  w: 12,
                  h: 40
                }
              ]
            },
            {
              id: 'timeline',
              label: 'Timelines',
              widgets: [
                {
                  id: 'seed-contracts-timeline',
                  type: 'DateRangeTimeline',
                  config: {
                    schemaName: 'Contract',
                    entityQuery: contractFacetQuery,
                    startFieldId: 'contract_start',
                    endFieldId: 'contract_end',
                    sublabelFieldId: 'vendor',
                    valueFieldId: 'annual_cost',
                    markerOffsetFieldId: 'notice_period_days',
                    markerWhenFieldId: 'auto_renew'
                  },
                  x: 0,
                  y: 0,
                  w: 12,
                  h: 40
                }
              ]
            }
          ]
        },
        x: 0,
        y: 0,
        w: 12,
        h: 44
      }
    ],
    sidebar: {
      kind: 'facets',
      schemaName: 'Contract',
      facets: [
        { fieldId: 'Contract Type', variableName: 'contractTypes', itemLabel: 'Type' },
        { fieldId: 'Vendor', variableName: 'vendorIds', itemLabel: 'Vendor' }
      ]
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
