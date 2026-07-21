import {
  AR_COLOR_GREEN,
  AR_COLOR_BLUE,
  AR_COLOR_ORANGE,
  AR_COLOR_PURPLE,
  AR_COLOR_YELLOW,
  AR_COLOR_RED,
  AR_COLOR_CYAN,
  AR_COLOR_TEAL
} from '@arch-register/api-types/colors';
import {
  TeamMembershipDbResult,
  MemberDbResult,
  WorkspaceDbResult,
  OwnerDbResult,
  LifecycleStateDbResult,
  ProjectEntityTypeDbResult
} from '../domain/workspace/db/workspaceDatabase';
import {
  Entity,
  CollectionDbCreate,
  CollectionEntityDbResult,
  SchemaDbResult,
  SavedViewDbResult,
  WorkspaceEnumDbResult,
  EntitySnapshotDbCreate
} from '../domain/catalog/db/catalogDatabase';
import {
  ProjectDbCreate,
  ContentNodeDbResult,
  AssessmentDbCreate,
  ProjectMilestoneDbCreate,
  ProjectEntityDbCreate
} from '../domain/project/db/projectDatabase';
import { AuditOperation } from '../domain/audit/db/auditDatabase';
import { GlobalRoleAssignmentDbResult } from '../domain/auth/db/authDatabase';
import { AiConfigInputDbUpsert } from '../domain/ai/db/aiDatabase';
import {
  seededAssessments,
  seededProjects,
  seededSchemas,
  seededUsers,
  seededWorkspaces
} from './seedFixtures';

const now = new Date('2026-01-01T00:00:00.000Z');

const WORKSPACE_ID = seededWorkspaces.default.id;
const WORKSPACE2_ID = seededWorkspaces.second.id;

const LIFECYCLE_IDS = {
  proposed: '90000000-0000-0000-0000-000000000011',
  experimental: '90000000-0000-0000-0000-000000000012',
  production: '90000000-0000-0000-0000-000000000013',
  deprecated: '90000000-0000-0000-0000-000000000014'
} as const;

const LIFECYCLE2_IDS = {
  active: '90000000-0000-0000-0000-000000000015',
  beta: '90000000-0000-0000-0000-000000000016',
  stable: '90000000-0000-0000-0000-000000000017',
  retired: '90000000-0000-0000-0000-000000000018'
} as const;

const TEAM_IDS = {
  platform: '90000000-0000-0000-0000-000000000021',
  design: '90000000-0000-0000-0000-000000000022',
  security: '90000000-0000-0000-0000-000000000023',
  data: '90000000-0000-0000-0000-000000000024',
  payments: '90000000-0000-0000-0000-000000000027'
} as const;

const TEAM2_IDS = {
  mobile: '90000000-0000-0000-0000-000000000025',
  backend: '90000000-0000-0000-0000-000000000026'
} as const;

const COLLECTION_IDS = {
  criticalSystems: '00000000-0000-0000-0030-000000000001',
  apisToReview: '00000000-0000-0000-0030-000000000002'
} as const;

const TECHNOLOGY_IDS = {
  nodejs: '00000000-0000-0000-0007-000000000001',
  react: '00000000-0000-0000-0007-000000000002',
  go: '00000000-0000-0000-0007-000000000003',
  python: '00000000-0000-0000-0007-000000000004',
  java: '00000000-0000-0000-0007-000000000005',
  rust: '00000000-0000-0000-0007-000000000006',
  postgresql: '00000000-0000-0000-0007-000000000007',
  redis: '00000000-0000-0000-0007-000000000008',
  kafka: '00000000-0000-0000-0007-000000000009',
  elasticsearch: '00000000-0000-0000-0007-00000000000a'
} as const;

const TECHNOLOGY_RELEASE_IDS = {
  nodejs20: '00000000-0000-0000-0006-000000000001',
  react18: '00000000-0000-0000-0006-000000000002',
  go122: '00000000-0000-0000-0006-000000000003',
  python312: '00000000-0000-0000-0006-000000000004',
  java21: '00000000-0000-0000-0006-000000000005',
  rust182: '00000000-0000-0000-0006-000000000006',
  postgres15: '00000000-0000-0000-0006-000000000007',
  redis7: '00000000-0000-0000-0006-000000000008',
  kafka37: '00000000-0000-0000-0006-000000000009',
  elasticsearch8: '00000000-0000-0000-0006-00000000000a'
} as const;

const USER_IDS = {
  globaladmin: seededUsers.globalAdmin.id,
  workspaceadmin: seededUsers.workspaceAdmin.id,
  workspaceowner: seededUsers.workspaceOwner.id,
  platformteamadmin: seededUsers.platformTeamAdmin.id,
  platformteameditor: seededUsers.platformTeamEditor.id,
  designteamadmin: seededUsers.designTeamAdmin.id,
  securityteamadmin: seededUsers.securityTeamAdmin.id,
  workspaceeditor: seededUsers.workspaceEditor.id,
  workspacereviewer: seededUsers.workspaceReviewer.id,
  workspaceviewer: seededUsers.workspaceViewer.id
} as const;

export const seedIds = {
  workspace: {
    default: WORKSPACE_ID,
    second: WORKSPACE2_ID
  },
  lifecycle: LIFECYCLE_IDS,
  lifecycle2: LIFECYCLE2_IDS,
  teams: TEAM_IDS,
  teams2: TEAM2_IDS,
  collections: COLLECTION_IDS,
  technologies: TECHNOLOGY_IDS,
  technologyReleases: TECHNOLOGY_RELEASE_IDS,
  users: USER_IDS
} as const;

export const seedWorkspaces: WorkspaceDbResult[] = [
  {
    id: WORKSPACE_ID,
    name: seededWorkspaces.default.name,
    url_slug: seededWorkspaces.default.slug,
    short_code: seededWorkspaces.default.shortCode,
    description: seededWorkspaces.default.description,
    color: '',
    created_at: now,
    updated_at: now
  },
  {
    id: WORKSPACE2_ID,
    name: seededWorkspaces.second.name,
    url_slug: seededWorkspaces.second.slug,
    short_code: seededWorkspaces.second.shortCode,
    description: seededWorkspaces.second.description,
    color: '',
    created_at: now,
    updated_at: now
  }
];

export const seedLifecycleStates: LifecycleStateDbResult[] = [
  {
    id: LIFECYCLE_IDS.proposed,
    workspace: WORKSPACE_ID,
    label: 'Proposed',
    color: AR_COLOR_BLUE,
    sort_order: 0,
    created_at: now
  },
  {
    id: LIFECYCLE_IDS.experimental,
    workspace: WORKSPACE_ID,
    label: 'Experimental',
    color: AR_COLOR_BLUE,
    sort_order: 1,
    created_at: now
  },
  {
    id: LIFECYCLE_IDS.production,
    workspace: WORKSPACE_ID,
    label: 'Production',
    color: AR_COLOR_GREEN,
    sort_order: 2,
    created_at: now
  },
  {
    id: LIFECYCLE_IDS.deprecated,
    workspace: WORKSPACE_ID,
    label: 'Deprecated',
    color: AR_COLOR_YELLOW,
    sort_order: 3,
    created_at: now,
    is_deprecated_state: true
  },
  // Second workspace lifecycle states
  {
    id: LIFECYCLE2_IDS.active,
    workspace: WORKSPACE2_ID,
    label: 'Active',
    color: AR_COLOR_BLUE,
    sort_order: 0,
    created_at: now
  },
  {
    id: LIFECYCLE2_IDS.beta,
    workspace: WORKSPACE2_ID,
    label: 'Beta',
    color: AR_COLOR_ORANGE,
    sort_order: 1,
    created_at: now
  },
  {
    id: LIFECYCLE2_IDS.stable,
    workspace: WORKSPACE2_ID,
    label: 'Stable',
    color: AR_COLOR_GREEN,
    sort_order: 2,
    created_at: now
  },
  {
    id: LIFECYCLE2_IDS.retired,
    workspace: WORKSPACE2_ID,
    label: 'Retired',
    color: AR_COLOR_RED,
    sort_order: 3,
    created_at: now,
    is_deprecated_state: true
  }
];

export const seedProjectEntityTypes: ProjectEntityTypeDbResult[] = [
  {
    id: '90000000-0000-0000-0000-000000000201',
    workspace: WORKSPACE_ID,
    label: 'Introduced',
    sort_order: 0,
    created_at: now
  },
  {
    id: '90000000-0000-0000-0000-000000000202',
    workspace: WORKSPACE_ID,
    label: 'Decommissioned',
    sort_order: 1,
    created_at: now
  },
  {
    id: '90000000-0000-0000-0000-000000000203',
    workspace: WORKSPACE_ID,
    label: 'Modified',
    sort_order: 2,
    created_at: now
  },
  {
    id: '90000000-0000-0000-0000-000000000204',
    workspace: WORKSPACE_ID,
    label: 'Used',
    sort_order: 3,
    created_at: now
  },
  {
    id: '90000000-0000-0000-0000-000000000205',
    workspace: WORKSPACE2_ID,
    label: 'Introduced',
    sort_order: 0,
    created_at: now
  },
  {
    id: '90000000-0000-0000-0000-000000000206',
    workspace: WORKSPACE2_ID,
    label: 'Decommissioned',
    sort_order: 1,
    created_at: now
  },
  {
    id: '90000000-0000-0000-0000-000000000207',
    workspace: WORKSPACE2_ID,
    label: 'Modified',
    sort_order: 2,
    created_at: now
  },
  {
    id: '90000000-0000-0000-0000-000000000208',
    workspace: WORKSPACE2_ID,
    label: 'Used',
    sort_order: 3,
    created_at: now
  }
];

const PROJECT_ENTITY_TYPE_IDS = {
  introduced: '90000000-0000-0000-0000-000000000201',
  decommissioned: '90000000-0000-0000-0000-000000000202',
  modified: '90000000-0000-0000-0000-000000000203',
  used: '90000000-0000-0000-0000-000000000204'
} as const;

export const seedOwners: OwnerDbResult[] = [
  {
    id: TEAM_IDS.platform,
    workspace: WORKSPACE_ID,
    name: 'Platform Engineering',
    sort_order: 0,
    color: AR_COLOR_GREEN,
    description: 'Responsible for platform infrastructure and core services',
    created_at: now
  },
  {
    id: TEAM_IDS.design,
    workspace: WORKSPACE_ID,
    name: 'Design Systems',
    sort_order: 1,
    color: AR_COLOR_BLUE,
    description: 'Maintains design system and UI component libraries',
    created_at: now
  },
  {
    id: TEAM_IDS.security,
    workspace: WORKSPACE_ID,
    name: 'Security & Compliance',
    sort_order: 2,
    color: AR_COLOR_RED,
    description: 'Ensures security standards and regulatory compliance',
    created_at: now
  },
  {
    id: TEAM_IDS.data,
    workspace: WORKSPACE_ID,
    name: 'Data Platform',
    sort_order: 3,
    color: AR_COLOR_PURPLE,
    description: 'Manages data infrastructure and analytics pipelines',
    created_at: now
  },
  {
    id: TEAM_IDS.payments,
    workspace: WORKSPACE_ID,
    name: 'Payments Engineering',
    sort_order: 4,
    color: AR_COLOR_ORANGE,
    description: 'Builds and operates payment processing, billing and ledger systems',
    created_at: now
  },
  // Second workspace teams
  {
    id: TEAM2_IDS.mobile,
    workspace: WORKSPACE2_ID,
    name: 'Mobile Team',
    sort_order: 0,
    color: AR_COLOR_TEAL,
    description: 'Develops and maintains iOS and Android applications',
    created_at: now
  },
  {
    id: TEAM2_IDS.backend,
    workspace: WORKSPACE2_ID,
    name: 'Backend Team',
    sort_order: 1,
    color: AR_COLOR_CYAN,
    description: 'Builds and operates backend services and APIs',
    created_at: now
  }
];

export const seedLocalUsers = [
  {
    id: USER_IDS.globaladmin,
    user_id: seededUsers.globalAdmin.userId,
    email: seededUsers.globalAdmin.email,
    display_name: seededUsers.globalAdmin.displayName,
    color: seededUsers.globalAdmin.color
  },
  {
    id: USER_IDS.workspaceadmin,
    user_id: seededUsers.workspaceAdmin.userId,
    email: seededUsers.workspaceAdmin.email,
    display_name: seededUsers.workspaceAdmin.displayName,
    color: seededUsers.workspaceAdmin.color
  },
  {
    id: USER_IDS.workspaceowner,
    user_id: seededUsers.workspaceOwner.userId,
    email: seededUsers.workspaceOwner.email,
    display_name: seededUsers.workspaceOwner.displayName,
    color: seededUsers.workspaceOwner.color
  },
  {
    id: USER_IDS.platformteamadmin,
    user_id: seededUsers.platformTeamAdmin.userId,
    email: seededUsers.platformTeamAdmin.email,
    display_name: seededUsers.platformTeamAdmin.displayName,
    color: seededUsers.platformTeamAdmin.color
  },
  {
    id: USER_IDS.platformteameditor,
    user_id: seededUsers.platformTeamEditor.userId,
    email: seededUsers.platformTeamEditor.email,
    display_name: seededUsers.platformTeamEditor.displayName,
    color: seededUsers.platformTeamEditor.color
  },
  {
    id: USER_IDS.designteamadmin,
    user_id: seededUsers.designTeamAdmin.userId,
    email: seededUsers.designTeamAdmin.email,
    display_name: seededUsers.designTeamAdmin.displayName,
    color: seededUsers.designTeamAdmin.color
  },
  {
    id: USER_IDS.securityteamadmin,
    user_id: seededUsers.securityTeamAdmin.userId,
    email: seededUsers.securityTeamAdmin.email,
    display_name: seededUsers.securityTeamAdmin.displayName,
    color: seededUsers.securityTeamAdmin.color
  },
  {
    id: USER_IDS.workspaceeditor,
    user_id: seededUsers.workspaceEditor.userId,
    email: seededUsers.workspaceEditor.email,
    display_name: seededUsers.workspaceEditor.displayName,
    color: seededUsers.workspaceEditor.color
  },
  {
    id: USER_IDS.workspacereviewer,
    user_id: seededUsers.workspaceReviewer.userId,
    email: seededUsers.workspaceReviewer.email,
    display_name: seededUsers.workspaceReviewer.displayName,
    color: seededUsers.workspaceReviewer.color
  },
  {
    id: USER_IDS.workspaceviewer,
    user_id: seededUsers.workspaceViewer.userId,
    email: seededUsers.workspaceViewer.email,
    display_name: seededUsers.workspaceViewer.displayName,
    color: seededUsers.workspaceViewer.color
  }
] as const;

export const seedTeamAssignments: TeamMembershipDbResult[] = [
  // Platform Engineering
  {
    workspace: WORKSPACE_ID,
    team_id: TEAM_IDS.platform,
    user_id: USER_IDS.platformteamadmin,
    role: 'team_admin',
    created_at: now
  },
  {
    workspace: WORKSPACE_ID,
    team_id: TEAM_IDS.platform,
    user_id: USER_IDS.platformteameditor,
    role: 'team_editor',
    created_at: now
  },
  {
    workspace: WORKSPACE_ID,
    team_id: TEAM_IDS.platform,
    user_id: USER_IDS.workspaceeditor,
    role: 'team_reviewer',
    created_at: now
  },
  {
    workspace: WORKSPACE_ID,
    team_id: TEAM_IDS.platform,
    user_id: USER_IDS.globaladmin,
    role: 'team_admin',
    created_at: now
  },

  // Design Systems
  {
    workspace: WORKSPACE_ID,
    team_id: TEAM_IDS.design,
    user_id: USER_IDS.designteamadmin,
    role: 'team_admin',
    created_at: now
  },
  {
    workspace: WORKSPACE_ID,
    team_id: TEAM_IDS.design,
    user_id: USER_IDS.workspacereviewer,
    role: 'team_editor',
    created_at: now
  },
  {
    workspace: WORKSPACE_ID,
    team_id: TEAM_IDS.design,
    user_id: USER_IDS.workspaceviewer,
    role: 'team_reviewer',
    created_at: now
  },

  // Security & Compliance
  {
    workspace: WORKSPACE_ID,
    team_id: TEAM_IDS.security,
    user_id: USER_IDS.securityteamadmin,
    role: 'team_admin',
    created_at: now
  },
  {
    workspace: WORKSPACE_ID,
    team_id: TEAM_IDS.security,
    user_id: USER_IDS.workspaceadmin,
    role: 'team_editor',
    created_at: now
  },
  {
    workspace: WORKSPACE_ID,
    team_id: TEAM_IDS.security,
    user_id: USER_IDS.globaladmin,
    role: 'team_reviewer',
    created_at: now
  },

  // Data Platform
  {
    workspace: WORKSPACE_ID,
    team_id: TEAM_IDS.data,
    user_id: USER_IDS.workspaceowner,
    role: 'team_admin',
    created_at: now
  },
  {
    workspace: WORKSPACE_ID,
    team_id: TEAM_IDS.data,
    user_id: USER_IDS.workspaceeditor,
    role: 'team_editor',
    created_at: now
  },
  {
    workspace: WORKSPACE_ID,
    team_id: TEAM_IDS.data,
    user_id: USER_IDS.workspaceviewer,
    role: 'team_reviewer',
    created_at: now
  }
];

