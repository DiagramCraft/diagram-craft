import type { DashboardWidget } from '@arch-register/api-types/dashboardContract';
import type {
  CollectionDbCreate,
  CollectionEntityDbResult,
  SavedViewDbResult
} from '../../domain/catalog/db/catalogDatabase';
import {
  resolveTemplateDashboardWidgets,
  SCHEMA_TEMPLATES
} from '../../domain/catalog/schemaTemplates';
import {
  COLLECTION_IDS,
  DATA_FLOW_SCHEMA_ID,
  LIFECYCLE_IDS,
  SEED_SCHEMA_IDS,
  TEAM_IDS,
  USER_IDS,
  WORKSPACE_ID,
  now
} from './constants';

// #3066: information-governance canonical views. The classification values below are the
// 'pii-classification' enum options with `restricted: true` (see schemaTemplates.ts).
const RESTRICTED_CLASSIFICATION_VALUES = ['sensitive', 'highly-sensitive'];
const CARRIED_DATA_ENTITIES_PATH = [{ kind: 'relationForward' as const, fieldId: 'data_entities' }];

// Matches how the Relations browser's own filter UI narrows by type (RELATION_TYPE_FIELD_ID =
// '_schemaId', see relationBrowserState.ts) rather than a separate top-level `schemaId`, so
// `resolveSingleSchemaFilter` still recognizes these views as scoped to one relation schema.
const dataFlowSchemaPredicate = {
  kind: 'predicate' as const,
  path: [],
  fieldId: '_schemaId',
  op: 'equals' as const,
  value: DATA_FLOW_SCHEMA_ID
};

const seededRiskComplianceTemplate = SCHEMA_TEMPLATES.find(
  template => template.id === 'risk-compliance'
);
const seededRiskComplianceDashboardWidgets = resolveTemplateDashboardWidgets(
  seededRiskComplianceTemplate?.dashboardWidgets ?? [],
  new Map([
    ['risk', '00000000-0000-0000-0000-000000000013'],
    ['compliance_requirement', '00000000-0000-0000-0000-000000000016']
  ])
).map(widget =>
  widget.type === 'Assessments'
    ? {
        ...widget,
        config: {
          ...widget.config,
          assessmentTypeId: '00000000-0000-0000-0024-000000000001'
        }
      }
    : widget
);

// The default workspace's "Overview" dashboard is otherwise seeded lazily on first client visit
// (see web's DEFAULT_SEEDED_WIDGETS). The risk/compliance template owns this complete seeded
// layout, including the generic starter widgets and the risk/compliance widgets from #2848.
export const seedWorkspaceDashboards: {
  id: string;
  workspace: string;
  name: string;
  sort_order: number;
  layout: DashboardWidget[];
}[] = [
  {
    id: '00000000-0000-0000-0022-000000000001',
    workspace: WORKSPACE_ID,
    name: 'Overview',
    sort_order: 0,
    layout: seededRiskComplianceDashboardWidgets
  }
];

