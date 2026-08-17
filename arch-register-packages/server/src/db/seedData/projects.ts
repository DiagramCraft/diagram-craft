import {
  AR_COLOR_BLUE,
  AR_COLOR_GREEN,
  AR_COLOR_PURPLE,
  AR_COLOR_RED
} from '@arch-register/api-types/colors';
import type { ChangeCaseDbCreate } from '../../domain/catalog/db/changeCaseDatabase';
import type {
  AssessmentDbCreate,
  ProjectDbCreate,
  ProjectEntityDbCreate,
  ProjectMilestoneDbCreate
} from '../../domain/project/db/projectDatabase';
import { seededAssessments, seededProjects, seededSchemas } from '../seedFixtures';
import {
  MILESTONE_IDS,
  PROJECT_ENTITY_TYPE_IDS,
  STRATEGY_IDS,
  TEAM_IDS,
  USER_IDS,
  WORKSPACE_ID,
  now
} from './constants';

export const seedProjects: ProjectDbCreate[] = [
  {
    id: seededProjects.portalRedesign.id,
    workspace: WORKSPACE_ID,
    public_id: seededProjects.portalRedesign.publicId,
    name: seededProjects.portalRedesign.name,
    description: 'Redesign of the customer portal frontend and API layer.',
    owner: TEAM_IDS.design,
    status: 'active',
    color: AR_COLOR_BLUE,
    start_date: null,
    target_date: null,
    pinned: false,
    created_at: now,
    updated_at: now
  },
  {
    id: seededProjects.authMigration.id,
    workspace: WORKSPACE_ID,
    public_id: seededProjects.authMigration.publicId,
    name: seededProjects.authMigration.name,
    description: 'Migration from legacy auth to the new identity platform.',
    owner: TEAM_IDS.security,
    status: 'active',
    color: AR_COLOR_RED,
    start_date: null,
    target_date: null,
    pinned: true,
    created_at: now,
    updated_at: now
  },
  {
    id: seededProjects.checkoutRevamp.id,
    workspace: WORKSPACE_ID,
    public_id: seededProjects.checkoutRevamp.publicId,
    name: seededProjects.checkoutRevamp.name,
    description: 'Modernization of checkout orchestration and payment integrations.',
    owner: TEAM_IDS.platform,
    status: 'active',
    color: AR_COLOR_GREEN,
    start_date: null,
    target_date: null,
    pinned: false,
    created_at: now,
    updated_at: now
  },
  {
    id: seededProjects.searchAnalytics.id,
    workspace: WORKSPACE_ID,
    public_id: seededProjects.searchAnalytics.publicId,
    name: seededProjects.searchAnalytics.name,
    description: 'Rollout of full-text search and a rebuilt analytics warehouse.',
    owner: TEAM_IDS.data,
    status: 'active',
    color: AR_COLOR_PURPLE,
    start_date: null,
    target_date: null,
    pinned: false,
    created_at: now,
    updated_at: now
  }
];