export const seedGlobalRoleAssignments: GlobalRoleAssignmentDbResult[] = [
  { user_id: USER_IDS.globaladmin, role: 'global_admin', created_at: now },
  { user_id: USER_IDS.globaladmin, role: 'workspace_admin', created_at: now },
  { user_id: USER_IDS.workspaceadmin, role: 'workspace_admin', created_at: now }
];

export const seedWorkspaceMembers: MemberDbResult[] = [
  { workspace: WORKSPACE_ID, user_id: USER_IDS.workspaceowner, role: 'owner', created_at: now },
  { workspace: WORKSPACE_ID, user_id: USER_IDS.globaladmin, role: 'admin', created_at: now },
  { workspace: WORKSPACE_ID, user_id: USER_IDS.workspaceadmin, role: 'admin', created_at: now },
  {
    workspace: WORKSPACE_ID,
    user_id: USER_IDS.platformteamadmin,
    role: 'editor',
    created_at: now
  },
  {
    workspace: WORKSPACE_ID,
    user_id: USER_IDS.platformteameditor,
    role: 'editor',
    created_at: now
  },
  { workspace: WORKSPACE_ID, user_id: USER_IDS.designteamadmin, role: 'editor', created_at: now },
  {
    workspace: WORKSPACE_ID,
    user_id: USER_IDS.securityteamadmin,
    role: 'editor',
    created_at: now
  },
  { workspace: WORKSPACE_ID, user_id: USER_IDS.workspaceeditor, role: 'editor', created_at: now },
  {
    workspace: WORKSPACE_ID,
    user_id: USER_IDS.workspacereviewer,
    role: 'reviewer',
    created_at: now
  },
  { workspace: WORKSPACE_ID, user_id: USER_IDS.workspaceviewer, role: 'viewer', created_at: now },
  // Second workspace members
  { workspace: WORKSPACE2_ID, user_id: USER_IDS.globaladmin, role: 'admin', created_at: now },
  { workspace: WORKSPACE2_ID, user_id: USER_IDS.workspaceadmin, role: 'admin', created_at: now },
  {
    workspace: WORKSPACE2_ID,
    user_id: USER_IDS.platformteamadmin,
    role: 'editor',
    created_at: now
  },
  { workspace: WORKSPACE2_ID, user_id: USER_IDS.designteamadmin, role: 'editor', created_at: now },
  { workspace: WORKSPACE2_ID, user_id: USER_IDS.workspaceeditor, role: 'editor', created_at: now },
  { workspace: WORKSPACE2_ID, user_id: USER_IDS.workspaceviewer, role: 'viewer', created_at: now }
];

export const seedEnums: WorkspaceEnumDbResult[] = [
  {
    id: '00000000-0000-0000-0000-e00000000001',
    workspace: WORKSPACE_ID,
    name: 'API Type',
    options: [
      { value: 'openapi', label: 'OpenAPI' },
      { value: 'grpc', label: 'gRPC' },
      { value: 'graphql', label: 'GraphQL' },
      { value: 'asyncapi', label: 'AsyncAPI' }
    ],
    sort_order: 0,
    created_at: now,
    updated_at: now
  },
  {
    id: '00000000-0000-0000-0000-e00000000003',
    workspace: WORKSPACE_ID,
    name: 'Technology Category',
    options: [
      { value: 'language', label: 'Language' },
      { value: 'framework', label: 'Framework' },
      { value: 'database', label: 'Database' },
      { value: 'operating-system', label: 'Operating System' },
      { value: 'runtime', label: 'Runtime' },
      { value: 'library', label: 'Library' }
    ],
    sort_order: 1,
    created_at: now,
    updated_at: now
  },
  {
    id: '00000000-0000-0000-0000-e00000000004',
    workspace: WORKSPACE_ID,
    name: 'Technology Radar Status',
    options: [
      { value: 'adopt', label: 'Adopt' },
      { value: 'trial', label: 'Trial' },
      { value: 'assess', label: 'Assess' },
      { value: 'hold', label: 'Hold' }
    ],
    sort_order: 2,
    created_at: now,
    updated_at: now
  },
  // Second workspace enums
  {
    id: '00000000-0000-0000-0000-e00000000002',
    workspace: WORKSPACE2_ID,
    name: 'Platform',
    options: [
      { value: 'ios', label: 'iOS' },
      { value: 'android', label: 'Android' },
      { value: 'web', label: 'Web' }
    ],
    sort_order: 0,
    created_at: now,
    updated_at: now
  }
];

export const seedSchemas: SchemaDbResult[] = [
  {
    id: '00000000-0000-0000-0000-000000000001',
    workspace: WORKSPACE_ID,
    name: 'Domain',
    description: 'A high-level grouping that owns one or more Systems.',
    fields: [],
    color: AR_COLOR_YELLOW,
    icon: 'globe',
    default_owner: null,
    key_prefix: 'DOM',
    created_at: now,
    updated_at: now
  },
  {
    id: '00000000-0000-0000-0000-000000000002',
    workspace: WORKSPACE_ID,
    name: 'System',
    description:
      'A collection of resources that exposes one or more APIs to users and other Systems.',
    fields: [
      {
        id: 'domain',
        name: 'Domain',
        type: 'containment',
        predicate: 'belongs to',
        schemaId: '00000000-0000-0000-0000-000000000001',
        minCount: 1,
        maxCount: 1
      }
    ],
    color: AR_COLOR_PURPLE,
    icon: 'layers',
    default_owner: null,
    key_prefix: 'SYS',
    created_at: now,
    updated_at: now
  },
  {
    id: '00000000-0000-0000-0000-000000000003',
    workspace: WORKSPACE_ID,
    name: 'Component',
    description: 'A deployable unit of code within a System (service, library, website, etc.).',
    fields: [
      {
        id: 'technology_releases',
        name: 'Technology Releases',
        type: 'reference',
        predicate: 'uses',
        schemaId: '00000000-0000-0000-0000-000000000006',
        minCount: 0,
        maxCount: -1
      },
      {
        id: 'system',
        name: 'System',
        type: 'containment',
        predicate: 'belongs to',
        schemaId: '00000000-0000-0000-0000-000000000002',
        minCount: 1,
        maxCount: 1
      },
      {
        id: 'provides_apis',
        name: 'Provided APIs',
        type: 'reference',
        predicate: 'provides',
        schemaId: '00000000-0000-0000-0000-000000000004',
        minCount: 0,
        maxCount: -1
      },
      {
        id: 'consumes_apis',
        name: 'Consumed APIs',
        type: 'reference',
        predicate: 'consumes',
        schemaId: '00000000-0000-0000-0000-000000000004',
        minCount: 0,
        maxCount: -1
      },
      {
        id: 'depends_on',
        name: 'Depends On',
        type: 'reference',
        predicate: 'depends on',
        schemaId: '00000000-0000-0000-0000-000000000003',
        minCount: 0,
        maxCount: -1
      }
    ],
    color: AR_COLOR_GREEN,
    icon: 'box',
    default_owner: null,
    key_prefix: 'CMP',
    created_at: now,
    updated_at: now
  },
  {
    id: '00000000-0000-0000-0000-000000000004',
    workspace: WORKSPACE_ID,
    name: 'API',
    description: 'A machine-readable interface definition (OpenAPI, gRPC, GraphQL, AsyncAPI).',
    fields: [
      {
        id: 'api_type',
        name: 'Type',
        type: 'select',
        enumId: '00000000-0000-0000-0000-e00000000001'
      },
      {
        id: 'system',
        name: 'System',
        type: 'containment',
        predicate: 'belongs to',
        schemaId: '00000000-0000-0000-0000-000000000002',
        minCount: 1,
        maxCount: 1
      }
    ],
    color: AR_COLOR_BLUE,
    icon: 'api',
    default_owner: null,
    key_prefix: 'API',
    created_at: now,
    updated_at: now
  },
  {
    id: '00000000-0000-0000-0000-000000000005',
    workspace: WORKSPACE_ID,
    name: 'Resource',
    description: 'Infrastructure a System depends on (database, cache, queue, blob storage, etc.).',
    fields: [
      { id: 'resource_type', name: 'Type', type: 'text' },
      {
        id: 'technology_releases',
        name: 'Technology Releases',
        type: 'reference',
        predicate: 'uses',
        schemaId: '00000000-0000-0000-0000-000000000006',
        minCount: 0,
        maxCount: -1
      },
      {
        id: 'system',
        name: 'System',
        type: 'containment',
        predicate: 'belongs to',
        schemaId: '00000000-0000-0000-0000-000000000002',
        minCount: 0,
        maxCount: 1
      }
    ],
    color: AR_COLOR_ORANGE,
    icon: 'database',
    default_owner: null,
    key_prefix: 'RES',
    created_at: now,
    updated_at: now
  },
  {
    id: '00000000-0000-0000-0000-000000000007',
    workspace: WORKSPACE_ID,
    name: 'Technology',
    description: 'A technology product tracked for governance and planning.',
    fields: [
      { id: 'product', name: 'Product', type: 'text' },
      { id: 'provider_product', name: 'Provider Product Key', type: 'text' },
      {
        id: 'category',
        name: 'Category',
        type: 'select',
        enumId: '00000000-0000-0000-0000-e00000000003'
      },
      {
        id: 'radar_status',
        name: 'Radar Status',
        type: 'select',
        enumId: '00000000-0000-0000-0000-e00000000004'
      }
    ],
    color: AR_COLOR_BLUE,
    icon: 'chip',
    default_owner: null,
    key_prefix: 'TECH',
    created_at: now,
    updated_at: now
  },
  {
    id: '00000000-0000-0000-0000-000000000006',
    workspace: WORKSPACE_ID,
    name: 'Technology Release',
    description:
      'A product release cycle tracked for support lifecycle, technology radar governance, and planning.',
    fields: [
      {
        id: 'technology',
        name: 'Technology',
        type: 'containment',
        predicate: 'belongs to',
        schemaId: '00000000-0000-0000-0000-000000000007',
        minCount: 1,
        maxCount: 1
      },
      { id: 'product', name: 'Product', type: 'text' },
      { id: 'provider_product', name: 'Provider Product Key', type: 'text' },
      { id: 'release_cycle', name: 'Release Cycle', type: 'text' },
      {
        id: 'latest_version',
        name: 'Latest Version',
        type: 'text'
      },
      {
        id: 'release_date',
        name: 'Release Date',
        type: 'date'
      },
      {
        id: 'active_support_until',
        name: 'Active Support Until',
        type: 'date'
      },
      {
        id: 'security_support_until',
        name: 'Security Support Until',
        type: 'date'
      },
      {
        id: 'eol_date',
        name: 'EOL Date',
        type: 'date'
      },
      {
        id: 'source_url',
        name: 'Source URL',
        type: 'text'
      },
      {
        id: 'last_synchronized',
        name: 'Last Synchronized',
        type: 'date'
      },
      {
        id: 'category',
        name: 'Category',
        type: 'select',
        enumId: '00000000-0000-0000-0000-e00000000003'
      },
      {
        id: 'radar_status',
        name: 'Radar Status',
        type: 'select',
        enumId: '00000000-0000-0000-0000-e00000000004'
      }
    ],
    color: AR_COLOR_BLUE,
    icon: 'cpu',
    default_owner: null,
    key_prefix: 'TEC',
    created_at: now,
    updated_at: now
  },
  // Second workspace schemas
  {
    id: '00000000-0000-0000-0000-000000000011',
    workspace: WORKSPACE2_ID,
    name: 'Application',
    description: 'A mobile or web application delivered to end users.',
    fields: [
      {
        id: 'platform',
        name: 'Platform',
        type: 'select',
        enumId: '00000000-0000-0000-0000-e00000000002'
      }
    ],
    color: AR_COLOR_TEAL,
    icon: 'box',
    default_owner: null,
    key_prefix: 'APP',
    created_at: now,
    updated_at: now
  },
  {
    id: '00000000-0000-0000-0000-000000000012',
    workspace: WORKSPACE2_ID,
    name: 'Service',
    description: 'A backend service or microservice.',
    fields: [{ id: 'technology', name: 'Technology', type: 'text' }],
    color: AR_COLOR_CYAN,
    icon: 'layers',
    default_owner: null,
    key_prefix: 'SVC',
    created_at: now,
    updated_at: now
  }
];

