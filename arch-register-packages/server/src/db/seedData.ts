import type {
  AuditOperation,
  Entity,
  EntitySchema,
  GlobalRoleAssignment,
  Project,
  ProjectFile,
  TeamMembership,
  WorkspaceEnum,
  WorkspaceMember,
  WorkspaceOwner,
  SavedView
} from '../types';
import {
  AR_COLOR_GREEN,
  AR_COLOR_BLUE,
  AR_COLOR_ORANGE,
  AR_COLOR_PURPLE,
  AR_COLOR_YELLOW,
  AR_COLOR_RED,
  AR_COLOR_PINK,
  AR_COLOR_CYAN,
  AR_COLOR_TEAL,
  AR_COLOR_AMBER
} from '@arch-register/api-types/colors';
import {
  WorkspaceRow,
  WorkspaceLifecycleStateRow
} from '@arch-register/server/domain/workspace/db/workspaceDatabase';

const now = new Date('2026-01-01T00:00:00.000Z');

const WORKSPACE_ID = '90000000-0000-0000-0000-000000000001';

const LIFECYCLE_IDS = {
  proposed: '90000000-0000-0000-0000-000000000011',
  experimental: '90000000-0000-0000-0000-000000000012',
  production: '90000000-0000-0000-0000-000000000013',
  deprecated: '90000000-0000-0000-0000-000000000014'
} as const;

const TEAM_IDS = {
  platform: '90000000-0000-0000-0000-000000000021',
  design: '90000000-0000-0000-0000-000000000022',
  security: '90000000-0000-0000-0000-000000000023',
  data: '90000000-0000-0000-0000-000000000024'
} as const;

const USER_IDS = {
  globaladmin: '91000000-0000-0000-0000-000000000001',
  workspaceadmin: '91000000-0000-0000-0000-000000000002',
  workspaceowner: '91000000-0000-0000-0000-000000000003',
  platformteamadmin: '91000000-0000-0000-0000-000000000004',
  platformteameditor: '91000000-0000-0000-0000-000000000005',
  designteamadmin: '91000000-0000-0000-0000-000000000006',
  securityteamadmin: '91000000-0000-0000-0000-000000000007',
  workspaceeditor: '91000000-0000-0000-0000-000000000008',
  workspacereviewer: '91000000-0000-0000-0000-000000000009',
  workspaceviewer: '91000000-0000-0000-0000-00000000000a'
} as const;

export const seedIds = {
  workspace: {
    default: WORKSPACE_ID
  },
  lifecycle: LIFECYCLE_IDS,
  teams: TEAM_IDS,
  users: USER_IDS
} as const;

export const seedWorkspaces: WorkspaceRow[] = [
  {
    id: WORKSPACE_ID,
    name: 'Default Workspace',
    url_slug: 'default',
    short_code: 'DW',
    description: 'The default workspace',
    color: '',
    created_at: now,
    updated_at: now
  }
];

export const seedLifecycleStates: WorkspaceLifecycleStateRow[] = [
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
  }
];

export const seedOwners: WorkspaceOwner[] = [
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
  }
];