export const seedMilestones: ProjectMilestoneDbCreate[] = [
  {
    id: MILESTONE_IDS.portalRedesign.designFinalized,
    workspace: WORKSPACE_ID,
    project_id: seededProjects.portalRedesign.id,
    name: 'Design finalized',
    target_date: '2026-02-15',
    status: 'complete',
    sort_order: 0,
    created_at: now,
    updated_at: now
  },
  {
    id: MILESTONE_IDS.portalRedesign.frontendRollout,
    workspace: WORKSPACE_ID,
    project_id: seededProjects.portalRedesign.id,
    name: 'Frontend rollout',
    target_date: '2026-04-30',
    status: 'active',
    sort_order: 1,
    created_at: now,
    updated_at: now
  },
  {
    id: MILESTONE_IDS.portalRedesign.legacyPortalDecommission,
    workspace: WORKSPACE_ID,
    project_id: seededProjects.portalRedesign.id,
    name: 'Legacy portal decommission',
    target_date: '2026-08-31',
    status: 'planned',
    sort_order: 2,
    created_at: now,
    updated_at: now
  },
  {
    id: MILESTONE_IDS.authMigration.identityCutover,
    workspace: WORKSPACE_ID,
    project_id: seededProjects.authMigration.id,
    name: 'Identity platform cutover',
    target_date: '2026-03-31',
    status: 'active',
    sort_order: 0,
    created_at: now,
    updated_at: now
  },
  {
    id: MILESTONE_IDS.authMigration.legacyAuthDecommission,
    workspace: WORKSPACE_ID,
    project_id: seededProjects.authMigration.id,
    name: 'Legacy auth decommission',
    target_date: '2026-09-30',
    status: 'planned',
    sort_order: 1,
    created_at: now,
    updated_at: now
  },
  {
    id: MILESTONE_IDS.checkoutRevamp.paymentGatewayIntegration,
    workspace: WORKSPACE_ID,
    project_id: seededProjects.checkoutRevamp.id,
    name: 'Payment gateway integration',
    target_date: '2026-05-15',
    status: 'planned',
    sort_order: 0,
    created_at: now,
    updated_at: now
  },
  {
    id: MILESTONE_IDS.checkoutRevamp.fraudDetectionRollout,
    workspace: WORKSPACE_ID,
    project_id: seededProjects.checkoutRevamp.id,
    name: 'Fraud detection rollout',
    target_date: '2026-07-01',
    status: 'planned',
    sort_order: 1,
    created_at: now,
    updated_at: now
  },
  {
    id: MILESTONE_IDS.searchAnalytics.searchPlatformGa,
    workspace: WORKSPACE_ID,
    project_id: seededProjects.searchAnalytics.id,
    name: 'Search platform GA',
    target_date: '2026-06-01',
    status: 'planned',
    sort_order: 0,
    created_at: now,
    updated_at: now
  },
  {
    id: MILESTONE_IDS.searchAnalytics.analyticsWarehouseMigration,
    workspace: WORKSPACE_ID,
    project_id: seededProjects.searchAnalytics.id,
    name: 'Analytics warehouse migration',
    target_date: '2026-10-01',
    status: 'planned',
    sort_order: 1,
    created_at: now,
    updated_at: now
  }
];

const seedChangeCaseMember = (
  entityId: string,
  baseState: Record<string, unknown>,
  proposedState: Record<string, unknown>
) => ({
  entity_id: entityId,
  base_version: 1,
  base_state: baseState,
  proposed_state: proposedState,
  diff: {}
});