const seedTechnologies: Entity[] = [
  {
    id: TECHNOLOGY_IDS.nodejs,
    workspace: WORKSPACE_ID,
    public_id: 'TECH-1',
    slug: 'nodejs',
    namespace: 'default',
    name: 'Node.js',
    description: 'JavaScript runtime built on Chrome\'s V8 JavaScript engine.',
    owner: TEAM_IDS.platform,
    lifecycle: LIFECYCLE_IDS.production,
    target_lifecycle: null,
    target_lifecycle_date: null,
    tags: ['runtime', 'javascript'],
    links: [{ url: 'https://nodejs.org', title: 'Official site', type: 'website' }],
    schema_id: '00000000-0000-0000-0000-000000000007',
    data: {
      product: 'Node.js',
      provider_product: 'nodejs',
      category: 'runtime',
      radar_status: 'adopt'
    },
    visibility_mode: null,
    created_at: now,
    updated_at: now
  },
  {
    id: TECHNOLOGY_IDS.react,
    workspace: WORKSPACE_ID,
    public_id: 'TECH-2',
    slug: 'react',
    namespace: 'default',
    name: 'React',
    description: 'A JavaScript library for building user interfaces.',
    owner: TEAM_IDS.design,
    lifecycle: LIFECYCLE_IDS.production,
    target_lifecycle: null,
    target_lifecycle_date: null,
    tags: ['framework', 'frontend'],
    links: [{ url: 'https://react.dev', title: 'Official site', type: 'website' }],
    schema_id: '00000000-0000-0000-0000-000000000007',
    data: {
      product: 'React',
      provider_product: 'react',
      category: 'framework',
      radar_status: 'adopt'
    },
    visibility_mode: null,
    created_at: now,
    updated_at: now
  },
  {
    id: TECHNOLOGY_IDS.go,
    workspace: WORKSPACE_ID,
    public_id: 'TECH-3',
    slug: 'go',
    namespace: 'default',
    name: 'Go',
    description: 'An open source programming language that makes it easy to build simple, reliable, and efficient software.',
    owner: TEAM_IDS.platform,
    lifecycle: LIFECYCLE_IDS.production,
    target_lifecycle: null,
    target_lifecycle_date: null,
    tags: ['language', 'backend'],
    links: [{ url: 'https://go.dev', title: 'Official site', type: 'website' }],
    schema_id: '00000000-0000-0000-0000-000000000007',
    data: {
      product: 'Go',
      provider_product: 'go',
      category: 'language',
      radar_status: 'adopt'
    },
    visibility_mode: null,
    created_at: now,
    updated_at: now
  },
  {
    id: TECHNOLOGY_IDS.python,
    workspace: WORKSPACE_ID,
    public_id: 'TECH-4',
    slug: 'python',
    namespace: 'default',
    name: 'Python',
    description: 'A programming language that lets you work quickly and integrate systems more effectively.',
    owner: TEAM_IDS.data,
    lifecycle: LIFECYCLE_IDS.production,
    target_lifecycle: null,
    target_lifecycle_date: null,
    tags: ['language', 'data'],
    links: [{ url: 'https://www.python.org', title: 'Official site', type: 'website' }],
    schema_id: '00000000-0000-0000-0000-000000000007',
    data: {
      product: 'Python',
      provider_product: 'python',
      category: 'language',
      radar_status: 'adopt'
    },
    visibility_mode: null,
    created_at: now,
    updated_at: now
  },
  {
    id: TECHNOLOGY_IDS.java,
    workspace: WORKSPACE_ID,
    public_id: 'TECH-5',
    slug: 'java',
    namespace: 'default',
    name: 'Java',
    description: 'A high-level, class-based, object-oriented programming language.',
    owner: TEAM_IDS.payments,
    lifecycle: LIFECYCLE_IDS.production,
    target_lifecycle: null,
    target_lifecycle_date: null,
    tags: ['language', 'backend'],
    links: [{ url: 'https://www.java.com', title: 'Official site', type: 'website' }],
    schema_id: '00000000-0000-0000-0000-000000000007',
    data: {
      product: 'Java',
      provider_product: 'java',
      category: 'language',
      radar_status: 'adopt'
    },
    visibility_mode: null,
    created_at: now,
    updated_at: now
  },
  {
    id: TECHNOLOGY_IDS.rust,
    workspace: WORKSPACE_ID,
    public_id: 'TECH-6',
    slug: 'rust',
    namespace: 'default',
    name: 'Rust',
    description: 'A language empowering everyone to build reliable and efficient software.',
    owner: TEAM_IDS.platform,
    lifecycle: LIFECYCLE_IDS.experimental,
    target_lifecycle: LIFECYCLE_IDS.production,
    target_lifecycle_date: '2026-06-30',
    tags: ['language', 'backend'],
    links: [{ url: 'https://www.rust-lang.org', title: 'Official site', type: 'website' }],
    schema_id: '00000000-0000-0000-0000-000000000007',
    data: {
      product: 'Rust',
      provider_product: 'rust',
      category: 'language',
      radar_status: 'trial'
    },
    visibility_mode: null,
    created_at: now,
    updated_at: now
  },
  {
    id: TECHNOLOGY_IDS.postgresql,
    workspace: WORKSPACE_ID,
    public_id: 'TECH-7',
    slug: 'postgresql',
    namespace: 'default',
    name: 'PostgreSQL',
    description: 'The world\'s most advanced open source relational database.',
    owner: TEAM_IDS.platform,
    lifecycle: LIFECYCLE_IDS.production,
    target_lifecycle: null,
    target_lifecycle_date: null,
    tags: ['database', 'managed'],
    links: [{ url: 'https://www.postgresql.org', title: 'Official site', type: 'website' }],
    schema_id: '00000000-0000-0000-0000-000000000007',
    data: {
      product: 'PostgreSQL',
      provider_product: 'postgresql',
      category: 'database',
      radar_status: 'adopt'
    },
    visibility_mode: null,
    created_at: now,
    updated_at: now
  },
  {
    id: TECHNOLOGY_IDS.redis,
    workspace: WORKSPACE_ID,
    public_id: 'TECH-8',
    slug: 'redis',
    namespace: 'default',
    name: 'Redis',
    description: 'An open source, in-memory data structure store.',
    owner: TEAM_IDS.platform,
    lifecycle: LIFECYCLE_IDS.production,
    target_lifecycle: null,
    target_lifecycle_date: null,
    tags: ['database', 'cache'],
    links: [{ url: 'https://redis.io', title: 'Official site', type: 'website' }],
    schema_id: '00000000-0000-0000-0000-000000000007',
    data: {
      product: 'Redis',
      provider_product: 'redis',
      category: 'database',
      radar_status: 'adopt'
    },
    visibility_mode: null,
    created_at: now,
    updated_at: now
  },
  {
    id: TECHNOLOGY_IDS.kafka,
    workspace: WORKSPACE_ID,
    public_id: 'TECH-9',
    slug: 'kafka',
    namespace: 'default',
    name: 'Apache Kafka',
    description: 'An open-source distributed event streaming platform.',
    owner: TEAM_IDS.platform,
    lifecycle: LIFECYCLE_IDS.production,
    target_lifecycle: null,
    target_lifecycle_date: null,
    tags: ['messaging', 'managed'],
    links: [{ url: 'https://kafka.apache.org', title: 'Official site', type: 'website' }],
    schema_id: '00000000-0000-0000-0000-000000000007',
    data: {
      product: 'Apache Kafka',
      provider_product: 'apache-kafka',
      category: 'runtime',
      radar_status: 'assess'
    },
    visibility_mode: null,
    created_at: now,
    updated_at: now
  },
  {
    id: TECHNOLOGY_IDS.elasticsearch,
    workspace: WORKSPACE_ID,
    public_id: 'TECH-10',
    slug: 'elasticsearch',
    namespace: 'default',
    name: 'Elasticsearch',
    description: 'A distributed, RESTful search and analytics engine.',
    owner: TEAM_IDS.platform,
    lifecycle: LIFECYCLE_IDS.experimental,
    target_lifecycle: null,
    target_lifecycle_date: null,
    tags: ['database', 'search'],
    links: [{ url: 'https://www.elastic.co/elasticsearch', title: 'Official site', type: 'website' }],
    schema_id: '00000000-0000-0000-0000-000000000007',
    data: {
      product: 'Elasticsearch',
      provider_product: 'elasticsearch',
      category: 'database',
      radar_status: 'assess'
    },
    visibility_mode: null,
    created_at: now,
    updated_at: now
  }
];

const seedTechnologyReleases: Entity[] = [
  {
    id: TECHNOLOGY_RELEASE_IDS.nodejs20,
    workspace: WORKSPACE_ID,
    public_id: 'TEC-1',
    slug: 'nodejs-20',
    namespace: 'default',
    name: 'Node.js 20',
    description: 'Node.js 20 release cycle tracked for runtime support planning.',
    owner: TEAM_IDS.platform,
    lifecycle: LIFECYCLE_IDS.production,
    target_lifecycle: null,
    target_lifecycle_date: null,
    tags: ['runtime', 'javascript'],
    links: [{ url: 'https://endoflife.date/nodejs', title: 'Lifecycle source', type: 'source' }],
    schema_id: '00000000-0000-0000-0000-000000000006',
    data: {
      technology: [TECHNOLOGY_IDS.nodejs],
      provider_product: 'nodejs',
      release_cycle: '20',
      latest_version: '20.19.0',
      release_date: '2023-04-18',
      active_support_until: '2024-10-22',
      security_support_until: '2026-04-30',
      eol_date: '2026-04-30',
      source_url: 'https://endoflife.date/nodejs',
      last_synchronized: '2026-01-01',
      category: 'runtime',
      radar_status: 'adopt'
    },
    visibility_mode: null,
    created_at: now,
    updated_at: now
  },
  {
    id: TECHNOLOGY_RELEASE_IDS.react18,
    workspace: WORKSPACE_ID,
    public_id: 'TEC-2',
    slug: 'react-18',
    namespace: 'default',
    name: 'React 18',
    description: 'React 18 release cycle tracked for frontend support planning.',
    owner: TEAM_IDS.design,
    lifecycle: LIFECYCLE_IDS.production,
    target_lifecycle: null,
    target_lifecycle_date: null,
    tags: ['framework', 'frontend'],
    links: [{ url: 'https://endoflife.date/react', title: 'Lifecycle source', type: 'source' }],
    schema_id: '00000000-0000-0000-0000-000000000006',
    data: {
      technology: [TECHNOLOGY_IDS.react],
      provider_product: 'react',
      release_cycle: '18',
      latest_version: '18.3.1',
      release_date: '2022-06-14',
      active_support_until: '2025-12-31',
      security_support_until: '2025-12-31',
      eol_date: '2025-12-31',
      source_url: 'https://endoflife.date/react',
      last_synchronized: '2026-01-01',
      category: 'framework',
      radar_status: 'adopt'
    },
    visibility_mode: null,
    created_at: now,
    updated_at: now
  },
  {
    id: TECHNOLOGY_RELEASE_IDS.go122,
    workspace: WORKSPACE_ID,
    public_id: 'TEC-3',
    slug: 'go-1-22',
    namespace: 'default',
    name: 'Go 1.22',
    description: 'Go 1.22 release cycle tracked for service support planning.',
    owner: TEAM_IDS.platform,
    lifecycle: LIFECYCLE_IDS.production,
    target_lifecycle: null,
    target_lifecycle_date: null,
    tags: ['language', 'backend'],
    links: [{ url: 'https://endoflife.date/go', title: 'Lifecycle source', type: 'source' }],
    schema_id: '00000000-0000-0000-0000-000000000006',
    data: {
      technology: [TECHNOLOGY_IDS.go],
      provider_product: 'go',
      release_cycle: '1.22',
      latest_version: '1.22.12',
      release_date: '2024-02-06',
      active_support_until: '2025-02-01',
      security_support_until: '2025-02-01',
      eol_date: '2025-02-01',
      source_url: 'https://endoflife.date/go',
      last_synchronized: '2026-01-01',
      category: 'language',
      radar_status: 'adopt'
    },
    visibility_mode: null,
    created_at: now,
    updated_at: now
  },
  {
    id: TECHNOLOGY_RELEASE_IDS.python312,
    workspace: WORKSPACE_ID,
    public_id: 'TEC-4',
    slug: 'python-3-12',
    namespace: 'default',
    name: 'Python 3.12',
    description: 'Python 3.12 release cycle tracked for service support planning.',
    owner: TEAM_IDS.data,
    lifecycle: LIFECYCLE_IDS.production,
    target_lifecycle: null,
    target_lifecycle_date: null,
    tags: ['language', 'data'],
    links: [{ url: 'https://endoflife.date/python', title: 'Lifecycle source', type: 'source' }],
    schema_id: '00000000-0000-0000-0000-000000000006',
    data: {
      technology: [TECHNOLOGY_IDS.python],
      provider_product: 'python',
      release_cycle: '3.12',
      latest_version: '3.12.9',
      release_date: '2023-10-02',
      active_support_until: '2024-10-07',
      security_support_until: '2028-10-31',
      eol_date: '2028-10-31',
      source_url: 'https://endoflife.date/python',
      last_synchronized: '2026-01-01',
      category: 'language',
      radar_status: 'adopt'
    },
    visibility_mode: null,
    created_at: now,
    updated_at: now
  },
  {
    id: TECHNOLOGY_RELEASE_IDS.java21,
    workspace: WORKSPACE_ID,
    public_id: 'TEC-5',
    slug: 'java-21',
    namespace: 'default',
    name: 'Java 21',
    description: 'Java 21 release cycle tracked for service support planning.',
    owner: TEAM_IDS.payments,
    lifecycle: LIFECYCLE_IDS.production,
    target_lifecycle: null,
    target_lifecycle_date: null,
    tags: ['language', 'backend'],
    links: [{ url: 'https://endoflife.date/java', title: 'Lifecycle source', type: 'source' }],
    schema_id: '00000000-0000-0000-0000-000000000006',
    data: {
      technology: [TECHNOLOGY_IDS.java],
      provider_product: 'java',
      release_cycle: '21',
      latest_version: '21.0.5',
      release_date: '2023-09-19',
      active_support_until: '2028-09-30',
      security_support_until: '2031-09-30',
      eol_date: '2031-09-30',
      source_url: 'https://endoflife.date/java',
      last_synchronized: '2026-01-01',
      category: 'language',
      radar_status: 'adopt'
    },
    visibility_mode: null,
    created_at: now,
    updated_at: now
  },
  {
    id: TECHNOLOGY_RELEASE_IDS.rust182,
    workspace: WORKSPACE_ID,
    public_id: 'TEC-6',
    slug: 'rust-1-82',
    namespace: 'default',
    name: 'Rust 1.82',
    description: 'Rust 1.82 release cycle tracked for service support planning.',
    owner: TEAM_IDS.platform,
    lifecycle: LIFECYCLE_IDS.experimental,
    target_lifecycle: LIFECYCLE_IDS.production,
    target_lifecycle_date: '2026-06-30',
    tags: ['language', 'backend'],
    links: [{ url: 'https://endoflife.date/rust', title: 'Lifecycle source', type: 'source' }],
    schema_id: '00000000-0000-0000-0000-000000000006',
    data: {
      technology: [TECHNOLOGY_IDS.rust],
      provider_product: 'rust',
      release_cycle: '1.82',
      latest_version: '1.82.0',
      release_date: '2024-10-17',
      active_support_until: '2025-04-17',
      security_support_until: '2025-04-17',
      eol_date: '2025-04-17',
      source_url: 'https://endoflife.date/rust',
      last_synchronized: '2026-01-01',
      category: 'language',
      radar_status: 'trial'
    },
    visibility_mode: null,
    created_at: now,
    updated_at: now
  },
  {
    id: TECHNOLOGY_RELEASE_IDS.postgres15,
    workspace: WORKSPACE_ID,
    public_id: 'TEC-7',
    slug: 'postgresql-15',
    namespace: 'default',
    name: 'PostgreSQL 15',
    description: 'PostgreSQL 15 release cycle tracked for database support planning.',
    owner: TEAM_IDS.platform,
    lifecycle: LIFECYCLE_IDS.production,
    target_lifecycle: null,
    target_lifecycle_date: null,
    tags: ['database', 'managed'],
    links: [
      { url: 'https://endoflife.date/postgresql', title: 'Lifecycle source', type: 'source' }
    ],
    schema_id: '00000000-0000-0000-0000-000000000006',
    data: {
      technology: [TECHNOLOGY_IDS.postgresql],
      provider_product: 'postgresql',
      release_cycle: '15',
      latest_version: '15.10',
      release_date: '2022-10-13',
      active_support_until: '2026-11-11',
      security_support_until: '2027-11-11',
      eol_date: '2027-11-11',
      source_url: 'https://endoflife.date/postgresql',
      last_synchronized: '2026-01-01',
      category: 'database',
      radar_status: 'adopt'
    },
    visibility_mode: null,
    created_at: now,
    updated_at: now
  },
  {
    id: TECHNOLOGY_RELEASE_IDS.redis7,
    workspace: WORKSPACE_ID,
    public_id: 'TEC-8',
    slug: 'redis-7',
    namespace: 'default',
    name: 'Redis 7',
    description: 'Redis 7 release cycle tracked for cache support planning.',
    owner: TEAM_IDS.platform,
    lifecycle: LIFECYCLE_IDS.production,
    target_lifecycle: null,
    target_lifecycle_date: null,
    tags: ['database', 'cache'],
    links: [{ url: 'https://endoflife.date/redis', title: 'Lifecycle source', type: 'source' }],
    schema_id: '00000000-0000-0000-0000-000000000006',
    data: {
      technology: [TECHNOLOGY_IDS.redis],
      provider_product: 'redis',
      release_cycle: '7',
      latest_version: '7.2.6',
      release_date: '2022-04-27',
      active_support_until: '2026-04-30',
      security_support_until: '2027-04-30',
      eol_date: '2027-04-30',
      source_url: 'https://endoflife.date/redis',
      last_synchronized: '2026-01-01',
      category: 'database',
      radar_status: 'adopt'
    },
    visibility_mode: null,
    created_at: now,
    updated_at: now
  },
  {
    id: TECHNOLOGY_RELEASE_IDS.kafka37,
    workspace: WORKSPACE_ID,
    public_id: 'TEC-9',
    slug: 'kafka-3-7',
    namespace: 'default',
    name: 'Kafka 3.7',
    description: 'Kafka 3.7 release cycle tracked for messaging support planning.',
    owner: TEAM_IDS.platform,
    lifecycle: LIFECYCLE_IDS.production,
    target_lifecycle: null,
    target_lifecycle_date: null,
    tags: ['messaging', 'managed'],
    links: [
      { url: 'https://endoflife.date/apache-kafka', title: 'Lifecycle source', type: 'source' }
    ],
    schema_id: '00000000-0000-0000-0000-000000000006',
    data: {
      technology: [TECHNOLOGY_IDS.kafka],
      provider_product: 'apache-kafka',
      release_cycle: '3.7',
      latest_version: '3.7.2',
      release_date: '2024-02-28',
      active_support_until: '2025-02-28',
      security_support_until: '2025-02-28',
      eol_date: '2025-02-28',
      source_url: 'https://endoflife.date/apache-kafka',
      last_synchronized: '2026-01-01',
      category: 'runtime',
      radar_status: 'assess'
    },
    visibility_mode: null,
    created_at: now,
    updated_at: now
  },
  {
    id: TECHNOLOGY_RELEASE_IDS.elasticsearch8,
    workspace: WORKSPACE_ID,
    public_id: 'TEC-10',
    slug: 'elasticsearch-8',
    namespace: 'default',
    name: 'Elasticsearch 8',
    description: 'Elasticsearch 8 release cycle tracked for search support planning.',
    owner: TEAM_IDS.platform,
    lifecycle: LIFECYCLE_IDS.experimental,
    target_lifecycle: null,
    target_lifecycle_date: null,
    tags: ['database', 'search'],
    links: [
      { url: 'https://endoflife.date/elasticsearch', title: 'Lifecycle source', type: 'source' }
    ],
    schema_id: '00000000-0000-0000-0000-000000000006',
    data: {
      technology: [TECHNOLOGY_IDS.elasticsearch],
      provider_product: 'elasticsearch',
      release_cycle: '8',
      latest_version: '8.15.3',
      release_date: '2022-08-23',
      active_support_until: '2026-08-31',
      security_support_until: '2027-08-31',
      eol_date: '2027-08-31',
      source_url: 'https://endoflife.date/elasticsearch',
      last_synchronized: '2026-01-01',
      category: 'database',
      radar_status: 'assess'
    },
    visibility_mode: null,
    created_at: now,
    updated_at: now
  }
];