export const seedSavedViews: SavedViewDbResult[] = [
  {
    id: '00000000-0000-0000-0020-000000000001',
    workspace: WORKSPACE_ID,
    project_id: null,
    project_scope: null,
    name: 'Production Systems',
    description: 'All systems currently in production',
    is_admin_view: false,
    view_mode: 'table',
    filters: {
      schemaId: '00000000-0000-0000-0000-000000000002',
      root: {
        kind: 'predicate',
        path: [],
        fieldId: '_lifecycle',
        op: 'equals',
        value: LIFECYCLE_IDS.production
      }
    },
    config: null,
    created_at: now,
    updated_at: now
  },
  {
    id: '00000000-0000-0000-0020-000000000002',
    workspace: WORKSPACE_ID,
    project_id: null,
    project_scope: null,
    name: 'Security Radar',
    description: 'Radar view of security-related components',
    is_admin_view: false,
    view_mode: 'radar',
    filters: {
      root: { kind: 'and', children: [] }
    },
    config: {
      radar: {
        schemaId: '00000000-0000-0000-0000-000000000003',
        quadrantFieldId: '_lifecycle',
        ringFieldId: '_lifecycle',
        ringOrder: [
          LIFECYCLE_IDS.proposed,
          LIFECYCLE_IDS.experimental,
          LIFECYCLE_IDS.production,
          LIFECYCLE_IDS.deprecated
        ]
      }
    },
    created_at: now,
    updated_at: now
  },
  {
    id: '00000000-0000-0000-0020-000000000003',
    workspace: WORKSPACE_ID,
    project_id: null,
    project_scope: null,
    name: 'Platform Components',
    description: 'Components owned by Platform Engineering',
    is_admin_view: false,
    view_mode: 'cards',
    filters: {
      schemaId: '00000000-0000-0000-0000-000000000003',
      root: {
        kind: 'predicate',
        path: [],
        fieldId: '_owner',
        op: 'equals',
        value: TEAM_IDS.platform
      }
    },
    config: null,
    created_at: now,
    updated_at: now
  },
  {
    id: '00000000-0000-0000-0020-000000000004',
    workspace: WORKSPACE_ID,
    project_id: null,
    project_scope: null,
    name: 'Technology Radar',
    description: 'Technology releases positioned by category and radar governance status.',
    is_admin_view: false,
    view_mode: 'radar',
    filters: {
      schemaId: '00000000-0000-0000-0000-000000000006',
      root: { kind: 'and', children: [] }
    },
    config: {
      radar: {
        schemaId: '00000000-0000-0000-0000-000000000006',
        quadrantFieldId: 'category',
        ringFieldId: 'radar_status',
        ringOrder: ['adopt', 'trial', 'assess', 'hold']
      }
    },
    created_at: now,
    updated_at: now
  },
  {
    id: '00000000-0000-0000-0020-000000000005',
    workspace: WORKSPACE_ID,
    project_id: null,
    project_scope: null,
    name: 'Technology Lifecycle',
    description: 'Release dates and end-of-life dates for tracked technology releases.',
    is_admin_view: false,
    view_mode: 'timeline',
    filters: {
      schemaId: '00000000-0000-0000-0000-000000000006',
      root: { kind: 'and', children: [] }
    },
    config: {
      timeline: {
        startFieldId: 'release_date',
        endFieldId: 'eol_date',
        groupBy: 'type',
        zoom: 'year'
      }
    },
    created_at: now,
    updated_at: now
  },
  {
    id: '00000000-0000-0000-0020-000000000006',
    workspace: WORKSPACE_ID,
    project_id: null,
    project_scope: null,
    name: 'Technology Releases With EOL Dates',
    description: 'Technology releases with lifecycle dates available for review and planning.',
    is_admin_view: false,
    view_mode: 'table',
    filters: {
      schemaId: '00000000-0000-0000-0000-000000000006',
      root: {
        kind: 'predicate',
        path: [],
        fieldId: 'eol_date',
        op: 'not_empty',
        value: null
      }
    },
    config: null,
    created_at: now,
    updated_at: now
  },
  {
    id: '00000000-0000-0000-0020-000000000007',
    workspace: WORKSPACE_ID,
    project_id: null,
    project_scope: null,
    name: 'Components With At-Risk Technology Releases',
    description:
      'Components linked to technology releases reaching end of life before the next planning cycle.',
    is_admin_view: true,
    view_mode: 'table',
    filters: {
      schemaId: '00000000-0000-0000-0000-000000000003',
      root: {
        kind: 'predicate',
        path: [{ kind: 'forward', fieldId: 'technology_releases' }],
        fieldId: 'eol_date',
        op: 'before',
        value: '2026-06-30'
      },
      projections: [
        {
          path: [{ kind: 'forward', fieldId: 'technology_releases' }],
          fieldId: 'eol_date',
          alias: 'technology_release_eol'
        }
      ]
    },
    config: {
      table: { fieldIds: ['_projection:technology_release_eol'] }
    },
    created_at: now,
    updated_at: now
  },
  {
    id: '00000000-0000-0000-0020-000000000008',
    workspace: WORKSPACE_ID,
    project_id: null,
    project_scope: null,
    name: 'Sensitive Data Flows',
    description: 'Data flow relations carrying sensitive data between systems.',
    is_admin_view: false,
    view_mode: 'table',
    filters: {
      root_kind: 'relation',
      root: {
        kind: 'predicate',
        path: [],
        fieldId: 'data_classification',
        op: 'equals',
        value: 'sensitive'
      }
    },
    config: null,
    created_at: now,
    updated_at: now
  },
  {
    id: '00000000-0000-0000-0020-000000000009',
    workspace: WORKSPACE_ID,
    project_id: null,
    project_scope: null,
    name: 'Restricted Data Flows',
    description:
      'Data flows classified as restricted, or carrying a Data Entity classified as restricted.',
    is_admin_view: true,
    view_mode: 'table',
    filters: {
      root_kind: 'relation',
      root: {
        kind: 'and',
        children: [
          dataFlowSchemaPredicate,
          {
            kind: 'or',
            children: [
              {
                kind: 'predicate',
                path: [],
                fieldId: 'data_classification',
                op: 'in',
                value: RESTRICTED_CLASSIFICATION_VALUES
              },
              {
                kind: 'predicate',
                path: CARRIED_DATA_ENTITIES_PATH,
                fieldId: 'classification',
                op: 'in',
                value: RESTRICTED_CLASSIFICATION_VALUES
              }
            ]
          }
        ]
      },
      projections: [
        {
          path: CARRIED_DATA_ENTITIES_PATH,
          fieldId: 'classification',
          alias: 'carried_entity_classification'
        }
      ]
    },
    config: {
      table: { fieldIds: ['data_classification', '_projection:carried_entity_classification'] }
    },
    created_at: now,
    updated_at: now
  },
  {
    id: '00000000-0000-0000-0020-00000000000a',
    workspace: WORKSPACE_ID,
    project_id: null,
    project_scope: null,
    name: 'Restricted Data Flows (Graph)',
    description:
      'Data flows classified as restricted, or carrying a Data Entity classified as restricted, with carried Data Entities shown alongside the endpoint Systems.',
    is_admin_view: true,
    view_mode: 'graph',
    filters: {
      root_kind: 'relation',
      root: {
        kind: 'and',
        children: [
          dataFlowSchemaPredicate,
          {
            kind: 'or',
            children: [
              {
                kind: 'predicate',
                path: [],
                fieldId: 'data_classification',
                op: 'in',
                value: RESTRICTED_CLASSIFICATION_VALUES
              },
              {
                kind: 'predicate',
                path: CARRIED_DATA_ENTITIES_PATH,
                fieldId: 'classification',
                op: 'in',
                value: RESTRICTED_CLASSIFICATION_VALUES
              }
            ]
          }
        ]
      }
    },
    config: {
      graph: { typedRelationMode: 'entity' }
    },
    created_at: now,
    updated_at: now
  },
  {
    id: '00000000-0000-0000-0020-00000000000b',
    workspace: WORKSPACE_ID,
    project_id: null,
    project_scope: null,
    name: 'Missing Stewardship',
    description: 'Data Entities missing a steward, custodian, or review date.',
    is_admin_view: true,
    view_mode: 'table',
    filters: {
      schemaId: SEED_SCHEMA_IDS.dataEntity,
      root: {
        kind: 'or',
        children: [
          { kind: 'predicate', path: [], fieldId: 'steward', op: 'empty', value: null },
          { kind: 'predicate', path: [], fieldId: 'custodian', op: 'empty', value: null },
          { kind: 'predicate', path: [], fieldId: 'review_date', op: 'empty', value: null }
        ]
      }
    },
    config: null,
    created_at: now,
    updated_at: now
  },
  {
    id: '00000000-0000-0000-0020-00000000000c',
    workspace: WORKSPACE_ID,
    project_id: null,
    project_scope: null,
    name: 'Review Overdue',
    description: 'Data Entities whose stewardship review date has passed.',
    is_admin_view: true,
    view_mode: 'table',
    filters: {
      schemaId: SEED_SCHEMA_IDS.dataEntity,
      root: {
        kind: 'predicate',
        path: [],
        fieldId: 'review_date',
        op: 'before',
        value: { $now: true }
      }
    },
    config: null,
    created_at: now,
    updated_at: now
  },
  {
    id: '00000000-0000-0000-0020-00000000000d',
    workspace: WORKSPACE_ID,
    project_id: null,
    project_scope: null,
    name: 'Cross-Boundary Transfers',
    description: 'Data flows whose source and destination residency regions differ.',
    is_admin_view: true,
    view_mode: 'table',
    filters: {
      root_kind: 'relation',
      root: {
        kind: 'and',
        children: [
          dataFlowSchemaPredicate,
          {
            kind: 'predicate',
            path: [],
            fieldId: 'cross_boundary',
            op: 'equals',
            value: 'cross-boundary'
          }
        ]
      }
    },
    config: {
      table: {
        fieldIds: ['cross_boundary', 'source_residency_region', 'destination_residency_region']
      }
    },
    created_at: now,
    updated_at: now
  },
  {
    id: '00000000-0000-0000-0020-00000000000e',
    workspace: WORKSPACE_ID,
    project_id: null,
    project_scope: null,
    name: 'Cross-Boundary Transfers (Graph)',
    description: 'Data flows whose source and destination residency regions differ.',
    is_admin_view: true,
    view_mode: 'graph',
    filters: {
      root_kind: 'relation',
      root: {
        kind: 'and',
        children: [
          dataFlowSchemaPredicate,
          {
            kind: 'predicate',
            path: [],
            fieldId: 'cross_boundary',
            op: 'equals',
            value: 'cross-boundary'
          }
        ]
      }
    },
    config: null,
    created_at: now,
    updated_at: now
  },
  {
    id: '00000000-0000-0000-0020-00000000000f',
    workspace: WORKSPACE_ID,
    project_id: null,
    project_scope: null,
    name: 'Residency-Invalid Transfers',
    description:
      'Data flows whose destination residency region is not permitted by a carried Data Entity.',
    is_admin_view: true,
    view_mode: 'table',
    filters: {
      root_kind: 'relation',
      root: {
        kind: 'and',
        children: [
          dataFlowSchemaPredicate,
          {
            kind: 'predicate',
            path: [],
            fieldId: 'residency_invalid',
            op: 'equals',
            value: 'invalid'
          }
        ]
      },
      projections: [
        {
          path: CARRIED_DATA_ENTITIES_PATH,
          fieldId: 'permitted_residency_regions',
          alias: 'carried_entity_permitted_regions'
        }
      ]
    },
    config: {
      table: {
        fieldIds: [
          'residency_invalid',
          'destination_residency_region',
          '_projection:carried_entity_permitted_regions'
        ]
      }
    },
    created_at: now,
    updated_at: now
  },
  {
    id: '00000000-0000-0000-0020-000000000010',
    workspace: WORKSPACE_ID,
    project_id: null,
    project_scope: null,
    name: 'Residency-Invalid Transfers (Graph)',
    description:
      'Data flows whose destination residency region is not permitted by a carried Data Entity, with carried Data Entities shown alongside the endpoint Systems.',
    is_admin_view: true,
    view_mode: 'graph',
    filters: {
      root_kind: 'relation',
      root: {
        kind: 'and',
        children: [
          dataFlowSchemaPredicate,
          {
            kind: 'predicate',
            path: [],
            fieldId: 'residency_invalid',
            op: 'equals',
            value: 'invalid'
          }
        ]
      }
    },
    config: {
      graph: { typedRelationMode: 'entity' }
    },
    created_at: now,
    updated_at: now
  }
];