export const seedChangeCases: ChangeCaseDbCreate[] = [
  {
    id: '00000000-0000-0000-0041-000000000001',
    workspace: WORKSPACE_ID,
    project_id: seededProjects.portalRedesign.id,
    name: 'Modernized navigation and IA',
    description: null,
    effective_date: null,
    milestone_id: MILESTONE_IDS.portalRedesign.frontendRollout,
    message: 'Modernized navigation and IA',
    created_at: new Date('2026-01-10T09:00:00.000Z'),
    created_by: USER_IDS.designteamadmin,
    members: [
      seedChangeCaseMember(
        '00000000-0000-0000-0002-000000000001', // Customer Portal
        { description: 'Public-facing portal for customer self-service.' },
        {
          description:
            'Public-facing portal for customer self-service with a modernized reactive frontend and consolidated navigation.'
        }
      )
    ]
  },
  {
    id: '00000000-0000-0000-0041-000000000002',
    workspace: WORKSPACE_ID,
    project_id: seededProjects.portalRedesign.id,
    name: 'Upgrade to React 19 as part of the redesign',
    description: null,
    effective_date: null,
    milestone_id: MILESTONE_IDS.portalRedesign.frontendRollout,
    message: 'Upgrade to React 19 as part of the redesign',
    created_at: new Date('2026-01-10T09:05:00.000Z'),
    created_by: USER_IDS.designteamadmin,
    members: [
      seedChangeCaseMember(
        '00000000-0000-0000-0003-000000000002', // Frontend App
        { technology: 'React', tags: ['react', 'frontend'] },
        { technology: 'React 19', tags: ['react', 'frontend', 'modernized'] }
      )
    ]
  },
  {
    id: '00000000-0000-0000-0041-000000000003',
    workspace: WORKSPACE_ID,
    project_id: seededProjects.portalRedesign.id,
    name: 'Runtime upgrade ahead of frontend rollout',
    description: null,
    effective_date: '2026-03-15',
    milestone_id: null,
    message: 'Runtime upgrade ahead of frontend rollout',
    created_at: new Date('2026-01-10T09:10:00.000Z'),
    created_by: USER_IDS.platformteamadmin,
    members: [
      seedChangeCaseMember(
        '00000000-0000-0000-0003-000000000001', // API Gateway
        { technology: 'Node' },
        { technology: 'Node 22' }
      )
    ]
  },
  {
    id: '00000000-0000-0000-0041-000000000004',
    workspace: WORKSPACE_ID,
    project_id: seededProjects.authMigration.id,
    name: 'Cutover complete, legacy auth fully retired',
    description: null,
    effective_date: null,
    milestone_id: MILESTONE_IDS.authMigration.identityCutover,
    message: 'Cutover complete, legacy auth fully retired',
    created_at: new Date('2026-01-11T10:00:00.000Z'),
    created_by: USER_IDS.securityteamadmin,
    members: [
      seedChangeCaseMember(
        '00000000-0000-0000-0002-000000000002', // Identity Platform
        { description: 'Centralised authentication and authorisation service.' },
        {
          description:
            'Centralised authentication and authorisation service, now the sole identity provider.'
        }
      )
    ]
  },
  {
    id: '00000000-0000-0000-0041-000000000005',
    workspace: WORKSPACE_ID,
    project_id: seededProjects.authMigration.id,
    name: 'Promote to production once cutover completes',
    description: null,
    effective_date: null,
    milestone_id: MILESTONE_IDS.authMigration.identityCutover,
    message: 'Promote to production once cutover completes',
    created_at: new Date('2026-01-11T10:05:00.000Z'),
    created_by: USER_IDS.securityteamadmin,
    members: [
      seedChangeCaseMember(
        '00000000-0000-0000-0003-000000000003', // Auth Service
        { tags: ['go', 'security'] },
        { tags: ['go', 'security', 'primary-idp'] }
      )
    ]
  },
  {
    id: '00000000-0000-0000-0041-000000000006',
    workspace: WORKSPACE_ID,
    project_id: seededProjects.authMigration.id,
    name: 'Add refresh-token rotation ahead of legacy decommission',
    description: null,
    effective_date: '2026-08-01',
    milestone_id: null,
    message: 'Add refresh-token rotation ahead of legacy decommission',
    created_at: new Date('2026-01-11T10:10:00.000Z'),
    created_by: USER_IDS.securityteamadmin,
    members: [
      seedChangeCaseMember(
        '00000000-0000-0000-0004-000000000002', // Auth API
        { description: 'gRPC API for token issuance and validation.' },
        { description: 'gRPC API for token issuance and validation, with refresh-token rotation.' }
      )
    ]
  },
  {
    id: '00000000-0000-0000-0041-000000000007',
    workspace: WORKSPACE_ID,
    project_id: seededProjects.checkoutRevamp.id,
    name: 'Integrate new gateway provider',
    description: null,
    effective_date: null,
    milestone_id: MILESTONE_IDS.checkoutRevamp.paymentGatewayIntegration,
    message: 'Integrate new gateway provider',
    created_at: new Date('2026-01-12T11:00:00.000Z'),
    created_by: USER_IDS.workspaceowner,
    members: [
      seedChangeCaseMember(
        '00000000-0000-0000-0003-000000000004', // Payment Service
        {
          description: 'Orchestrates payment authorization and capture against external providers.'
        },
        {
          description:
            'Orchestrates payment authorization and capture against the new gateway provider.'
        }
      )
    ]
  },
  {
    id: '00000000-0000-0000-0041-000000000008',
    workspace: WORKSPACE_ID,
    project_id: seededProjects.checkoutRevamp.id,
    name: 'Promote to production with new ML risk model',
    description: null,
    effective_date: null,
    milestone_id: MILESTONE_IDS.checkoutRevamp.fraudDetectionRollout,
    message: 'Promote to production with new ML risk model',
    created_at: new Date('2026-01-12T11:05:00.000Z'),
    created_by: USER_IDS.workspaceowner,
    members: [
      seedChangeCaseMember(
        '00000000-0000-0000-0003-000000000006', // Fraud Detection Service
        { description: 'Scores transactions for fraud risk before payment capture.' },
        {
          description:
            'Scores transactions for fraud risk before payment capture, using the new ML risk model.'
        }
      )
    ]
  },
  {
    id: '00000000-0000-0000-0041-000000000009',
    workspace: WORKSPACE_ID,
    project_id: seededProjects.checkoutRevamp.id,
    name: 'Runtime upgrade ahead of gateway integration',
    description: null,
    effective_date: '2026-05-01',
    milestone_id: null,
    message: 'Runtime upgrade ahead of gateway integration',
    created_at: new Date('2026-01-12T11:10:00.000Z'),
    created_by: USER_IDS.workspaceeditor,
    members: [
      seedChangeCaseMember(
        '00000000-0000-0000-0003-000000000005', // Ledger Service
        { technology: 'Java' },
        { technology: 'Java 21' }
      )
    ]
  },
  {
    id: '00000000-0000-0000-0041-00000000000a',
    workspace: WORKSPACE_ID,
    project_id: seededProjects.searchAnalytics.id,
    name: 'GA readiness: typo-tolerant search',
    description: null,
    effective_date: null,
    milestone_id: MILESTONE_IDS.searchAnalytics.searchPlatformGa,
    message: 'GA readiness: typo-tolerant search',
    created_at: new Date('2026-01-13T12:00:00.000Z'),
    created_by: USER_IDS.workspaceeditor,
    members: [
      seedChangeCaseMember(
        '00000000-0000-0000-0003-00000000000b', // Search Service
        { description: 'Serves full-text search queries backed by the Elasticsearch cluster.' },
        {
          description:
            'Serves full-text search queries backed by the Elasticsearch cluster, now with typo-tolerant matching.'
        }
      )
    ]
  },
  {
    id: '00000000-0000-0000-0041-00000000000b',
    workspace: WORKSPACE_ID,
    project_id: seededProjects.searchAnalytics.id,
    name: 'Runtime upgrade for warehouse migration',
    description: null,
    effective_date: null,
    milestone_id: MILESTONE_IDS.searchAnalytics.analyticsWarehouseMigration,
    message: 'Runtime upgrade for warehouse migration',
    created_at: new Date('2026-01-13T12:05:00.000Z'),
    created_by: USER_IDS.workspaceeditor,
    members: [
      seedChangeCaseMember(
        '00000000-0000-0000-0003-000000000007', // Analytics Ingestion Worker
        { technology: 'Python' },
        { technology: 'Python 3.13' }
      )
    ]
  },
  {
    id: '00000000-0000-0000-0041-00000000000c',
    workspace: WORKSPACE_ID,
    project_id: seededProjects.searchAnalytics.id,
    name: 'Rebuild on the new analytics warehouse',
    description: null,
    effective_date: '2026-09-15',
    milestone_id: null,
    message: 'Rebuild on the new analytics warehouse',
    created_at: new Date('2026-01-13T12:10:00.000Z'),
    created_by: USER_IDS.workspaceeditor,
    members: [
      seedChangeCaseMember(
        '00000000-0000-0000-0003-000000000008', // Reporting Dashboard
        { description: 'Internal dashboard surfacing revenue and product analytics.' },
        {
          description:
            'Internal dashboard surfacing revenue and product analytics, rebuilt on the new analytics warehouse.'
        }
      )
    ]
  }
];