export const seedEntities: Entity[] = [
  ...seedTechnologies,
  ...seedTechnologyReleases,
  {
    id: '00000000-0000-0000-0001-000000000001',
    workspace: WORKSPACE_ID,
    public_id: 'DOM-1',
    slug: 'engineering',
    namespace: 'default',
    name: 'Engineering',
    description:
      'The core engineering domain covering all customer-facing products and infrastructure.',
    owner: TEAM_IDS.platform,
    lifecycle: LIFECYCLE_IDS.production,
    target_lifecycle: null,
    target_lifecycle_date: null,
    tags: ['core', 'customer-facing'],
    links: [],
    schema_id: '00000000-0000-0000-0000-000000000001',
    data: {},
    visibility_mode: null,
    created_at: now,
    updated_at: now
  },
  {
    id: '00000000-0000-0000-0002-000000000001',
    workspace: WORKSPACE_ID,
    public_id: 'SYS-1',
    slug: 'customer-portal',
    namespace: 'default',
    name: 'Customer Portal',
    description: 'Public-facing portal for customer self-service.',
    owner: TEAM_IDS.design,
    lifecycle: LIFECYCLE_IDS.production,
    target_lifecycle: LIFECYCLE_IDS.deprecated,
    target_lifecycle_date: '2026-12-31',
    tags: ['tier-0', 'customer-facing'],
    links: [{ url: 'https://wiki.example.com/customer-portal', title: 'Wiki', type: 'docs' }],
    schema_id: '00000000-0000-0000-0000-000000000002',
    data: { domain: ['00000000-0000-0000-0001-000000000001'] },
    visibility_mode: null,
    created_at: now,
    updated_at: now
  },
  {
    id: '00000000-0000-0000-0002-000000000002',
    workspace: WORKSPACE_ID,
    public_id: 'SYS-2',
    slug: 'identity-platform',
    namespace: 'default',
    name: 'Identity Platform',
    description: 'Centralised authentication and authorisation service.',
    owner: TEAM_IDS.security,
    lifecycle: LIFECYCLE_IDS.production,
    target_lifecycle: null,
    target_lifecycle_date: null,
    tags: ['tier-0', 'security'],
    links: [],
    schema_id: '00000000-0000-0000-0000-000000000002',
    data: { domain: ['00000000-0000-0000-0001-000000000001'] },
    visibility_mode: null,
    created_at: now,
    updated_at: now
  },
  {
    id: '00000000-0000-0000-0004-000000000001',
    workspace: WORKSPACE_ID,
    public_id: 'API-1',
    slug: 'customer-api',
    namespace: 'default',
    name: 'Customer API',
    description: 'REST API exposing customer data to the portal frontend.',
    owner: TEAM_IDS.platform,
    lifecycle: LIFECYCLE_IDS.production,
    target_lifecycle: null,
    target_lifecycle_date: null,
    tags: ['rest', 'public'],
    links: [{ url: 'https://api.example.com/docs/customer', title: 'API Docs', type: 'docs' }],
    schema_id: '00000000-0000-0000-0000-000000000004',
    data: { api_type: 'openapi', system: ['00000000-0000-0000-0002-000000000001'] },
    visibility_mode: null,
    created_at: now,
    updated_at: now
  },
  {
    id: '00000000-0000-0000-0004-000000000002',
    workspace: WORKSPACE_ID,
    public_id: 'API-2',
    slug: 'auth-api',
    namespace: 'default',
    name: 'Auth API',
    description: 'gRPC API for token issuance and validation.',
    owner: TEAM_IDS.security,
    lifecycle: LIFECYCLE_IDS.production,
    target_lifecycle: null,
    target_lifecycle_date: null,
    tags: ['grpc', 'internal'],
    links: [],
    schema_id: '00000000-0000-0000-0000-000000000004',
    data: { api_type: 'grpc', system: ['00000000-0000-0000-0002-000000000002'] },
    visibility_mode: null,
    created_at: now,
    updated_at: now
  },
  {
    id: '00000000-0000-0000-0003-000000000001',
    workspace: WORKSPACE_ID,
    public_id: 'CMP-1',
    slug: 'api-gateway',
    namespace: 'default',
    name: 'API Gateway',
    description: 'Edge gateway that routes requests and enforces rate limits.',
    owner: TEAM_IDS.platform,
    lifecycle: LIFECYCLE_IDS.production,
    target_lifecycle: null,
    target_lifecycle_date: null,
    tags: ['nodejs', 'tier-0'],
    links: [{ url: 'https://github.com/example/api-gateway', title: 'Source', type: 'source' }],
    schema_id: '00000000-0000-0000-0000-000000000003',
    data: {
      technology_releases: [TECHNOLOGY_RELEASE_IDS.nodejs20],
      system: ['00000000-0000-0000-0002-000000000001'],
      provides_apis: ['00000000-0000-0000-0004-000000000001'],
      consumes_apis: ['00000000-0000-0000-0004-000000000002'],
      depends_on: ['00000000-0000-0000-0003-000000000003']
    },
    visibility_mode: null,
    created_at: now,
    updated_at: now
  },
  {
    id: '00000000-0000-0000-0003-000000000002',
    workspace: WORKSPACE_ID,
    public_id: 'CMP-2',
    slug: 'frontend-app',
    namespace: 'default',
    name: 'Frontend App',
    description: 'React single-page application served to end users.',
    owner: TEAM_IDS.design,
    lifecycle: LIFECYCLE_IDS.production,
    target_lifecycle: LIFECYCLE_IDS.deprecated,
    target_lifecycle_date: '2026-12-31',
    tags: ['react', 'frontend'],
    links: [],
    schema_id: '00000000-0000-0000-0000-000000000003',
    data: {
      technology_releases: [TECHNOLOGY_RELEASE_IDS.react18],
      system: ['00000000-0000-0000-0002-000000000001'],
      consumes_apis: [
        '00000000-0000-0000-0004-000000000001',
        '00000000-0000-0000-0004-000000000002'
      ],
      depends_on: ['00000000-0000-0000-0003-000000000001', '00000000-0000-0000-0003-000000000003']
    },
    visibility_mode: null,
    created_at: now,
    updated_at: now
  },
  {
    id: '00000000-0000-0000-0003-000000000003',
    workspace: WORKSPACE_ID,
    public_id: 'CMP-3',
    slug: 'auth-service',
    namespace: 'default',
    name: 'Auth Service',
    description: 'Issues and validates JWTs; integrates with the identity platform.',
    owner: TEAM_IDS.security,
    lifecycle: LIFECYCLE_IDS.experimental,
    target_lifecycle: LIFECYCLE_IDS.production,
    target_lifecycle_date: '2026-09-30',
    tags: ['go', 'security'],
    links: [],
    schema_id: '00000000-0000-0000-0000-000000000003',
    data: {
      technology_releases: [TECHNOLOGY_RELEASE_IDS.go122],
      system: ['00000000-0000-0000-0002-000000000002'],
      provides_apis: ['00000000-0000-0000-0004-000000000002']
    },
    visibility_mode: null,
    created_at: now,
    updated_at: now
  },
  {
    id: '00000000-0000-0000-0005-000000000001',
    workspace: WORKSPACE_ID,
    public_id: 'RES-1',
    slug: 'postgres-main',
    namespace: 'default',
    name: 'Postgres Main',
    description: 'Primary PostgreSQL cluster used by the Customer Portal system.',
    owner: TEAM_IDS.platform,
    lifecycle: LIFECYCLE_IDS.production,
    target_lifecycle: null,
    target_lifecycle_date: null,
    tags: ['postgres', 'managed'],
    links: [
      { url: 'https://grafana.example.com/d/postgres-main', title: 'Dashboard', type: 'dashboard' }
    ],
    schema_id: '00000000-0000-0000-0000-000000000005',
    data: {
      resource_type: 'database',
      technology_releases: [TECHNOLOGY_RELEASE_IDS.postgres15],
      system: ['00000000-0000-0000-0002-000000000001']
    },
    visibility_mode: null,
    created_at: now,
    updated_at: now
  },
  // Payments domain
  {
    id: '00000000-0000-0000-0001-000000000002',
    workspace: WORKSPACE_ID,
    public_id: 'DOM-2',
    slug: 'payments',
    namespace: 'default',
    name: 'Payments',
    description: 'Payment processing, billing and ledger systems for the checkout experience.',
    owner: TEAM_IDS.payments,
    lifecycle: LIFECYCLE_IDS.production,
    target_lifecycle: null,
    target_lifecycle_date: null,
    tags: ['core', 'revenue'],
    links: [],
    schema_id: '00000000-0000-0000-0000-000000000001',
    data: {},
    visibility_mode: null,
    created_at: now,
    updated_at: now
  },
  {
    id: '00000000-0000-0000-0001-000000000003',
    workspace: WORKSPACE_ID,
    public_id: 'DOM-3',
    slug: 'data-and-analytics',
    namespace: 'default',
    name: 'Data & Analytics',
    description: 'Ingestion, warehousing and reporting for company-wide analytics.',
    owner: TEAM_IDS.data,
    lifecycle: LIFECYCLE_IDS.production,
    target_lifecycle: null,
    target_lifecycle_date: null,
    tags: ['core', 'internal'],
    links: [],
    schema_id: '00000000-0000-0000-0000-000000000001',
    data: {},
    visibility_mode: null,
    created_at: now,
    updated_at: now
  },
  // Additional systems
  {
    id: '00000000-0000-0000-0002-000000000003',
    workspace: WORKSPACE_ID,
    public_id: 'SYS-3',
    slug: 'payments-platform',
    namespace: 'default',
    name: 'Payments Platform',
    description: 'Handles payment authorization, capture, refunds and ledger reconciliation.',
    owner: TEAM_IDS.payments,
    lifecycle: LIFECYCLE_IDS.production,
    target_lifecycle: null,
    target_lifecycle_date: null,
    tags: ['tier-0', 'revenue'],
    links: [],
    schema_id: '00000000-0000-0000-0000-000000000002',
    data: { domain: ['00000000-0000-0000-0001-000000000002'] },
    visibility_mode: null,
    created_at: now,
    updated_at: now
  },
  {
    id: '00000000-0000-0000-0002-000000000004',
    workspace: WORKSPACE_ID,
    public_id: 'SYS-4',
    slug: 'analytics-platform',
    namespace: 'default',
    name: 'Analytics Platform',
    description: 'Ingests events from product systems and powers internal reporting.',
    owner: TEAM_IDS.data,
    lifecycle: LIFECYCLE_IDS.production,
    target_lifecycle: null,
    target_lifecycle_date: null,
    tags: ['tier-1', 'internal'],
    links: [],
    schema_id: '00000000-0000-0000-0000-000000000002',
    data: { domain: ['00000000-0000-0000-0001-000000000003'] },
    visibility_mode: null,
    created_at: now,
    updated_at: now
  },
  {
    id: '00000000-0000-0000-0002-000000000005',
    workspace: WORKSPACE_ID,
    public_id: 'SYS-5',
    slug: 'notification-hub',
    namespace: 'default',
    name: 'Notification Hub',
    description: 'Centralised outbound messaging: push, email and webhooks.',
    owner: TEAM_IDS.platform,
    lifecycle: LIFECYCLE_IDS.production,
    target_lifecycle: null,
    target_lifecycle_date: null,
    tags: ['tier-1', 'messaging'],
    links: [],
    schema_id: '00000000-0000-0000-0000-000000000002',
    data: { domain: ['00000000-0000-0000-0001-000000000001'] },
    visibility_mode: null,
    created_at: now,
    updated_at: now
  },
  {
    id: '00000000-0000-0000-0002-000000000006',
    workspace: WORKSPACE_ID,
    public_id: 'SYS-6',
    slug: 'search-platform',
    namespace: 'default',
    name: 'Search Platform',
    description: 'Full-text search and recommendations across the product catalog.',
    owner: TEAM_IDS.platform,
    lifecycle: LIFECYCLE_IDS.experimental,
    target_lifecycle: LIFECYCLE_IDS.production,
    target_lifecycle_date: '2026-06-01',
    tags: ['tier-1', 'search'],
    links: [],
    schema_id: '00000000-0000-0000-0000-000000000002',
    data: { domain: ['00000000-0000-0000-0001-000000000001'] },
    visibility_mode: null,
    created_at: now,
    updated_at: now
  },
  // Additional APIs
  {
    id: '00000000-0000-0000-0004-000000000003',
    workspace: WORKSPACE_ID,
    public_id: 'API-3',
    slug: 'payments-api',
    namespace: 'default',
    name: 'Payments API',
    description: 'REST API for authorizing and capturing payments.',
    owner: TEAM_IDS.payments,
    lifecycle: LIFECYCLE_IDS.production,
    target_lifecycle: null,
    target_lifecycle_date: null,
    tags: ['rest', 'internal'],
    links: [],
    schema_id: '00000000-0000-0000-0000-000000000004',
    data: { api_type: 'openapi', system: ['00000000-0000-0000-0002-000000000003'] },
    visibility_mode: null,
    created_at: now,
    updated_at: now
  },
  {
    id: '00000000-0000-0000-0004-000000000004',
    workspace: WORKSPACE_ID,
    public_id: 'API-4',
    slug: 'analytics-api',
    namespace: 'default',
    name: 'Analytics API',
    description: 'GraphQL API exposing aggregated analytics data to internal dashboards.',
    owner: TEAM_IDS.data,
    lifecycle: LIFECYCLE_IDS.production,
    target_lifecycle: null,
    target_lifecycle_date: null,
    tags: ['graphql', 'internal'],
    links: [],
    schema_id: '00000000-0000-0000-0000-000000000004',
    data: { api_type: 'graphql', system: ['00000000-0000-0000-0002-000000000004'] },
    visibility_mode: null,
    created_at: now,
    updated_at: now
  },
  {
    id: '00000000-0000-0000-0004-000000000005',
    workspace: WORKSPACE_ID,
    public_id: 'API-5',
    slug: 'notifications-api',
    namespace: 'default',
    name: 'Notifications API',
    description: 'AsyncAPI event contract for push, email and webhook delivery.',
    owner: TEAM_IDS.platform,
    lifecycle: LIFECYCLE_IDS.production,
    target_lifecycle: null,
    target_lifecycle_date: null,
    tags: ['asyncapi', 'messaging'],
    links: [],
    schema_id: '00000000-0000-0000-0000-000000000004',
    data: { api_type: 'asyncapi', system: ['00000000-0000-0000-0002-000000000005'] },
    visibility_mode: null,
    created_at: now,
    updated_at: now
  },
  {
    id: '00000000-0000-0000-0004-000000000006',
    workspace: WORKSPACE_ID,
    public_id: 'API-6',
    slug: 'search-api',
    namespace: 'default',
    name: 'Search API',
    description: 'REST API for full-text search and typeahead suggestions.',
    owner: TEAM_IDS.platform,
    lifecycle: LIFECYCLE_IDS.experimental,
    target_lifecycle: null,
    target_lifecycle_date: null,
    tags: ['rest', 'search'],
    links: [],
    schema_id: '00000000-0000-0000-0000-000000000004',
    data: { api_type: 'openapi', system: ['00000000-0000-0000-0002-000000000006'] },
    visibility_mode: null,
    created_at: now,
    updated_at: now
  },
  // Additional components
  {
    id: '00000000-0000-0000-0003-000000000004',
    workspace: WORKSPACE_ID,
    public_id: 'CMP-4',
    slug: 'payment-service',
    namespace: 'default',
    name: 'Payment Service',
    description: 'Orchestrates payment authorization and capture against external providers.',
    owner: TEAM_IDS.payments,
    lifecycle: LIFECYCLE_IDS.production,
    target_lifecycle: null,
    target_lifecycle_date: null,
    tags: ['go', 'revenue'],
    links: [],
    schema_id: '00000000-0000-0000-0000-000000000003',
    data: {
      technology_releases: [TECHNOLOGY_RELEASE_IDS.go122],
      system: ['00000000-0000-0000-0002-000000000003'],
      provides_apis: ['00000000-0000-0000-0004-000000000003'],
      consumes_apis: ['00000000-0000-0000-0004-000000000002'],
      depends_on: ['00000000-0000-0000-0003-000000000005']
    },
    visibility_mode: null,
    created_at: now,
    updated_at: now
  },
  {
    id: '00000000-0000-0000-0003-000000000005',
    workspace: WORKSPACE_ID,
    public_id: 'CMP-5',
    slug: 'ledger-service',
    namespace: 'default',
    name: 'Ledger Service',
    description: 'Double-entry ledger recording all payment and refund transactions.',
    owner: TEAM_IDS.payments,
    lifecycle: LIFECYCLE_IDS.production,
    target_lifecycle: null,
    target_lifecycle_date: null,
    tags: ['java', 'revenue'],
    links: [],
    schema_id: '00000000-0000-0000-0000-000000000003',
    data: {
      technology_releases: [TECHNOLOGY_RELEASE_IDS.java21],
      system: ['00000000-0000-0000-0002-000000000003']
    },
    visibility_mode: null,
    created_at: now,
    updated_at: now
  },
  {
    id: '00000000-0000-0000-0003-000000000006',
    workspace: WORKSPACE_ID,
    public_id: 'CMP-6',
    slug: 'fraud-detection-service',
    namespace: 'default',
    name: 'Fraud Detection Service',
    description: 'Scores transactions for fraud risk before payment capture.',
    owner: TEAM_IDS.payments,
    lifecycle: LIFECYCLE_IDS.experimental,
    target_lifecycle: LIFECYCLE_IDS.production,
    target_lifecycle_date: '2026-07-01',
    tags: ['python', 'security'],
    links: [],
    schema_id: '00000000-0000-0000-0000-000000000003',
    data: {
      technology_releases: [TECHNOLOGY_RELEASE_IDS.python312],
      system: ['00000000-0000-0000-0002-000000000003'],
      consumes_apis: ['00000000-0000-0000-0004-000000000003'],
      depends_on: ['00000000-0000-0000-0003-000000000005']
    },
    visibility_mode: null,
    created_at: now,
    updated_at: now
  },
  {
    id: '00000000-0000-0000-0003-000000000007',
    workspace: WORKSPACE_ID,
    public_id: 'CMP-7',
    slug: 'analytics-ingestion-worker',
    namespace: 'default',
    name: 'Analytics Ingestion Worker',
    description: 'Consumes product and payment events and lands them in the data warehouse.',
    owner: TEAM_IDS.data,
    lifecycle: LIFECYCLE_IDS.production,
    target_lifecycle: null,
    target_lifecycle_date: null,
    tags: ['python', 'internal'],
    links: [],
    schema_id: '00000000-0000-0000-0000-000000000003',
    data: {
      technology_releases: [TECHNOLOGY_RELEASE_IDS.python312],
      system: ['00000000-0000-0000-0002-000000000004'],
      consumes_apis: [
        '00000000-0000-0000-0004-000000000001',
        '00000000-0000-0000-0004-000000000003'
      ]
    },
    visibility_mode: null,
    created_at: now,
    updated_at: now
  },
  {
    id: '00000000-0000-0000-0003-000000000008',
    workspace: WORKSPACE_ID,
    public_id: 'CMP-8',
    slug: 'reporting-dashboard',
    namespace: 'default',
    name: 'Reporting Dashboard',
    description: 'Internal dashboard surfacing revenue and product analytics.',
    owner: TEAM_IDS.data,
    lifecycle: LIFECYCLE_IDS.production,
    target_lifecycle: null,
    target_lifecycle_date: null,
    tags: ['react', 'internal'],
    links: [],
    schema_id: '00000000-0000-0000-0000-000000000003',
    data: {
      technology_releases: [TECHNOLOGY_RELEASE_IDS.react18],
      system: ['00000000-0000-0000-0002-000000000004'],
      consumes_apis: ['00000000-0000-0000-0004-000000000004'],
      depends_on: ['00000000-0000-0000-0003-000000000007']
    },
    visibility_mode: null,
    created_at: now,
    updated_at: now
  },
  {
    id: '00000000-0000-0000-0003-000000000009',
    workspace: WORKSPACE_ID,
    public_id: 'CMP-9',
    slug: 'notification-dispatcher',
    namespace: 'default',
    name: 'Notification Dispatcher',
    description: 'Fans out outbound notification events to channel-specific senders.',
    owner: TEAM_IDS.platform,
    lifecycle: LIFECYCLE_IDS.production,
    target_lifecycle: null,
    target_lifecycle_date: null,
    tags: ['nodejs', 'messaging'],
    links: [],
    schema_id: '00000000-0000-0000-0000-000000000003',
    data: {
      technology_releases: [TECHNOLOGY_RELEASE_IDS.nodejs20],
      system: ['00000000-0000-0000-0002-000000000005'],
      provides_apis: ['00000000-0000-0000-0004-000000000005']
    },
    visibility_mode: null,
    created_at: now,
    updated_at: now
  },
  {
    id: '00000000-0000-0000-0003-00000000000a',
    workspace: WORKSPACE_ID,
    public_id: 'CMP-10',
    slug: 'webhook-relay',
    namespace: 'default',
    name: 'Webhook Relay',
    description: 'Delivers outbound webhooks with retries and signature verification.',
    owner: TEAM_IDS.platform,
    lifecycle: LIFECYCLE_IDS.production,
    target_lifecycle: null,
    target_lifecycle_date: null,
    tags: ['go', 'messaging'],
    links: [],
    schema_id: '00000000-0000-0000-0000-000000000003',
    data: {
      technology_releases: [TECHNOLOGY_RELEASE_IDS.go122],
      system: ['00000000-0000-0000-0002-000000000005'],
      consumes_apis: ['00000000-0000-0000-0004-000000000005'],
      depends_on: ['00000000-0000-0000-0003-000000000009']
    },
    visibility_mode: null,
    created_at: now,
    updated_at: now
  },
  {
    id: '00000000-0000-0000-0003-00000000000b',
    workspace: WORKSPACE_ID,
    public_id: 'CMP-11',
    slug: 'search-service',
    namespace: 'default',
    name: 'Search Service',
    description: 'Serves full-text search queries backed by the Elasticsearch cluster.',
    owner: TEAM_IDS.platform,
    lifecycle: LIFECYCLE_IDS.experimental,
    target_lifecycle: LIFECYCLE_IDS.production,
    target_lifecycle_date: '2026-06-01',
    tags: ['rust', 'search'],
    links: [],
    schema_id: '00000000-0000-0000-0000-000000000003',
    data: {
      technology_releases: [TECHNOLOGY_RELEASE_IDS.rust182],
      system: ['00000000-0000-0000-0002-000000000006'],
      provides_apis: ['00000000-0000-0000-0004-000000000006']
    },
    visibility_mode: null,
    created_at: now,
    updated_at: now
  },
  {
    id: '00000000-0000-0000-0003-00000000000c',
    workspace: WORKSPACE_ID,
    public_id: 'CMP-12',
    slug: 'recommendation-engine',
    namespace: 'default',
    name: 'Recommendation Engine',
    description: 'Generates personalised recommendations from search and behavioural signals.',
    owner: TEAM_IDS.data,
    lifecycle: LIFECYCLE_IDS.proposed,
    target_lifecycle: null,
    target_lifecycle_date: null,
    tags: ['python', 'search'],
    links: [],
    schema_id: '00000000-0000-0000-0000-000000000003',
    data: {
      technology_releases: [TECHNOLOGY_RELEASE_IDS.python312],
      system: ['00000000-0000-0000-0002-000000000006'],
      consumes_apis: ['00000000-0000-0000-0004-000000000006'],
      depends_on: ['00000000-0000-0000-0003-00000000000b']
    },
    visibility_mode: null,
    created_at: now,
    updated_at: now
  },
  {
    id: '00000000-0000-0000-0003-00000000000d',
    workspace: WORKSPACE_ID,
    public_id: 'CMP-13',
    slug: 'email-service',
    namespace: 'default',
    name: 'Email Service',
    description: 'Renders and sends transactional email via the notification hub.',
    owner: TEAM_IDS.platform,
    lifecycle: LIFECYCLE_IDS.production,
    target_lifecycle: null,
    target_lifecycle_date: null,
    tags: ['nodejs', 'messaging'],
    links: [],
    schema_id: '00000000-0000-0000-0000-000000000003',
    data: {
      technology_releases: [TECHNOLOGY_RELEASE_IDS.nodejs20],
      system: ['00000000-0000-0000-0002-000000000005'],
      consumes_apis: ['00000000-0000-0000-0004-000000000005'],
      depends_on: ['00000000-0000-0000-0003-000000000009']
    },
    visibility_mode: null,
    created_at: now,
    updated_at: now
  },
  {
    id: '00000000-0000-0000-0003-00000000000e',
    workspace: WORKSPACE_ID,
    public_id: 'CMP-14',
    slug: 'feature-flag-service',
    namespace: 'default',
    name: 'Feature Flag Service',
    description: 'Serves feature flag evaluations to the portal frontend and gateway.',
    owner: TEAM_IDS.platform,
    lifecycle: LIFECYCLE_IDS.production,
    target_lifecycle: null,
    target_lifecycle_date: null,
    tags: ['go', 'tier-1'],
    links: [],
    schema_id: '00000000-0000-0000-0000-000000000003',
    data: {
      technology_releases: [TECHNOLOGY_RELEASE_IDS.go122],
      system: ['00000000-0000-0000-0002-000000000001']
    },
    visibility_mode: null,
    created_at: now,
    updated_at: now
  },
  {
    id: '00000000-0000-0000-0003-00000000000f',
    workspace: WORKSPACE_ID,
    public_id: 'CMP-15',
    slug: 'rate-limiter',
    namespace: 'default',
    name: 'Rate Limiter',
    description: 'Sidecar enforcing per-client rate limits at the edge.',
    owner: TEAM_IDS.platform,
    lifecycle: LIFECYCLE_IDS.production,
    target_lifecycle: null,
    target_lifecycle_date: null,
    tags: ['rust', 'tier-1'],
    links: [],
    schema_id: '00000000-0000-0000-0000-000000000003',
    data: {
      technology_releases: [TECHNOLOGY_RELEASE_IDS.rust182],
      system: ['00000000-0000-0000-0002-000000000001'],
      depends_on: ['00000000-0000-0000-0003-00000000000e']
    },
    visibility_mode: null,
    created_at: now,
    updated_at: now
  },
  // Additional resources
  {
    id: '00000000-0000-0000-0005-000000000002',
    workspace: WORKSPACE_ID,
    public_id: 'RES-2',
    slug: 'redis-cache',
    namespace: 'default',
    name: 'Redis Cache',
    description: 'Session and response cache for the customer portal.',
    owner: TEAM_IDS.platform,
    lifecycle: LIFECYCLE_IDS.production,
    target_lifecycle: null,
    target_lifecycle_date: null,
    tags: ['redis', 'managed'],
    links: [],
    schema_id: '00000000-0000-0000-0000-000000000005',
    data: {
      resource_type: 'cache',
      technology_releases: [TECHNOLOGY_RELEASE_IDS.redis7],
      system: ['00000000-0000-0000-0002-000000000001']
    },
    visibility_mode: null,
    created_at: now,
    updated_at: now
  },
  {
    id: '00000000-0000-0000-0005-000000000003',
    workspace: WORKSPACE_ID,
    public_id: 'RES-3',
    slug: 'kafka-event-bus',
    namespace: 'default',
    name: 'Kafka Event Bus',
    description: 'Event backbone for notification and analytics event streams.',
    owner: TEAM_IDS.platform,
    lifecycle: LIFECYCLE_IDS.production,
    target_lifecycle: null,
    target_lifecycle_date: null,
    tags: ['kafka', 'managed'],
    links: [],
    schema_id: '00000000-0000-0000-0000-000000000005',
    data: {
      resource_type: 'message-queue',
      technology_releases: [TECHNOLOGY_RELEASE_IDS.kafka37],
      system: ['00000000-0000-0000-0002-000000000005']
    },
    visibility_mode: null,
    created_at: now,
    updated_at: now
  },
  {
    id: '00000000-0000-0000-0005-000000000004',
    workspace: WORKSPACE_ID,
    public_id: 'RES-4',
    slug: 's3-data-lake',
    namespace: 'default',
    name: 'S3 Data Lake',
    description: 'Raw event storage feeding the analytics warehouse.',
    owner: TEAM_IDS.data,
    lifecycle: LIFECYCLE_IDS.production,
    target_lifecycle: null,
    target_lifecycle_date: null,
    tags: ['s3', 'managed'],
    links: [],
    schema_id: '00000000-0000-0000-0000-000000000005',
    data: {
      resource_type: 'object-storage',
      system: ['00000000-0000-0000-0002-000000000004']
    },
    visibility_mode: null,
    created_at: now,
    updated_at: now
  },
  {
    id: '00000000-0000-0000-0005-000000000005',
    workspace: WORKSPACE_ID,
    public_id: 'RES-5',
    slug: 'payments-postgres',
    namespace: 'default',
    name: 'Payments Postgres',
    description: 'Dedicated PostgreSQL cluster storing ledger and transaction state.',
    owner: TEAM_IDS.payments,
    lifecycle: LIFECYCLE_IDS.production,
    target_lifecycle: null,
    target_lifecycle_date: null,
    tags: ['postgres', 'managed'],
    links: [],
    schema_id: '00000000-0000-0000-0000-000000000005',
    data: {
      resource_type: 'database',
      technology_releases: [TECHNOLOGY_RELEASE_IDS.postgres15],
      system: ['00000000-0000-0000-0002-000000000003']
    },
    visibility_mode: null,
    created_at: now,
    updated_at: now
  },
  {
    id: '00000000-0000-0000-0005-000000000006',
    workspace: WORKSPACE_ID,
    public_id: 'RES-6',
    slug: 'elasticsearch-cluster',
    namespace: 'default',
    name: 'Elasticsearch Cluster',
    description: 'Search index backing the Search Service.',
    owner: TEAM_IDS.platform,
    lifecycle: LIFECYCLE_IDS.experimental,
    target_lifecycle: null,
    target_lifecycle_date: null,
    tags: ['elasticsearch', 'managed'],
    links: [],
    schema_id: '00000000-0000-0000-0000-000000000005',
    data: {
      resource_type: 'search-index',
      technology_releases: [TECHNOLOGY_RELEASE_IDS.elasticsearch8],
      system: ['00000000-0000-0000-0002-000000000006']
    },
    visibility_mode: null,
    created_at: now,
    updated_at: now
  },
  {
    id: '00000000-0000-0000-0005-000000000007',
    workspace: WORKSPACE_ID,
    public_id: 'RES-7',
    slug: 'analytics-warehouse',
    namespace: 'default',
    name: 'Analytics Warehouse',
    description: 'Columnar data warehouse powering internal reporting.',
    owner: TEAM_IDS.data,
    lifecycle: LIFECYCLE_IDS.production,
    target_lifecycle: null,
    target_lifecycle_date: null,
    tags: ['warehouse', 'managed'],
    links: [],
    schema_id: '00000000-0000-0000-0000-000000000005',
    data: {
      resource_type: 'data-warehouse',
      system: ['00000000-0000-0000-0002-000000000004']
    },
    visibility_mode: null,
    created_at: now,
    updated_at: now
  },
  {
    id: '00000000-0000-0000-0005-000000000008',
    workspace: WORKSPACE_ID,
    public_id: 'RES-8',
    slug: 'cdn',
    namespace: 'default',
    name: 'CDN',
    description: 'Edge content delivery network fronting the customer portal.',
    owner: TEAM_IDS.platform,
    lifecycle: LIFECYCLE_IDS.production,
    target_lifecycle: null,
    target_lifecycle_date: null,
    tags: ['cdn', 'managed'],
    links: [],
    schema_id: '00000000-0000-0000-0000-000000000005',
    data: {
      resource_type: 'cdn',
      system: ['00000000-0000-0000-0002-000000000001']
    },
    visibility_mode: null,
    created_at: now,
    updated_at: now
  },
  // Second workspace entities
  {
    id: '00000000-0000-0000-0011-000000000001',
    workspace: WORKSPACE2_ID,
    public_id: 'APP-1',
    slug: 'mobile-app',
    namespace: 'default',
    name: 'Mobile App',
    description: 'Cross-platform mobile application for iOS and Android.',
    owner: TEAM2_IDS.mobile,
    lifecycle: LIFECYCLE2_IDS.stable,
    target_lifecycle: null,
    target_lifecycle_date: null,
    tags: ['mobile', 'customer-facing'],
    links: [],
    schema_id: '00000000-0000-0000-0000-000000000011',
    data: { platform: 'ios' },
    visibility_mode: null,
    created_at: now,
    updated_at: now
  },
  {
    id: '00000000-0000-0000-0012-000000000001',
    workspace: WORKSPACE2_ID,
    public_id: 'SVC-1',
    slug: 'notifications-service',
    namespace: 'default',
    name: 'Notifications Service',
    description: 'Handles push notifications and email delivery.',
    owner: TEAM2_IDS.backend,
    lifecycle: LIFECYCLE2_IDS.beta,
    target_lifecycle: LIFECYCLE2_IDS.stable,
    target_lifecycle_date: '2026-09-01',
    tags: ['nodejs', 'messaging'],
    links: [],
    schema_id: '00000000-0000-0000-0000-000000000012',
    data: { technology: 'Node' },
    visibility_mode: null,
    created_at: now,
    updated_at: now
  },
  {
    id: '00000000-0000-0000-0012-000000000002',
    workspace: WORKSPACE2_ID,
    public_id: 'SVC-2',
    slug: 'delivery-service',
    namespace: 'default',
    name: 'Delivery Service',
    description: 'Coordinates outbound delivery jobs for notifications.',
    owner: TEAM2_IDS.backend,
    lifecycle: LIFECYCLE2_IDS.active,
    target_lifecycle: null,
    target_lifecycle_date: null,
    tags: ['worker', 'messaging'],
    links: [],
    schema_id: '00000000-0000-0000-0000-000000000012',
    data: { technology: 'Rust' },
    visibility_mode: null,
    created_at: now,
    updated_at: now
  },
  {
    id: '00000000-0000-0000-0011-000000000002',
    workspace: WORKSPACE2_ID,
    public_id: 'APP-2',
    slug: 'admin-app',
    namespace: 'default',
    name: 'Admin App',
    description: 'Internal web application for support and operations staff.',
    owner: TEAM2_IDS.mobile,
    lifecycle: LIFECYCLE2_IDS.beta,
    target_lifecycle: null,
    target_lifecycle_date: null,
    tags: ['internal', 'web'],
    links: [],
    schema_id: '00000000-0000-0000-0000-000000000011',
    data: { platform: 'web' },
    visibility_mode: null,
    created_at: now,
    updated_at: now
  },
  {
    id: '00000000-0000-0000-0011-000000000003',
    workspace: WORKSPACE2_ID,
    public_id: 'APP-3',
    slug: 'partner-portal',
    namespace: 'default',
    name: 'Partner Portal',
    description: 'Web application used by external delivery partners.',
    owner: TEAM2_IDS.mobile,
    lifecycle: LIFECYCLE2_IDS.active,
    target_lifecycle: null,
    target_lifecycle_date: null,
    tags: ['partner-facing', 'web'],
    links: [],
    schema_id: '00000000-0000-0000-0000-000000000011',
    data: { platform: 'web' },
    visibility_mode: null,
    created_at: now,
    updated_at: now
  },
  {
    id: '00000000-0000-0000-0012-000000000003',
    workspace: WORKSPACE2_ID,
    public_id: 'SVC-3',
    slug: 'auth-service',
    namespace: 'default',
    name: 'Auth Service',
    description: 'Issues and validates session tokens for mobile and web clients.',
    owner: TEAM2_IDS.backend,
    lifecycle: LIFECYCLE2_IDS.stable,
    target_lifecycle: null,
    target_lifecycle_date: null,
    tags: ['go', 'security'],
    links: [],
    schema_id: '00000000-0000-0000-0000-000000000012',
    data: { technology: 'Go' },
    visibility_mode: null,
    created_at: now,
    updated_at: now
  },
  {
    id: '00000000-0000-0000-0012-000000000004',
    workspace: WORKSPACE2_ID,
    public_id: 'SVC-4',
    slug: 'payments-service',
    namespace: 'default',
    name: 'Payments Service',
    description: 'Handles in-app purchases and subscription billing.',
    owner: TEAM2_IDS.backend,
    lifecycle: LIFECYCLE2_IDS.stable,
    target_lifecycle: null,
    target_lifecycle_date: null,
    tags: ['java', 'revenue'],
    links: [],
    schema_id: '00000000-0000-0000-0000-000000000012',
    data: { technology: 'Java' },
    visibility_mode: null,
    created_at: now,
    updated_at: now
  },
  {
    id: '00000000-0000-0000-0012-000000000005',
    workspace: WORKSPACE2_ID,
    public_id: 'SVC-5',
    slug: 'search-service',
    namespace: 'default',
    name: 'Search Service',
    description: 'Provides in-app search across catalog and content.',
    owner: TEAM2_IDS.backend,
    lifecycle: LIFECYCLE2_IDS.beta,
    target_lifecycle: null,
    target_lifecycle_date: null,
    tags: ['rust', 'search'],
    links: [],
    schema_id: '00000000-0000-0000-0000-000000000012',
    data: { technology: 'Rust' },
    visibility_mode: null,
    created_at: now,
    updated_at: now
  },
  {
    id: '00000000-0000-0000-0012-000000000006',
    workspace: WORKSPACE2_ID,
    public_id: 'SVC-6',
    slug: 'analytics-service',
    namespace: 'default',
    name: 'Analytics Service',
    description: 'Collects client usage events for product analytics.',
    owner: TEAM2_IDS.backend,
    lifecycle: LIFECYCLE2_IDS.active,
    target_lifecycle: null,
    target_lifecycle_date: null,
    tags: ['python', 'internal'],
    links: [],
    schema_id: '00000000-0000-0000-0000-000000000012',
    data: { technology: 'Python' },
    visibility_mode: null,
    created_at: now,
    updated_at: now
  }
];

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
    target_date: null,
    pinned: false,
    created_at: now,
    updated_at: now
  }
];