export const seedLocalUsers = [
  {
    id: USER_IDS.globaladmin,
    user_id: 'globaladmin',
    email: 'emma.lindqvist@example.com',
    display_name: 'Emma Lindqvist',
    color: AR_COLOR_GREEN
  },
  {
    id: USER_IDS.workspaceadmin,
    user_id: 'workspaceadmin',
    email: 'james.chen@example.com',
    display_name: 'James Chen',
    color: AR_COLOR_BLUE
  },
  {
    id: USER_IDS.workspaceowner,
    user_id: 'workspaceowner',
    email: 'sofia.martinez@example.com',
    display_name: 'Sofia Martinez',
    color: AR_COLOR_ORANGE
  },
  {
    id: USER_IDS.platformteamadmin,
    user_id: 'platformteamadmin',
    email: 'daniel.okonkwo@example.com',
    display_name: 'Daniel Okonkwo',
    color: AR_COLOR_PURPLE
  },
  {
    id: USER_IDS.platformteameditor,
    user_id: 'platformteameditor',
    email: 'anna.kowalski@example.com',
    display_name: 'Anna Kowalski',
    color: AR_COLOR_YELLOW
  },
  {
    id: USER_IDS.designteamadmin,
    user_id: 'designteamadmin',
    email: 'marcus.berg@example.com',
    display_name: 'Marcus Berg',
    color: AR_COLOR_RED
  },
  {
    id: USER_IDS.securityteamadmin,
    user_id: 'securityteamadmin',
    email: 'lena.hoffmann@example.com',
    display_name: 'Lena Hoffmann',
    color: AR_COLOR_PINK
  },
  {
    id: USER_IDS.workspaceeditor,
    user_id: 'workspaceeditor',
    email: 'raj.patel@example.com',
    display_name: 'Raj Patel',
    color: AR_COLOR_CYAN
  },
  {
    id: USER_IDS.workspacereviewer,
    user_id: 'workspacereviewer',
    email: 'clara.dubois@example.com',
    display_name: 'Clara Dubois',
    color: AR_COLOR_TEAL
  },
  {
    id: USER_IDS.workspaceviewer,
    user_id: 'workspaceviewer',
    email: 'oscar.nilsson@example.com',
    display_name: 'Oscar Nilsson',
    color: AR_COLOR_AMBER
  }
] as const;

export const seedTeamAssignments: TeamMembership[] = [
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

export const seedGlobalRoleAssignments: GlobalRoleAssignment[] = [
  { user_id: USER_IDS.globaladmin, role: 'global_admin', created_at: now },
  { user_id: USER_IDS.globaladmin, role: 'workspace_admin', created_at: now },
  { user_id: USER_IDS.workspaceadmin, role: 'workspace_admin', created_at: now }
];

export const seedWorkspaceMembers: WorkspaceMember[] = [
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
  { workspace: WORKSPACE_ID, user_id: USER_IDS.workspaceviewer, role: 'viewer', created_at: now }
];

export const seedEnums: WorkspaceEnum[] = [
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
  }
];

export const seedSchemas: EntitySchema[] = [
  {
    id: '00000000-0000-0000-0000-000000000001',
    workspace: WORKSPACE_ID,
    name: 'Domain',
    description: 'A high-level grouping that owns one or more Systems.',
    fields: [],
    color: AR_COLOR_YELLOW,
    icon: 'globe',
    default_owner: null,
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
        schemaId: '00000000-0000-0000-0000-000000000001',
        minCount: 1,
        maxCount: 1
      }
    ],
    color: AR_COLOR_PURPLE,
    icon: 'layers',
    default_owner: null,
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
        schemaId: '00000000-0000-0000-0000-000000000002',
        minCount: 1,
        maxCount: 1
      },
      {
        id: 'provides_apis',
        name: 'Provided APIs',
        type: 'reference',
        schemaId: '00000000-0000-0000-0000-000000000004',
        minCount: 0,
        maxCount: -1
      },
      {
        id: 'consumes_apis',
        name: 'Consumed APIs',
        type: 'reference',
        schemaId: '00000000-0000-0000-0000-000000000004',
        minCount: 0,
        maxCount: -1
      },
      {
        id: 'depends_on',
        name: 'Depends On',
        type: 'reference',
        schemaId: '00000000-0000-0000-0000-000000000003',
        minCount: 0,
        maxCount: -1
      }
    ],
    color: AR_COLOR_GREEN,
    icon: 'box',
    default_owner: null,
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
        schemaId: '00000000-0000-0000-0000-000000000002',
        minCount: 1,
        maxCount: 1
      }
    ],
    color: AR_COLOR_BLUE,
    icon: 'api',
    default_owner: null,
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
        schemaId: '00000000-0000-0000-0000-000000000002',
        minCount: 0,
        maxCount: 1
      }
    ],
    color: AR_COLOR_ORANGE,
    icon: 'database',
    default_owner: null,
    created_at: now,
    updated_at: now
  }
];