export const seedProjectEntities: ProjectEntityDbCreate[] = [
  // Strategy context
  {
    workspace: WORKSPACE_ID,
    project_id: seededProjects.portalRedesign.id,
    entity_id: STRATEGY_IDS.objectives.improveCustomerRetention,
    entity_type_id: null,
    is_done: false,
    created_at: now
  },
  {
    workspace: WORKSPACE_ID,
    project_id: seededProjects.authMigration.id,
    entity_id: STRATEGY_IDS.objectives.strengthenPlatformReliability,
    entity_type_id: null,
    is_done: false,
    created_at: now
  },
  {
    workspace: WORKSPACE_ID,
    project_id: seededProjects.portalRedesign.id,
    entity_id: STRATEGY_IDS.initiatives.portalRedesign,
    entity_type_id: null,
    is_done: false,
    created_at: now
  },
  {
    workspace: WORKSPACE_ID,
    project_id: seededProjects.checkoutRevamp.id,
    entity_id: STRATEGY_IDS.initiatives.observabilityUplift,
    entity_type_id: null,
    is_done: false,
    created_at: now
  },
  // Portal Redesign
  {
    workspace: WORKSPACE_ID,
    project_id: seededProjects.portalRedesign.id,
    entity_id: '00000000-0000-0000-0002-000000000001', // Customer Portal
    entity_type_id: PROJECT_ENTITY_TYPE_IDS.modified,
    is_done: false,
    created_at: now
  },
  {
    workspace: WORKSPACE_ID,
    project_id: seededProjects.portalRedesign.id,
    entity_id: '00000000-0000-0000-0003-000000000002', // Frontend App
    entity_type_id: PROJECT_ENTITY_TYPE_IDS.modified,
    is_done: false,
    created_at: now
  },
  {
    workspace: WORKSPACE_ID,
    project_id: seededProjects.portalRedesign.id,
    entity_id: '00000000-0000-0000-0003-000000000001', // API Gateway
    entity_type_id: PROJECT_ENTITY_TYPE_IDS.used,
    is_done: false,
    created_at: now
  },
  {
    workspace: WORKSPACE_ID,
    project_id: seededProjects.portalRedesign.id,
    entity_id: '00000000-0000-0000-0004-000000000001', // Customer API
    entity_type_id: PROJECT_ENTITY_TYPE_IDS.used,
    is_done: false,
    created_at: now
  },
  {
    workspace: WORKSPACE_ID,
    project_id: seededProjects.portalRedesign.id,
    entity_id: '00000000-0000-0000-0005-000000000002', // Redis Cache
    entity_type_id: PROJECT_ENTITY_TYPE_IDS.introduced,
    is_done: true,
    created_at: now
  },
  {
    workspace: WORKSPACE_ID,
    project_id: seededProjects.portalRedesign.id,
    entity_id: '00000000-0000-0000-0005-000000000008', // CDN
    entity_type_id: PROJECT_ENTITY_TYPE_IDS.introduced,
    is_done: true,
    created_at: now
  },
  // Auth Migration
  {
    workspace: WORKSPACE_ID,
    project_id: seededProjects.authMigration.id,
    entity_id: '00000000-0000-0000-0002-000000000002', // Identity Platform
    entity_type_id: PROJECT_ENTITY_TYPE_IDS.modified,
    is_done: false,
    created_at: now
  },
  {
    workspace: WORKSPACE_ID,
    project_id: seededProjects.authMigration.id,
    entity_id: '00000000-0000-0000-0003-000000000003', // Auth Service
    entity_type_id: PROJECT_ENTITY_TYPE_IDS.introduced,
    is_done: true,
    created_at: now
  },
  {
    workspace: WORKSPACE_ID,
    project_id: seededProjects.authMigration.id,
    entity_id: '00000000-0000-0000-0004-000000000002', // Auth API
    entity_type_id: PROJECT_ENTITY_TYPE_IDS.modified,
    is_done: false,
    created_at: now
  },
  {
    workspace: WORKSPACE_ID,
    project_id: seededProjects.authMigration.id,
    entity_id: '00000000-0000-0000-0002-000000000001', // Customer Portal
    entity_type_id: PROJECT_ENTITY_TYPE_IDS.used,
    is_done: false,
    created_at: now
  },
  {
    workspace: WORKSPACE_ID,
    project_id: seededProjects.authMigration.id,
    entity_id: '00000000-0000-0000-0003-000000000002', // Frontend App
    entity_type_id: PROJECT_ENTITY_TYPE_IDS.used,
    is_done: false,
    created_at: now
  },
  // Checkout Revamp
  {
    workspace: WORKSPACE_ID,
    project_id: seededProjects.checkoutRevamp.id,
    entity_id: '00000000-0000-0000-0002-000000000003', // Payments Platform
    entity_type_id: PROJECT_ENTITY_TYPE_IDS.introduced,
    is_done: true,
    created_at: now
  },
  {
    workspace: WORKSPACE_ID,
    project_id: seededProjects.checkoutRevamp.id,
    entity_id: '00000000-0000-0000-0003-000000000004', // Payment Service
    entity_type_id: PROJECT_ENTITY_TYPE_IDS.introduced,
    is_done: false,
    created_at: now
  },
  {
    workspace: WORKSPACE_ID,
    project_id: seededProjects.checkoutRevamp.id,
    entity_id: '00000000-0000-0000-0003-000000000005', // Ledger Service
    entity_type_id: PROJECT_ENTITY_TYPE_IDS.introduced,
    is_done: true,
    created_at: now
  },
  {
    workspace: WORKSPACE_ID,
    project_id: seededProjects.checkoutRevamp.id,
    entity_id: '00000000-0000-0000-0003-000000000006', // Fraud Detection Service
    entity_type_id: PROJECT_ENTITY_TYPE_IDS.introduced,
    is_done: false,
    created_at: now
  },
  {
    workspace: WORKSPACE_ID,
    project_id: seededProjects.checkoutRevamp.id,
    entity_id: '00000000-0000-0000-0004-000000000003', // Payments API
    entity_type_id: PROJECT_ENTITY_TYPE_IDS.introduced,
    is_done: true,
    created_at: now
  },
  {
    workspace: WORKSPACE_ID,
    project_id: seededProjects.checkoutRevamp.id,
    entity_id: '00000000-0000-0000-0005-000000000005', // Payments Postgres
    entity_type_id: PROJECT_ENTITY_TYPE_IDS.introduced,
    is_done: true,
    created_at: now
  },
  {
    workspace: WORKSPACE_ID,
    project_id: seededProjects.checkoutRevamp.id,
    entity_id: '00000000-0000-0000-0004-000000000002', // Auth API
    entity_type_id: PROJECT_ENTITY_TYPE_IDS.used,
    is_done: false,
    created_at: now
  },
  // Search & Analytics Modernization
  {
    workspace: WORKSPACE_ID,
    project_id: seededProjects.searchAnalytics.id,
    entity_id: '00000000-0000-0000-0002-000000000006', // Search Platform
    entity_type_id: PROJECT_ENTITY_TYPE_IDS.introduced,
    is_done: false,
    created_at: now
  },
  {
    workspace: WORKSPACE_ID,
    project_id: seededProjects.searchAnalytics.id,
    entity_id: '00000000-0000-0000-0003-00000000000b', // Search Service
    entity_type_id: PROJECT_ENTITY_TYPE_IDS.introduced,
    is_done: false,
    created_at: now
  },
  {
    workspace: WORKSPACE_ID,
    project_id: seededProjects.searchAnalytics.id,
    entity_id: '00000000-0000-0000-0003-00000000000c', // Recommendation Engine
    entity_type_id: PROJECT_ENTITY_TYPE_IDS.introduced,
    is_done: false,
    created_at: now
  },
  {
    workspace: WORKSPACE_ID,
    project_id: seededProjects.searchAnalytics.id,
    entity_id: '00000000-0000-0000-0004-000000000006', // Search API
    entity_type_id: PROJECT_ENTITY_TYPE_IDS.introduced,
    is_done: false,
    created_at: now
  },
  {
    workspace: WORKSPACE_ID,
    project_id: seededProjects.searchAnalytics.id,
    entity_id: '00000000-0000-0000-0005-000000000006', // Elasticsearch Cluster
    entity_type_id: PROJECT_ENTITY_TYPE_IDS.introduced,
    is_done: true,
    created_at: now
  },
  {
    workspace: WORKSPACE_ID,
    project_id: seededProjects.searchAnalytics.id,
    entity_id: '00000000-0000-0000-0002-000000000004', // Analytics Platform
    entity_type_id: PROJECT_ENTITY_TYPE_IDS.modified,
    is_done: false,
    created_at: now
  },
  {
    workspace: WORKSPACE_ID,
    project_id: seededProjects.searchAnalytics.id,
    entity_id: '00000000-0000-0000-0003-000000000007', // Analytics Ingestion Worker
    entity_type_id: PROJECT_ENTITY_TYPE_IDS.modified,
    is_done: false,
    created_at: now
  },
  {
    workspace: WORKSPACE_ID,
    project_id: seededProjects.searchAnalytics.id,
    entity_id: '00000000-0000-0000-0003-000000000008', // Reporting Dashboard
    entity_type_id: PROJECT_ENTITY_TYPE_IDS.modified,
    is_done: false,
    created_at: now
  },
  {
    workspace: WORKSPACE_ID,
    project_id: seededProjects.searchAnalytics.id,
    entity_id: '00000000-0000-0000-0004-000000000004', // Analytics API
    entity_type_id: PROJECT_ENTITY_TYPE_IDS.used,
    is_done: false,
    created_at: now
  },
  {
    workspace: WORKSPACE_ID,
    project_id: seededProjects.searchAnalytics.id,
    entity_id: '00000000-0000-0000-0005-000000000007', // Analytics Warehouse
    entity_type_id: PROJECT_ENTITY_TYPE_IDS.introduced,
    is_done: false,
    created_at: now
  },
  {
    workspace: WORKSPACE_ID,
    project_id: seededProjects.searchAnalytics.id,
    entity_id: '00000000-0000-0000-0005-000000000004', // S3 Data Lake
    entity_type_id: PROJECT_ENTITY_TYPE_IDS.used,
    is_done: false,
    created_at: now
  }
];