const MILESTONE_IDS = {
  portalRedesign: {
    designFinalized: '00000000-0000-0000-0040-000000000001',
    frontendRollout: '00000000-0000-0000-0040-000000000002',
    legacyPortalDecommission: '00000000-0000-0000-0040-000000000003'
  },
  authMigration: {
    identityCutover: '00000000-0000-0000-0040-000000000004',
    legacyAuthDecommission: '00000000-0000-0000-0040-000000000005'
  },
  checkoutRevamp: {
    paymentGatewayIntegration: '00000000-0000-0000-0040-000000000006',
    fraudDetectionRollout: '00000000-0000-0000-0040-000000000007'
  },
  searchAnalytics: {
    searchPlatformGa: '00000000-0000-0000-0040-000000000008',
    analyticsWarehouseMigration: '00000000-0000-0000-0040-000000000009'
  }
} as const;

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

export const seedEntitySnapshots: EntitySnapshotDbCreate[] = [
  {
    id: '00000000-0000-0000-0041-000000000001',
    workspace: WORKSPACE_ID,
    entity_id: '00000000-0000-0000-0002-000000000001', // Customer Portal
    status: 'future_update',
    project_id: seededProjects.portalRedesign.id,
    target_date: null,
    milestone_id: MILESTONE_IDS.portalRedesign.frontendRollout,
    commit_message: 'Modernized navigation and IA',
    created_at: new Date('2026-01-10T09:00:00.000Z'),
    created_by: USER_IDS.designteamadmin,
    created_by_name: seededUsers.designTeamAdmin.displayName,
    base_state: {
      description: 'Public-facing portal for customer self-service.'
    },
    proposed_state: {
      description:
        'Public-facing portal for customer self-service with a modernized reactive frontend and consolidated navigation.'
    }
  },
  {
    id: '00000000-0000-0000-0041-000000000002',
    workspace: WORKSPACE_ID,
    entity_id: '00000000-0000-0000-0003-000000000002', // Frontend App
    status: 'future_update',
    project_id: seededProjects.portalRedesign.id,
    target_date: null,
    milestone_id: MILESTONE_IDS.portalRedesign.frontendRollout,
    commit_message: 'Upgrade to React 19 as part of the redesign',
    created_at: new Date('2026-01-10T09:05:00.000Z'),
    created_by: USER_IDS.designteamadmin,
    created_by_name: seededUsers.designTeamAdmin.displayName,
    base_state: { technology: 'React', tags: ['react', 'frontend'] },
    proposed_state: { technology: 'React 19', tags: ['react', 'frontend', 'modernized'] }
  },
  {
    id: '00000000-0000-0000-0041-000000000003',
    workspace: WORKSPACE_ID,
    entity_id: '00000000-0000-0000-0003-000000000001', // API Gateway
    status: 'future_update',
    project_id: seededProjects.portalRedesign.id,
    target_date: '2026-03-15',
    milestone_id: null,
    commit_message: 'Runtime upgrade ahead of frontend rollout',
    created_at: new Date('2026-01-10T09:10:00.000Z'),
    created_by: USER_IDS.platformteamadmin,
    created_by_name: seededUsers.platformTeamAdmin.displayName,
    base_state: { technology: 'Node' },
    proposed_state: { technology: 'Node 22' }
  },
  {
    id: '00000000-0000-0000-0041-000000000004',
    workspace: WORKSPACE_ID,
    entity_id: '00000000-0000-0000-0002-000000000002', // Identity Platform
    status: 'future_update',
    project_id: seededProjects.authMigration.id,
    target_date: null,
    milestone_id: MILESTONE_IDS.authMigration.identityCutover,
    commit_message: 'Cutover complete, legacy auth fully retired',
    created_at: new Date('2026-01-11T10:00:00.000Z'),
    created_by: USER_IDS.securityteamadmin,
    created_by_name: seededUsers.securityTeamAdmin.displayName,
    base_state: { description: 'Centralised authentication and authorisation service.' },
    proposed_state: {
      description:
        'Centralised authentication and authorisation service, now the sole identity provider.'
    }
  },
  {
    id: '00000000-0000-0000-0041-000000000005',
    workspace: WORKSPACE_ID,
    entity_id: '00000000-0000-0000-0003-000000000003', // Auth Service
    status: 'future_update',
    project_id: seededProjects.authMigration.id,
    target_date: null,
    milestone_id: MILESTONE_IDS.authMigration.identityCutover,
    commit_message: 'Promote to production once cutover completes',
    created_at: new Date('2026-01-11T10:05:00.000Z'),
    created_by: USER_IDS.securityteamadmin,
    created_by_name: seededUsers.securityTeamAdmin.displayName,
    base_state: { tags: ['go', 'security'] },
    proposed_state: { tags: ['go', 'security', 'primary-idp'] }
  },
  {
    id: '00000000-0000-0000-0041-000000000006',
    workspace: WORKSPACE_ID,
    entity_id: '00000000-0000-0000-0004-000000000002', // Auth API
    status: 'future_update',
    project_id: seededProjects.authMigration.id,
    target_date: '2026-08-01',
    milestone_id: null,
    commit_message: 'Add refresh-token rotation ahead of legacy decommission',
    created_at: new Date('2026-01-11T10:10:00.000Z'),
    created_by: USER_IDS.securityteamadmin,
    created_by_name: seededUsers.securityTeamAdmin.displayName,
    base_state: { description: 'gRPC API for token issuance and validation.' },
    proposed_state: {
      description: 'gRPC API for token issuance and validation, with refresh-token rotation.'
    }
  },
  {
    id: '00000000-0000-0000-0041-000000000007',
    workspace: WORKSPACE_ID,
    entity_id: '00000000-0000-0000-0003-000000000004', // Payment Service
    status: 'future_update',
    project_id: seededProjects.checkoutRevamp.id,
    target_date: null,
    milestone_id: MILESTONE_IDS.checkoutRevamp.paymentGatewayIntegration,
    commit_message: 'Integrate new gateway provider',
    created_at: new Date('2026-01-12T11:00:00.000Z'),
    created_by: USER_IDS.workspaceowner,
    created_by_name: seededUsers.workspaceOwner.displayName,
    base_state: {
      description: 'Orchestrates payment authorization and capture against external providers.'
    },
    proposed_state: {
      description:
        'Orchestrates payment authorization and capture against the new gateway provider.'
    }
  },
  {
    id: '00000000-0000-0000-0041-000000000008',
    workspace: WORKSPACE_ID,
    entity_id: '00000000-0000-0000-0003-000000000006', // Fraud Detection Service
    status: 'future_update',
    project_id: seededProjects.checkoutRevamp.id,
    target_date: null,
    milestone_id: MILESTONE_IDS.checkoutRevamp.fraudDetectionRollout,
    commit_message: 'Promote to production with new ML risk model',
    created_at: new Date('2026-01-12T11:05:00.000Z'),
    created_by: USER_IDS.workspaceowner,
    created_by_name: seededUsers.workspaceOwner.displayName,
    base_state: {
      description: 'Scores transactions for fraud risk before payment capture.'
    },
    proposed_state: {
      description:
        'Scores transactions for fraud risk before payment capture, using the new ML risk model.'
    }
  },
  {
    id: '00000000-0000-0000-0041-000000000009',
    workspace: WORKSPACE_ID,
    entity_id: '00000000-0000-0000-0003-000000000005', // Ledger Service
    status: 'future_update',
    project_id: seededProjects.checkoutRevamp.id,
    target_date: '2026-05-01',
    milestone_id: null,
    commit_message: 'Runtime upgrade ahead of gateway integration',
    created_at: new Date('2026-01-12T11:10:00.000Z'),
    created_by: USER_IDS.workspaceeditor,
    created_by_name: seededUsers.workspaceEditor.displayName,
    base_state: { technology: 'Java' },
    proposed_state: { technology: 'Java 21' }
  },
  {
    id: '00000000-0000-0000-0041-00000000000a',
    workspace: WORKSPACE_ID,
    entity_id: '00000000-0000-0000-0003-00000000000b', // Search Service
    status: 'future_update',
    project_id: seededProjects.searchAnalytics.id,
    target_date: null,
    milestone_id: MILESTONE_IDS.searchAnalytics.searchPlatformGa,
    commit_message: 'GA readiness: typo-tolerant search',
    created_at: new Date('2026-01-13T12:00:00.000Z'),
    created_by: USER_IDS.workspaceeditor,
    created_by_name: seededUsers.workspaceEditor.displayName,
    base_state: {
      description: 'Serves full-text search queries backed by the Elasticsearch cluster.'
    },
    proposed_state: {
      description:
        'Serves full-text search queries backed by the Elasticsearch cluster, now with typo-tolerant matching.'
    }
  },
  {
    id: '00000000-0000-0000-0041-00000000000b',
    workspace: WORKSPACE_ID,
    entity_id: '00000000-0000-0000-0003-000000000007', // Analytics Ingestion Worker
    status: 'future_update',
    project_id: seededProjects.searchAnalytics.id,
    target_date: null,
    milestone_id: MILESTONE_IDS.searchAnalytics.analyticsWarehouseMigration,
    commit_message: 'Runtime upgrade for warehouse migration',
    created_at: new Date('2026-01-13T12:05:00.000Z'),
    created_by: USER_IDS.workspaceeditor,
    created_by_name: seededUsers.workspaceEditor.displayName,
    base_state: { technology: 'Python' },
    proposed_state: { technology: 'Python 3.13' }
  },
  {
    id: '00000000-0000-0000-0041-00000000000c',
    workspace: WORKSPACE_ID,
    entity_id: '00000000-0000-0000-0003-000000000008', // Reporting Dashboard
    status: 'future_update',
    project_id: seededProjects.searchAnalytics.id,
    target_date: '2026-09-15',
    milestone_id: null,
    commit_message: 'Rebuild on the new analytics warehouse',
    created_at: new Date('2026-01-13T12:10:00.000Z'),
    created_by: USER_IDS.workspaceeditor,
    created_by_name: seededUsers.workspaceEditor.displayName,
    base_state: {
      description: 'Internal dashboard surfacing revenue and product analytics.'
    },
    proposed_state: {
      description:
        'Internal dashboard surfacing revenue and product analytics, rebuilt on the new analytics warehouse.'
    }
  }
];