export const seedCollections: CollectionDbCreate[] = [
  {
    id: COLLECTION_IDS.criticalSystems,
    workspace: WORKSPACE_ID,
    user_id: USER_IDS.globaladmin,
    name: 'Critical systems',
    created_at: new Date('2026-01-02T10:00:00.000Z'),
    updated_at: new Date('2026-01-02T10:00:00.000Z')
  },
  {
    id: COLLECTION_IDS.apisToReview,
    workspace: WORKSPACE_ID,
    user_id: USER_IDS.globaladmin,
    name: 'APIs to review',
    created_at: new Date('2026-01-02T10:05:00.000Z'),
    updated_at: new Date('2026-01-02T10:05:00.000Z')
  }
];

export const seedCollectionEntities: CollectionEntityDbResult[] = [
  {
    collection_id: COLLECTION_IDS.criticalSystems,
    entity_id: '00000000-0000-0000-0002-000000000001',
    created_at: new Date('2026-01-02T10:01:00.000Z')
  },
  {
    collection_id: COLLECTION_IDS.criticalSystems,
    entity_id: '00000000-0000-0000-0002-000000000002',
    created_at: new Date('2026-01-02T10:02:00.000Z')
  },
  {
    collection_id: COLLECTION_IDS.apisToReview,
    entity_id: '00000000-0000-0000-0004-000000000001',
    created_at: new Date('2026-01-02T10:06:00.000Z')
  },
  {
    collection_id: COLLECTION_IDS.apisToReview,
    entity_id: '00000000-0000-0000-0004-000000000002',
    created_at: new Date('2026-01-02T10:07:00.000Z')
  }
];