export const seedAssessments: AssessmentDbCreate[] = [
  {
    id: seededAssessments.checkoutRevamp.securityReadiness.id,
    workspace: WORKSPACE_ID,
    project_id: seededAssessments.checkoutRevamp.securityReadiness.projectId,
    name: seededAssessments.checkoutRevamp.securityReadiness.name,
    description: "Assess each component's security posture ahead of the checkout launch.",
    status: 'open',
    mode: 'fields',
    scope: [seededSchemas.default.component.id],
    scope_conditions: [],
    fields: [
      { id: 'f1', label: 'Secrets management', type: 'rating', requirementLevel: 'required' },
      { id: 'f2', label: 'Last pen-test date', type: 'text', requirementLevel: 'optional' },
      { id: 'f3', label: 'Known vulnerabilities', type: 'text', requirementLevel: 'optional' }
    ],
    groups: [],
    assigned_team_ids: [],
    due_at: null,
    recurrence: { type: 'none' },
    response_window_days: null,
    current_occurrence: 1,
    pending_occurrence_job_run_id: null,
    next_occurrence_at: null,
    created_at: now,
    updated_at: now
  },
  {
    id: seededAssessments.checkoutRevamp.apiFitness.id,
    workspace: WORKSPACE_ID,
    project_id: seededAssessments.checkoutRevamp.apiFitness.projectId,
    name: seededAssessments.checkoutRevamp.apiFitness.name,
    description: 'Rate the fitness of each API for the new checkout flow.',
    status: 'closed',
    mode: 'fields',
    scope: [seededSchemas.default.api.id],
    scope_conditions: [],
    fields: [
      { id: 'f1', label: 'Versioning quality', type: 'rating', requirementLevel: 'required' },
      {
        id: 'f2',
        label: 'API type',
        type: 'enum',
        enumId: '00000000-0000-0000-0000-e00000000001',
        requirementLevel: 'required'
      },
      { id: 'f3', label: 'Notes', type: 'text', requirementLevel: 'optional' }
    ],
    groups: [],
    assigned_team_ids: [],
    due_at: null,
    recurrence: { type: 'none' },
    response_window_days: null,
    current_occurrence: 1,
    pending_occurrence_job_run_id: null,
    next_occurrence_at: null,
    created_at: now,
    updated_at: now
  },
  {
    // Past-due, still-open assessment scoped to the Risk and Control schemas - gives the
    // Assessments dashboard widget (#2860) something to show in the demo dataset.
    id: '00000000-0000-0000-0023-000000000001',
    workspace: WORKSPACE_ID,
    project_id: seededProjects.authMigration.id,
    name: 'Quarterly risk and control review',
    description: 'Reassess risk scores and control effectiveness for the auth migration.',
    status: 'open',
    mode: 'confirm',
    assessment_type_id: '00000000-0000-0000-0024-000000000001',
    scope: ['00000000-0000-0000-0000-000000000013', '00000000-0000-0000-0000-000000000014'],
    scope_conditions: [],
    fields: [],
    groups: [],
    assigned_team_ids: [],
    due_at: new Date('2026-01-15T00:00:00.000Z'),
    recurrence: { type: 'monthly', intervalMonths: 3 },
    response_window_days: null,
    current_occurrence: 1,
    pending_occurrence_job_run_id: null,
    next_occurrence_at: null,
    created_at: now,
    updated_at: now
  }
];
