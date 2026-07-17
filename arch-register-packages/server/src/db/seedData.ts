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
  WorkspaceEnumDbResult
} from '../domain/catalog/db/catalogDatabase';
import {
  ProjectDbCreate,
  ContentNodeDbResult,
  AssessmentDbCreate
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
  data: '90000000-0000-0000-0000-000000000024'
} as const;

const TEAM2_IDS = {
  mobile: '90000000-0000-0000-0000-000000000025',
  backend: '90000000-0000-0000-0000-000000000026'
} as const;

const COLLECTION_IDS = {
  criticalSystems: '00000000-0000-0000-0030-000000000001',
  apisToReview: '00000000-0000-0000-0030-000000000002'
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
    created_at: now
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
    created_at: now
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
      { id: 'technology', name: 'Technology', type: 'text' },
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

export const seedEntities: Entity[] = [
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
      technology: 'Node',
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
      technology: 'React',
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
      technology: 'Go',
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
  wsAdrDataOwnership: '00000000-0000-0000-0031-000000000015'
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
  }))
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