export const seedProjectEntities: ProjectEntityDbCreate[] = [
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
    scope: [seededSchemas.default.component.id],
    scope_conditions: [],
    fields: [
      { id: 'f1', label: 'Secrets management', type: 'rating', requirementLevel: 'required' },
      { id: 'f2', label: 'Last pen-test date', type: 'text', requirementLevel: 'optional' },
      { id: 'f3', label: 'Known vulnerabilities', type: 'text', requirementLevel: 'optional' }
    ],
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
    created_at: now,
    updated_at: now
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
      status: LIFECYCLE_IDS.production,
      schemaId: '00000000-0000-0000-0000-000000000002'
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
    filters: {},
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
      owner: TEAM_IDS.platform,
      schemaId: '00000000-0000-0000-0000-000000000003'
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
    filters: { schemaId: '00000000-0000-0000-0000-000000000006' },
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
    filters: { schemaId: '00000000-0000-0000-0000-000000000006' },
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
      conditions: [{ fieldId: 'eol_date', op: 'not_empty', value: null }]
    },
    config: null,
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

export const seedUserWatches = [
  {
    user_id: USER_IDS.globaladmin,
    workspace: WORKSPACE_ID,
    entity_id: '00000000-0000-0000-0002-000000000001',
    created_at: new Date('2026-01-02T09:00:00.000Z')
  },
  {
    user_id: USER_IDS.globaladmin,
    workspace: WORKSPACE_ID,
    entity_id: '00000000-0000-0000-0004-000000000001',
    created_at: new Date('2026-01-02T09:05:00.000Z')
  },
  {
    user_id: USER_IDS.globaladmin,
    workspace: WORKSPACE_ID,
    entity_id: '00000000-0000-0000-0003-000000000003',
    created_at: new Date('2026-01-02T09:10:00.000Z')
  },
  {
    user_id: USER_IDS.globaladmin,
    workspace: WORKSPACE2_ID,
    entity_id: '00000000-0000-0000-0011-000000000001',
    created_at: new Date('2026-01-07T09:00:00.000Z')
  },
  {
    user_id: USER_IDS.globaladmin,
    workspace: WORKSPACE2_ID,
    entity_id: '00000000-0000-0000-0012-000000000001',
    created_at: new Date('2026-01-07T09:05:00.000Z')
  },
  {
    user_id: USER_IDS.globaladmin,
    workspace: WORKSPACE2_ID,
    entity_id: '00000000-0000-0000-0012-000000000002',
    created_at: new Date('2026-01-07T09:10:00.000Z')
  }
] as const;