export const seedEntities: Entity[] = [
  {
    id: '00000000-0000-0000-0001-000000000001',
    workspace: WORKSPACE_ID,
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
    data: { domain: '00000000-0000-0000-0001-000000000001' },
    visibility_mode: null,
    created_at: now,
    updated_at: now
  },
  {
    id: '00000000-0000-0000-0002-000000000002',
    workspace: WORKSPACE_ID,
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
    data: { domain: '00000000-0000-0000-0001-000000000001' },
    visibility_mode: null,
    created_at: now,
    updated_at: now
  },
  {
    id: '00000000-0000-0000-0004-000000000001',
    workspace: WORKSPACE_ID,
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
    data: { api_type: 'openapi', system: '00000000-0000-0000-0002-000000000001' },
    visibility_mode: null,
    created_at: now,
    updated_at: now
  },
  {
    id: '00000000-0000-0000-0004-000000000002',
    workspace: WORKSPACE_ID,
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
    data: { api_type: 'grpc', system: '00000000-0000-0000-0002-000000000002' },
    visibility_mode: null,
    created_at: now,
    updated_at: now
  },
  {
    id: '00000000-0000-0000-0003-000000000001',
    workspace: WORKSPACE_ID,
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
      system: '00000000-0000-0000-0002-000000000001',
      provides_apis: '00000000-0000-0000-0004-000000000001',
      consumes_apis: '00000000-0000-0000-0004-000000000002'
    },
    visibility_mode: null,
    created_at: now,
    updated_at: now
  },
  {
    id: '00000000-0000-0000-0003-000000000002',
    workspace: WORKSPACE_ID,
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
      system: '00000000-0000-0000-0002-000000000001',
      consumes_apis: '00000000-0000-0000-0004-000000000001',
      depends_on: '00000000-0000-0000-0003-000000000001'
    },
    visibility_mode: null,
    created_at: now,
    updated_at: now
  },
  {
    id: '00000000-0000-0000-0003-000000000003',
    workspace: WORKSPACE_ID,
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
      system: '00000000-0000-0000-0002-000000000002',
      provides_apis: '00000000-0000-0000-0004-000000000002'
    },
    visibility_mode: null,
    created_at: now,
    updated_at: now
  },
  {
    id: '00000000-0000-0000-0005-000000000001',
    workspace: WORKSPACE_ID,
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
      system: '00000000-0000-0000-0002-000000000001'
    },
    visibility_mode: null,
    created_at: now,
    updated_at: now
  }
];

export const seedProjects: Project[] = [
  {
    id: '00000000-0000-0000-0010-000000000001',
    workspace: WORKSPACE_ID,
    name: 'Portal Redesign',
    description: 'Redesign of the customer portal frontend and API layer.',
    owner: TEAM_IDS.design,
    status: 'active',
    color: AR_COLOR_BLUE,
    created_at: now,
    updated_at: now
  },
  {
    id: '00000000-0000-0000-0010-000000000002',
    workspace: WORKSPACE_ID,
    name: 'Auth Migration',
    description: 'Migration from legacy auth to the new identity platform.',
    owner: TEAM_IDS.security,
    status: 'pinned',
    color: AR_COLOR_RED,
    created_at: now,
    updated_at: now
  }
];

export const seedSavedViews: SavedView[] = [
  {
    id: '00000000-0000-0000-0020-000000000001',
    workspace: WORKSPACE_ID,
    name: 'Production Systems',
    description: 'All systems currently in production',
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
    name: 'Security Radar',
    description: 'Radar view of security-related components',
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
    name: 'Platform Components',
    description: 'Components owned by Platform Engineering',
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
  }
];

export const seedProjectFiles: ProjectFile[] = [];