export const seedNotificationEvents: Array<{
  workspace: string;
  timestamp: Date;
  user_id: string;
  operation: AuditOperation;
  entity_id: string;
  entity_name: string;
  entity_slug: string;
  schema_id: string;
  changed_by_display_name: string;
  changes: {
    old?: Record<string, unknown>;
    new?: Record<string, unknown>;
  };
}> = [
  {
    workspace: WORKSPACE_ID,
    timestamp: new Date('2026-01-03T08:15:00.000Z'),
    user_id: USER_IDS.workspaceeditor,
    operation: 'update',
    entity_id: '00000000-0000-0000-0002-000000000001',
    entity_name: 'Customer Portal',
    entity_slug: 'customer-portal',
    schema_id: '00000000-0000-0000-0000-000000000002',
    changed_by_display_name: 'Raj Patel',
    changes: {
      old: { _description: 'Public-facing portal for customer self-service.' },
      new: { _description: 'Public-facing portal for customer self-service with a refreshed IA.' }
    }
  },
  {
    workspace: WORKSPACE_ID,
    timestamp: new Date('2026-01-04T11:40:00.000Z'),
    user_id: USER_IDS.platformteamadmin,
    operation: 'update',
    entity_id: '00000000-0000-0000-0004-000000000001',
    entity_name: 'Customer API',
    entity_slug: 'customer-api',
    schema_id: '00000000-0000-0000-0000-000000000004',
    changed_by_display_name: 'Daniel Okonkwo',
    changes: {
      old: { _tags: ['rest', 'public'] },
      new: { _tags: ['rest', 'public', 'versioned'] }
    }
  },
  {
    workspace: WORKSPACE_ID,
    timestamp: new Date('2026-01-05T13:05:00.000Z'),
    user_id: USER_IDS.securityteamadmin,
    operation: 'update',
    entity_id: '00000000-0000-0000-0003-000000000003',
    entity_name: 'Auth Service',
    entity_slug: 'auth-service',
    schema_id: '00000000-0000-0000-0000-000000000003',
    changed_by_display_name: 'Lena Hoffmann',
    changes: {
      old: { _targetLifecycle: LIFECYCLE_IDS.production },
      new: { _targetLifecycle: LIFECYCLE_IDS.deprecated }
    }
  },
  {
    workspace: WORKSPACE_ID,
    timestamp: new Date('2026-01-06T09:20:00.000Z'),
    user_id: USER_IDS.workspaceadmin,
    operation: 'update',
    entity_id: '00000000-0000-0000-0002-000000000001',
    entity_name: 'Customer Portal',
    entity_slug: 'customer-portal',
    schema_id: '00000000-0000-0000-0000-000000000002',
    changed_by_display_name: 'James Chen',
    changes: {
      old: { _targetLifecycleDate: '2026-12-31' },
      new: { _targetLifecycleDate: '2027-03-31' }
    }
  },
  {
    workspace: WORKSPACE2_ID,
    timestamp: new Date('2026-01-07T10:15:00.000Z'),
    user_id: USER_IDS.platformteamadmin,
    operation: 'update',
    entity_id: '00000000-0000-0000-0011-000000000001',
    entity_name: 'Mobile App',
    entity_slug: 'mobile-app',
    schema_id: '00000000-0000-0000-0000-000000000011',
    changed_by_display_name: 'Daniel Okonkwo',
    changes: {
      old: { _description: 'Cross-platform mobile application for iOS and Android.' },
      new: { _description: 'Cross-platform mobile application with refreshed onboarding flows.' }
    }
  },
  {
    workspace: WORKSPACE2_ID,
    timestamp: new Date('2026-01-07T11:30:00.000Z'),
    user_id: USER_IDS.designteamadmin,
    operation: 'update',
    entity_id: '00000000-0000-0000-0012-000000000001',
    entity_name: 'Notifications Service',
    entity_slug: 'notifications-service',
    schema_id: '00000000-0000-0000-0000-000000000012',
    changed_by_display_name: 'Marcus Berg',
    changes: {
      old: { technology: 'Node' },
      new: { technology: 'Node 22' }
    }
  },
  {
    workspace: WORKSPACE2_ID,
    timestamp: new Date('2026-01-07T13:45:00.000Z'),
    user_id: USER_IDS.workspaceeditor,
    operation: 'update',
    entity_id: '00000000-0000-0000-0012-000000000002',
    entity_name: 'Delivery Service',
    entity_slug: 'delivery-service',
    schema_id: '00000000-0000-0000-0000-000000000012',
    changed_by_display_name: 'Raj Patel',
    changes: {
      old: { _tags: ['worker'] },
      new: { _tags: ['worker', 'messaging'] }
    }
  },
  {
    workspace: WORKSPACE2_ID,
    timestamp: new Date('2026-01-08T08:20:00.000Z'),
    user_id: USER_IDS.workspaceadmin,
    operation: 'update',
    entity_id: '00000000-0000-0000-0012-000000000001',
    entity_name: 'Notifications Service',
    entity_slug: 'notifications-service',
    schema_id: '00000000-0000-0000-0000-000000000012',
    changed_by_display_name: 'James Chen',
    changes: {
      old: { _targetLifecycleDate: '2026-09-01' },
      new: { _targetLifecycleDate: '2026-10-15' }
    }
  }
];

const AUTH_API_ENTITY_ID = '00000000-0000-0000-0004-000000000002';

const CONTENT_IDS = {
  authApiOverviewFolder: '00000000-0000-0000-0030-000000000001',
  authApiOverviewDiagram: '00000000-0000-0000-0030-000000000002',
  authApiSequenceDiagram: '00000000-0000-0000-0030-000000000003',
  authApiSecurityFolder: '00000000-0000-0000-0030-000000000004',
  authApiThreatModel: '00000000-0000-0000-0030-000000000005',
  // Workspace-level content nodes
  wsArchitectureOverview: '00000000-0000-0000-0031-000000000001',
  wsStandardsFolder: '00000000-0000-0000-0031-000000000002',
  wsApiDesignGuide: '00000000-0000-0000-0031-000000000003',
  wsDeploymentTopology: '00000000-0000-0000-0031-000000000004',
  wsWikiFolder: '00000000-0000-0000-0031-000000000005',
  wsWikiHome: '00000000-0000-0000-0031-000000000006',
  wsWikiMarkdownCheatsheet: '00000000-0000-0000-0031-000000000007',
  wsWikiEntityWidgets: '00000000-0000-0000-0031-000000000008',
  wsWikiDiagramsAndViews: '00000000-0000-0000-0031-000000000009',
  wsAdrFolder: '00000000-0000-0000-0031-000000000010',
  wsAdrApiVersioning: '00000000-0000-0000-0031-000000000011',
  wsAdrAsyncMessaging: '00000000-0000-0000-0031-000000000012',
  wsAdrAuthentication: '00000000-0000-0000-0031-000000000013',
  wsAdrObservability: '00000000-0000-0000-0031-000000000014',
  wsAdrDataOwnership: '00000000-0000-0000-0031-000000000015',
  // Checkout Revamp project content nodes
  checkoutRevampPlanningFolder: '00000000-0000-0000-0032-000000000001',
  checkoutRevampProjectBrief: '00000000-0000-0000-0032-000000000002',
  checkoutRevampRolloutPlan: '00000000-0000-0000-0032-000000000003'
} as const;

const encodeEntityBrowserEmbedConfig = (config: {
  q: string;
  conditions: Array<{ fieldId: string; op: string; value: string }>;
  sort: string;
  view: string;
  viewConfigs: Record<string, unknown>;
}): string => {
  const payload = {
    q: config.q,
    conditions: config.conditions,
    sort: config.sort,
    view: config.view,
    viewConfigs:
      Object.keys(config.viewConfigs).length === 0 ? undefined : JSON.stringify(config.viewConfigs)
  };
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
};

export const seedWikiPageBodies: Record<string, string> = {
  [CONTENT_IDS.wsWikiHome]: `# Example Corp Wiki

Welcome to the **Example Corp** architecture wiki. This page collects the standards, guides and
reference material that the platform, design, security and data teams maintain together.

Use this space to document *why* a decision was made, not just *what* was decided — the catalog
already tracks the "what".

## What's here

- [Markdown Cheatsheet](../standards/markdown-cheatsheet) — every markup element the editor supports
- [Entity Widgets Showcase](../standards/entity-widgets) — live catalog data embedded in a page
- [Diagrams & Views](../standards/diagrams-and-views) — embedding diagrams and saved views

## Getting started checklist

- [x] Read the [API Design Guide](../standards/api-design-guide)
- [x] Review the [Deployment Topology](../standards/deployment-topology) diagram
- [ ] Add your team's on-call runbook
- [ ] Link your service's entity page from this wiki

> Documentation that lives next to the catalog stays accurate longer than documentation that lives
> somewhere else entirely.

## Quick links

| Area | Owner | Status |
| --- | --- | --- |
| Platform | Platform Engineering | Production |
| Auth | Security & Compliance | Production |
| Design system | Design Systems | Experimental |

For raw markup examples (tables, code blocks, task lists, etc.) see the
[Markdown Cheatsheet](../standards/markdown-cheatsheet).
`,
  [CONTENT_IDS.wsWikiMarkdownCheatsheet]: `# Markdown Cheatsheet

A quick reference for the markup supported by the wiki editor.

## Headings

### Third level heading
#### Fourth level heading

## Emphasis

Plain text, **bold text**, *italic text*, ***bold italic text***, and ~~strikethrough text~~.

## Lists

Unordered, with nesting:

- Platform
  - API Gateway
  - Event Bus
- Security
  - Auth API
  - Threat modeling

Ordered:

1. Propose the change
2. Get review from the owning team
3. Ship it

Task list:

- [x] Draft the page
- [ ] Get it reviewed

## Blockquote

> A quote can span
> multiple lines.

## Code

Inline \`code\` looks like this. A fenced block:

\`\`\`ts
export const greet = (name: string) => \`Hello, \${name}!\`;
\`\`\`

## Links and autolinks

A regular [markdown link](https://example.com), and a bare autolink: https://example.com

## Horizontal rule

---

## Tables

| Column A | Column B | Column C |
| --- | --- | --- |
| one | two | three |
| four | five | six |
`,
  [CONTENT_IDS.wsWikiEntityWidgets]: `# Entity Widgets Showcase

This page demonstrates the custom MDX components that pull live data from the catalog.

## Entity card

<EntityCard id="${AUTH_API_ENTITY_ID}" fields="owner,lifecycle,tags" />

## Entity table

<EntityTable schema="00000000-0000-0000-0000-000000000004" owner="${TEAM_IDS.security}" limit="10" />

## Entity changelog

<EntityChangelog id="${AUTH_API_ENTITY_ID}" limit="5" />

## Entity chart

<EntityChart schema="00000000-0000-0000-0000-000000000003" groupBy="lifecycle" type="pie" />

## Entity metric

<EntityMetric schema="00000000-0000-0000-0000-000000000004" label="Total APIs" />

## Entity browser embed

<EntityBrowserEmbed config="${encodeEntityBrowserEmbedConfig({
    q: '',
    conditions: [
      { fieldId: 'schemaId', op: 'equals', value: '00000000-0000-0000-0000-000000000002' }
    ],
    sort: 'name',
    view: 'table',
    viewConfigs: {}
  })}" />

## Inline components

The Auth API entity can be mentioned inline like this: <EntityMention id="${AUTH_API_ENTITY_ID}" />.

It can also be linked directly: <EntityLink id="00000000-0000-0000-0003-000000000001" /> (renders the entity's own name).

A single field can be pulled inline — the Auth API type is <EntityField id="${AUTH_API_ENTITY_ID}" field="api_type" />.
`,
  [CONTENT_IDS.wsWikiDiagramsAndViews]: `# Diagrams & Views

Diagrams and saved catalog views can be embedded directly in a wiki page.

## Diagram embed

<DiagramEmbed id="${CONTENT_IDS.wsArchitectureOverview}" caption="Architecture overview" />

## Saved view embed

<EntityViewEmbed viewId="00000000-0000-0000-0020-000000000001" />
`,
  [CONTENT_IDS.wsAdrApiVersioning]: `# Use URL versioning for public APIs

## Context

Several clients consume the platform API independently and need a predictable way to adopt
breaking changes.

## Decision

Public APIs will use a major version in the URL when a breaking change is introduced. Additive
changes remain compatible within the current version.

## Consequences

Clients can migrate deliberately, and old versions can be retired with a clear communication plan.
`,
  [CONTENT_IDS.wsAdrAsyncMessaging]: `# Use asynchronous messaging for long-running workflows

## Context

Some workflows take longer than a normal request and should not keep an HTTP connection open.

## Decision

Long-running workflows will be submitted through the API and completed through asynchronous
messages and status updates.

## Consequences

The user interface must show progress and failure states, but workers can retry without blocking
request handlers.
`,
  [CONTENT_IDS.wsAdrAuthentication]: `# Keep credentials outside application data

## Context

Authentication tokens and other secrets require stronger controls than ordinary catalog data.

## Decision

Secrets will be stored through the configured secret-management integration. Application records
may keep references and metadata, but not the secret values themselves.

## Consequences

Secret rotation is centralized, while local development needs a documented fallback configuration.
`,
  [CONTENT_IDS.wsAdrObservability]: `# Standardize on structured logs and traces

## Context

Production incidents are difficult to investigate when logs use inconsistent fields and formats.

## Decision

Services will emit structured logs with correlation identifiers and produce distributed traces for
requests that cross service boundaries.

## Consequences

Operational dashboards become easier to share, and new services need to adopt the common fields
before they are considered production-ready.
`,
  [CONTENT_IDS.wsAdrDataOwnership]: `# Keep data ownership with the domain that changes it

## Context

Shared tables make it easy for unrelated features to modify the same data without clear ownership.

## Decision

Each domain owns its persistence model and exposes changes through a documented service boundary.
Other domains consume that boundary instead of writing directly to the tables.

## Consequences

Ownership is clearer and schema changes are safer, although some cross-domain operations require
explicit coordination.
`,
  [CONTENT_IDS.checkoutRevampProjectBrief]: `# Checkout Revamp — Project Brief

## Goal

Modernize checkout orchestration and integrate a new payment gateway provider to reduce
transaction latency and support additional payment methods.

## Scope

- <EntityLink id="00000000-0000-0000-0002-000000000003" /> — new dedicated system for payment
  authorization, capture, refunds and ledger reconciliation
- <EntityLink id="00000000-0000-0000-0003-000000000004" /> — orchestrates authorization and
  capture against the new gateway provider
- <EntityLink id="00000000-0000-0000-0003-000000000005" /> — double-entry ledger for all payment
  and refund transactions
- <EntityLink id="00000000-0000-0000-0003-000000000006" /> — real-time fraud scoring ahead of
  capture

## Non-goals

- Migrating existing subscription billing (tracked separately)
- Multi-currency support (candidate for a follow-up project)

## Stakeholders

<EntityCard id="00000000-0000-0000-0003-000000000004" fields="owner,lifecycle,tags" />

See the [Rollout Plan](../planning/rollout-plan) for milestones and sequencing.
`,
  [CONTENT_IDS.checkoutRevampRolloutPlan]: `# Rollout Plan

## Milestones

| Milestone | Target date | Status |
| --- | --- | --- |
| Payment gateway integration | 2026-05-15 | Planned |
| Fraud detection rollout | 2026-07-01 | Planned |

## Sequencing

1. Stand up <EntityMention id="00000000-0000-0000-0002-000000000003" /> and the supporting
   ledger and Postgres resources.
2. Integrate <EntityMention id="00000000-0000-0000-0003-000000000004" /> with the new gateway
   provider behind a feature flag.
3. Enable <EntityMention id="00000000-0000-0000-0003-000000000006" /> in shadow mode, then
   promote to blocking once precision/recall targets are met.
4. Cut over checkout traffic and decommission the legacy payment path.

## Risks

- Gateway provider sandbox availability may slip the integration milestone.
- Fraud model precision needs validation against production traffic before it can block
  transactions.
`
};

export const seedAdrDocuments = [
  { id: CONTENT_IDS.wsAdrApiVersioning, status: 'Accepted', decision_date: '2025-09-15' },
  { id: CONTENT_IDS.wsAdrAsyncMessaging, status: 'Accepted', decision_date: '2025-10-03' },
  { id: CONTENT_IDS.wsAdrAuthentication, status: 'Accepted', decision_date: '2025-11-12' },
  { id: CONTENT_IDS.wsAdrObservability, status: 'Proposed', decision_date: '2025-12-01' },
  { id: CONTENT_IDS.wsAdrDataOwnership, status: 'Accepted', decision_date: '2026-01-05' }
] as const;

export const seedProjectFiles: ContentNodeDbResult[] = [
  {
    id: CONTENT_IDS.authApiOverviewFolder,
    workspace: WORKSPACE_ID,
    project_id: null,
    entity_id: AUTH_API_ENTITY_ID,
    parent_id: null,
    path: 'overview',
    name: 'Overview',
    type: 'folder',
    size_bytes: 0,
    comment_count: 0,
    unresolved_comment_count: 0,
    is_template: false,
    is_workspace_template: false,
    preview_svg: null,
    created_at: now,
    updated_at: now,
    created_by: null,
    updated_by: null,
    mime_type: null,
    original_filename: null
  },
  {
    id: CONTENT_IDS.authApiOverviewDiagram,
    workspace: WORKSPACE_ID,
    project_id: null,
    entity_id: AUTH_API_ENTITY_ID,
    parent_id: CONTENT_IDS.authApiOverviewFolder,
    path: 'overview/architecture',
    name: 'Architecture',
    type: 'diagram',
    size_bytes: 0,
    comment_count: 0,
    unresolved_comment_count: 0,
    is_template: false,
    is_workspace_template: false,
    preview_svg: null,
    created_at: now,
    updated_at: now,
    created_by: null,
    updated_by: null,
    mime_type: null,
    original_filename: null
  },
  {
    id: CONTENT_IDS.authApiSequenceDiagram,
    workspace: WORKSPACE_ID,
    project_id: null,
    entity_id: AUTH_API_ENTITY_ID,
    parent_id: null,
    path: 'token-flow',
    name: 'Token Flow',
    type: 'diagram',
    size_bytes: 0,
    comment_count: 0,
    unresolved_comment_count: 0,
    is_template: false,
    is_workspace_template: false,
    preview_svg: null,
    created_at: now,
    updated_at: now,
    created_by: null,
    updated_by: null,
    mime_type: null,
    original_filename: null
  },
  {
    id: CONTENT_IDS.authApiSecurityFolder,
    workspace: WORKSPACE_ID,
    project_id: null,
    entity_id: AUTH_API_ENTITY_ID,
    parent_id: null,
    path: 'security',
    name: 'Security',
    type: 'folder',
    size_bytes: 0,
    comment_count: 0,
    unresolved_comment_count: 0,
    is_template: false,
    is_workspace_template: false,
    preview_svg: null,
    created_at: now,
    updated_at: now,
    created_by: null,
    updated_by: null,
    mime_type: null,
    original_filename: null
  },
  {
    id: CONTENT_IDS.authApiThreatModel,
    workspace: WORKSPACE_ID,
    project_id: null,
    entity_id: AUTH_API_ENTITY_ID,
    parent_id: CONTENT_IDS.authApiSecurityFolder,
    path: 'security/threat-model',
    name: 'Threat Model',
    type: 'diagram',
    size_bytes: 0,
    comment_count: 0,
    unresolved_comment_count: 0,
    is_template: false,
    is_workspace_template: false,
    preview_svg: null,
    created_at: now,
    updated_at: now,
    created_by: null,
    updated_by: null,
    mime_type: null,
    original_filename: null
  },
  // Workspace-level content nodes (both project_id and entity_id are null)
  {
    id: CONTENT_IDS.wsArchitectureOverview,
    workspace: WORKSPACE_ID,
    project_id: null,
    entity_id: null,
    parent_id: null,
    path: 'architecture-overview',
    name: 'Architecture Overview',
    type: 'diagram',
    size_bytes: 0,
    comment_count: 0,
    unresolved_comment_count: 0,
    is_template: false,
    is_workspace_template: false,
    preview_svg: null,
    created_at: now,
    updated_at: now,
    created_by: null,
    updated_by: null,
    mime_type: null,
    original_filename: null
  },
  {
    id: CONTENT_IDS.wsStandardsFolder,
    workspace: WORKSPACE_ID,
    project_id: null,
    entity_id: null,
    parent_id: null,
    path: 'standards',
    name: 'Standards',
    type: 'folder',
    size_bytes: 0,
    comment_count: 0,
    unresolved_comment_count: 0,
    is_template: false,
    is_workspace_template: false,
    preview_svg: null,
    created_at: now,
    updated_at: now,
    created_by: null,
    updated_by: null,
    mime_type: null,
    original_filename: null
  },
  {
    id: CONTENT_IDS.wsApiDesignGuide,
    workspace: WORKSPACE_ID,
    project_id: null,
    entity_id: null,
    parent_id: CONTENT_IDS.wsStandardsFolder,
    path: 'standards/api-design-guide',
    name: 'API Design Guide',
    type: 'diagram',
    size_bytes: 0,
    comment_count: 0,
    unresolved_comment_count: 0,
    is_template: false,
    is_workspace_template: false,
    preview_svg: null,
    created_at: now,
    updated_at: now,
    created_by: null,
    updated_by: null,
    mime_type: null,
    original_filename: null
  },
  {
    id: CONTENT_IDS.wsDeploymentTopology,
    workspace: WORKSPACE_ID,
    project_id: null,
    entity_id: null,
    parent_id: CONTENT_IDS.wsStandardsFolder,
    path: 'standards/deployment-topology',
    name: 'Deployment Topology',
    type: 'diagram',
    size_bytes: 0,
    comment_count: 0,
    unresolved_comment_count: 0,
    is_template: false,
    is_workspace_template: false,
    preview_svg: null,
    created_at: now,
    updated_at: now,
    created_by: null,
    updated_by: null,
    mime_type: null,
    original_filename: null
  },
  {
    id: CONTENT_IDS.wsWikiFolder,
    workspace: WORKSPACE_ID,
    project_id: null,
    entity_id: null,
    parent_id: null,
    path: 'wiki',
    name: 'Wiki',
    type: 'folder',
    size_bytes: 0,
    comment_count: 0,
    unresolved_comment_count: 0,
    is_template: false,
    is_workspace_template: false,
    preview_svg: null,
    created_at: now,
    updated_at: now,
    created_by: null,
    updated_by: null,
    mime_type: null,
    original_filename: null
  },
  {
    id: CONTENT_IDS.wsWikiHome,
    workspace: WORKSPACE_ID,
    project_id: null,
    entity_id: null,
    parent_id: CONTENT_IDS.wsWikiFolder,
    path: 'wiki/home',
    name: 'Home',
    type: 'markdown',
    size_bytes: Buffer.byteLength(
      JSON.stringify({ body: seedWikiPageBodies[CONTENT_IDS.wsWikiHome] }),
      'utf8'
    ),
    comment_count: 0,
    unresolved_comment_count: 0,
    is_template: false,
    is_workspace_template: false,
    preview_svg: null,
    created_at: now,
    updated_at: now,
    created_by: null,
    updated_by: null,
    mime_type: null,
    original_filename: null
  },
  {
    id: CONTENT_IDS.wsWikiMarkdownCheatsheet,
    workspace: WORKSPACE_ID,
    project_id: null,
    entity_id: null,
    parent_id: CONTENT_IDS.wsWikiFolder,
    path: 'wiki/markdown-cheatsheet',
    name: 'Markdown Cheatsheet',
    type: 'markdown',
    size_bytes: Buffer.byteLength(
      JSON.stringify({ body: seedWikiPageBodies[CONTENT_IDS.wsWikiMarkdownCheatsheet] }),
      'utf8'
    ),
    comment_count: 0,
    unresolved_comment_count: 0,
    is_template: false,
    is_workspace_template: false,
    preview_svg: null,
    created_at: now,
    updated_at: now,
    created_by: null,
    updated_by: null,
    mime_type: null,
    original_filename: null
  },
  {
    id: CONTENT_IDS.wsWikiEntityWidgets,
    workspace: WORKSPACE_ID,
    project_id: null,
    entity_id: null,
    parent_id: CONTENT_IDS.wsWikiFolder,
    path: 'wiki/entity-widgets',
    name: 'Entity Widgets Showcase',
    type: 'markdown',
    size_bytes: Buffer.byteLength(
      JSON.stringify({ body: seedWikiPageBodies[CONTENT_IDS.wsWikiEntityWidgets] }),
      'utf8'
    ),
    comment_count: 0,
    unresolved_comment_count: 0,
    is_template: false,
    is_workspace_template: false,
    preview_svg: null,
    created_at: now,
    updated_at: now,
    created_by: null,
    updated_by: null,
    mime_type: null,
    original_filename: null
  },
  {
    id: CONTENT_IDS.wsWikiDiagramsAndViews,
    workspace: WORKSPACE_ID,
    project_id: null,
    entity_id: null,
    parent_id: CONTENT_IDS.wsWikiFolder,
    path: 'wiki/diagrams-and-views',
    name: 'Diagrams & Views',
    type: 'markdown',
    size_bytes: Buffer.byteLength(
      JSON.stringify({ body: seedWikiPageBodies[CONTENT_IDS.wsWikiDiagramsAndViews] }),
      'utf8'
    ),
    comment_count: 0,
    unresolved_comment_count: 0,
    is_template: false,
    is_workspace_template: false,
    preview_svg: null,
    created_at: now,
    updated_at: now,
    created_by: null,
    updated_by: null,
    mime_type: null,
    original_filename: null
  },
  {
    id: CONTENT_IDS.wsAdrFolder,
    workspace: WORKSPACE_ID,
    project_id: null,
    entity_id: null,
    parent_id: CONTENT_IDS.wsWikiFolder,
    path: 'wiki/adr',
    name: 'Architecture Decision Records',
    type: 'folder',
    size_bytes: 0,
    comment_count: 0,
    unresolved_comment_count: 0,
    is_template: false,
    is_workspace_template: false,
    preview_svg: null,
    created_at: now,
    updated_at: now,
    created_by: null,
    updated_by: null,
    mime_type: null,
    original_filename: null
  },
  ...(
    [
      [CONTENT_IDS.wsAdrApiVersioning, 'wiki/adr/api-versioning', 'API versioning'],
      [CONTENT_IDS.wsAdrAsyncMessaging, 'wiki/adr/async-messaging', 'Asynchronous messaging'],
      [
        CONTENT_IDS.wsAdrAuthentication,
        'wiki/adr/credential-storage-policy',
        'Credential storage policy'
      ],
      [
        CONTENT_IDS.wsAdrObservability,
        'wiki/adr/structured-observability',
        'Structured observability'
      ],
      [CONTENT_IDS.wsAdrDataOwnership, 'wiki/adr/domain-data-ownership', 'Domain data ownership']
    ] as const
  ).map(([id, path, name]) => ({
    id,
    workspace: WORKSPACE_ID,
    project_id: null,
    entity_id: null,
    parent_id: CONTENT_IDS.wsAdrFolder,
    path,
    name,
    type: 'markdown' as const,
    size_bytes: Buffer.byteLength(JSON.stringify({ body: seedWikiPageBodies[id] }), 'utf8'),
    comment_count: 0,
    unresolved_comment_count: 0,
    is_template: false,
    is_workspace_template: false,
    preview_svg: null,
    created_at: now,
    updated_at: now,
    created_by: null,
    updated_by: null,
    mime_type: null,
    original_filename: null
  })),
  // Checkout Revamp project-scoped wiki
  {
    id: CONTENT_IDS.checkoutRevampPlanningFolder,
    workspace: WORKSPACE_ID,
    project_id: seededProjects.checkoutRevamp.id,
    entity_id: null,
    parent_id: null,
    path: 'planning',
    name: 'Planning',
    type: 'folder',
    size_bytes: 0,
    comment_count: 0,
    unresolved_comment_count: 0,
    is_template: false,
    is_workspace_template: false,
    preview_svg: null,
    created_at: now,
    updated_at: now,
    created_by: null,
    updated_by: null,
    mime_type: null,
    original_filename: null
  },
  {
    id: CONTENT_IDS.checkoutRevampProjectBrief,
    workspace: WORKSPACE_ID,
    project_id: seededProjects.checkoutRevamp.id,
    entity_id: null,
    parent_id: CONTENT_IDS.checkoutRevampPlanningFolder,
    path: 'planning/project-brief',
    name: 'Project Brief',
    type: 'markdown',
    size_bytes: Buffer.byteLength(
      JSON.stringify({ body: seedWikiPageBodies[CONTENT_IDS.checkoutRevampProjectBrief] }),
      'utf8'
    ),
    comment_count: 0,
    unresolved_comment_count: 0,
    is_template: false,
    is_workspace_template: false,
    preview_svg: null,
    created_at: now,
    updated_at: now,
    created_by: null,
    updated_by: null,
    mime_type: null,
    original_filename: null
  },
  {
    id: CONTENT_IDS.checkoutRevampRolloutPlan,
    workspace: WORKSPACE_ID,
    project_id: seededProjects.checkoutRevamp.id,
    entity_id: null,
    parent_id: CONTENT_IDS.checkoutRevampPlanningFolder,
    path: 'planning/rollout-plan',
    name: 'Rollout Plan',
    type: 'markdown',
    size_bytes: Buffer.byteLength(
      JSON.stringify({ body: seedWikiPageBodies[CONTENT_IDS.checkoutRevampRolloutPlan] }),
      'utf8'
    ),
    comment_count: 0,
    unresolved_comment_count: 0,
    is_template: false,
    is_workspace_template: false,
    preview_svg: null,
    created_at: now,
    updated_at: now,
    created_by: null,
    updated_by: null,
    mime_type: null,
    original_filename: null
  }
];

export const seedAiConfig: AiConfigInputDbUpsert = {
  provider: 'openrouter',
  api_key_enc: null,
  base_url: null,
  model: null,
  temperature: null,
  system_prompt: null,
  enabled: false
};
