import type {
  Entity,
  EntitySchema,
  GlobalRoleAssignment,
  Project,
  ProjectFile,
  TeamMembership,
  Workspace,
  WorkspaceEnum,
  WorkspaceLifecycleState,
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

const now = new Date('2026-01-01T00:00:00.000Z');

export const seedWorkspaces: Workspace[] = [
  {
    id: 'default',
    name: 'Default Workspace',
    url_slug: 'default',
    short_code: 'DW',
    description: 'The default workspace',
    color: '',
    created_at: now,
    updated_at: now
  }
];

export const seedLifecycleStates: WorkspaceLifecycleState[] = [
  {
    id: 'proposed',
    workspace: 'default',
    label: 'Proposed',
    color: AR_COLOR_BLUE,
    sort_order: 0,
    created_at: now
  },
  {
    id: 'experimental',
    workspace: 'default',
    label: 'Experimental',
    color: AR_COLOR_BLUE,
    sort_order: 1,
    created_at: now
  },
  {
    id: 'production',
    workspace: 'default',
    label: 'Production',
    color: AR_COLOR_GREEN,
    sort_order: 2,
    created_at: now
  },
  {
    id: 'deprecated',
    workspace: 'default',
    label: 'Deprecated',
    color: AR_COLOR_YELLOW,
    sort_order: 3,
    created_at: now
  }
];

export const seedOwners: WorkspaceOwner[] = [
  {
    id: 'Platform Engineering',
    workspace: 'default',
    sort_order: 0,
    color: AR_COLOR_GREEN,
    description: 'Responsible for platform infrastructure and core services',
    created_at: now
  },
  {
    id: 'Design Systems',
    workspace: 'default',
    sort_order: 1,
    color: AR_COLOR_BLUE,
    description: 'Maintains design system and UI component libraries',
    created_at: now
  },
  {
    id: 'Security & Compliance',
    workspace: 'default',
    sort_order: 2,
    color: AR_COLOR_RED,
    description: 'Ensures security standards and regulatory compliance',
    created_at: now
  },
  {
    id: 'Data Platform',
    workspace: 'default',
    sort_order: 3,
    color: AR_COLOR_PURPLE,
    description: 'Manages data infrastructure and analytics pipelines',
    created_at: now
  }
];

export const seedLocalUsers = [
  {
    id: 'globaladmin',
    email: 'emma.lindqvist@example.com',
    display_name: 'Emma Lindqvist',
    color: AR_COLOR_GREEN
  },
  {
    id: 'workspaceadmin',
    email: 'james.chen@example.com',
    display_name: 'James Chen',
    color: AR_COLOR_BLUE
  },
  {
    id: 'workspaceowner',
    email: 'sofia.martinez@example.com',
    display_name: 'Sofia Martinez',
    color: AR_COLOR_ORANGE
  },
  {
    id: 'platformteamadmin',
    email: 'daniel.okonkwo@example.com',
    display_name: 'Daniel Okonkwo',
    color: AR_COLOR_PURPLE
  },
  {
    id: 'platformteameditor',
    email: 'anna.kowalski@example.com',
    display_name: 'Anna Kowalski',
    color: AR_COLOR_YELLOW
  },
  {
    id: 'designteamadmin',
    email: 'marcus.berg@example.com',
    display_name: 'Marcus Berg',
    color: AR_COLOR_RED
  },
  {
    id: 'securityteamadmin',
    email: 'lena.hoffmann@example.com',
    display_name: 'Lena Hoffmann',
    color: AR_COLOR_PINK
  },
  {
    id: 'workspaceeditor',
    email: 'raj.patel@example.com',
    display_name: 'Raj Patel',
    color: AR_COLOR_CYAN
  },
  {
    id: 'workspacereviewer',
    email: 'clara.dubois@example.com',
    display_name: 'Clara Dubois',
    color: AR_COLOR_TEAL
  },
  {
    id: 'workspaceviewer',
    email: 'oscar.nilsson@example.com',
    display_name: 'Oscar Nilsson',
    color: AR_COLOR_AMBER
  }
] as const;

export const seedTeamAssignments: TeamMembership[] = [
  // Platform Engineering
  {
    workspace: 'default',
    team_id: 'Platform Engineering',
    user_id: 'platformteamadmin',
    role: 'team_admin',
    created_at: now
  },
  {
    workspace: 'default',
    team_id: 'Platform Engineering',
    user_id: 'platformteameditor',
    role: 'team_editor',
    created_at: now
  },
  {
    workspace: 'default',
    team_id: 'Platform Engineering',
    user_id: 'workspaceeditor',
    role: 'team_reviewer',
    created_at: now
  },
  {
    workspace: 'default',
    team_id: 'Platform Engineering',
    user_id: 'globaladmin',
    role: 'team_admin',
    created_at: now
  },

  // Design Systems
  {
    workspace: 'default',
    team_id: 'Design Systems',
    user_id: 'designteamadmin',
    role: 'team_admin',
    created_at: now
  },
  {
    workspace: 'default',
    team_id: 'Design Systems',
    user_id: 'workspacereviewer',
    role: 'team_editor',
    created_at: now
  },
  {
    workspace: 'default',
    team_id: 'Design Systems',
    user_id: 'workspaceviewer',
    role: 'team_reviewer',
    created_at: now
  },

  // Security & Compliance
  {
    workspace: 'default',
    team_id: 'Security & Compliance',
    user_id: 'securityteamadmin',
    role: 'team_admin',
    created_at: now
  },
  {
    workspace: 'default',
    team_id: 'Security & Compliance',
    user_id: 'workspaceadmin',
    role: 'team_editor',
    created_at: now
  },
  {
    workspace: 'default',
    team_id: 'Security & Compliance',
    user_id: 'globaladmin',
    role: 'team_reviewer',
    created_at: now
  },

  // Data Platform
  {
    workspace: 'default',
    team_id: 'Data Platform',
    user_id: 'workspaceowner',
    role: 'team_admin',
    created_at: now
  },
  {
    workspace: 'default',
    team_id: 'Data Platform',
    user_id: 'workspaceeditor',
    role: 'team_editor',
    created_at: now
  },
  {
    workspace: 'default',
    team_id: 'Data Platform',
    user_id: 'workspaceviewer',
    role: 'team_reviewer',
    created_at: now
  }
];

export const seedGlobalRoleAssignments: GlobalRoleAssignment[] = [
  { user_id: 'globaladmin', role: 'global_admin', created_at: now },
  { user_id: 'globaladmin', role: 'workspace_admin', created_at: now },
  { user_id: 'workspaceadmin', role: 'workspace_admin', created_at: now }
];

export const seedWorkspaceMembers: WorkspaceMember[] = [
  { workspace: 'default', user_id: 'workspaceowner', role: 'owner', created_at: now },
  { workspace: 'default', user_id: 'globaladmin', role: 'admin', created_at: now },
  { workspace: 'default', user_id: 'workspaceadmin', role: 'admin', created_at: now },
  { workspace: 'default', user_id: 'platformteamadmin', role: 'editor', created_at: now },
  { workspace: 'default', user_id: 'platformteameditor', role: 'editor', created_at: now },
  { workspace: 'default', user_id: 'designteamadmin', role: 'editor', created_at: now },
  { workspace: 'default', user_id: 'securityteamadmin', role: 'editor', created_at: now },
  { workspace: 'default', user_id: 'workspaceeditor', role: 'editor', created_at: now },
  { workspace: 'default', user_id: 'workspacereviewer', role: 'reviewer', created_at: now },
  { workspace: 'default', user_id: 'workspaceviewer', role: 'viewer', created_at: now }
];

export const seedEnums: WorkspaceEnum[] = [
  {
    id: '00000000-0000-0000-0000-e00000000001',
    workspace: 'default',
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
    workspace: 'default',
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
    workspace: 'default',
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
    workspace: 'default',
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
    workspace: 'default',
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
    workspace: 'default',
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
    workspace: 'default',
    slug: 'engineering',
    namespace: 'default',
    name: 'Engineering',
    description:
      'The core engineering domain covering all customer-facing products and infrastructure.',
    owner: 'Platform Engineering',
    lifecycle: 'production',
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
    workspace: 'default',
    slug: 'customer-portal',
    namespace: 'default',
    name: 'Customer Portal',
    description: 'Public-facing portal for customer self-service.',
    owner: 'Design Systems',
    lifecycle: 'production',
    target_lifecycle: 'deprecated',
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
    workspace: 'default',
    slug: 'identity-platform',
    namespace: 'default',
    name: 'Identity Platform',
    description: 'Centralised authentication and authorisation service.',
    owner: 'Security & Compliance',
    lifecycle: 'production',
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
    workspace: 'default',
    slug: 'customer-api',
    namespace: 'default',
    name: 'Customer API',
    description: 'REST API exposing customer data to the portal frontend.',
    owner: 'Platform Engineering',
    lifecycle: 'production',
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
    workspace: 'default',
    slug: 'auth-api',
    namespace: 'default',
    name: 'Auth API',
    description: 'gRPC API for token issuance and validation.',
    owner: 'Security & Compliance',
    lifecycle: 'production',
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
    workspace: 'default',
    slug: 'api-gateway',
    namespace: 'default',
    name: 'API Gateway',
    description: 'Edge gateway that routes requests and enforces rate limits.',
    owner: 'Platform Engineering',
    lifecycle: 'production',
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
    workspace: 'default',
    slug: 'frontend-app',
    namespace: 'default',
    name: 'Frontend App',
    description: 'React single-page application served to end users.',
    owner: 'Design Systems',
    lifecycle: 'production',
    target_lifecycle: 'deprecated',
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
    workspace: 'default',
    slug: 'auth-service',
    namespace: 'default',
    name: 'Auth Service',
    description: 'Issues and validates JWTs; integrates with the identity platform.',
    owner: 'Security & Compliance',
    lifecycle: 'experimental',
    target_lifecycle: 'production',
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
    workspace: 'default',
    slug: 'postgres-main',
    namespace: 'default',
    name: 'Postgres Main',
    description: 'Primary PostgreSQL cluster used by the Customer Portal system.',
    owner: 'Platform Engineering',
    lifecycle: 'production',
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
    workspace: 'default',
    name: 'Portal Redesign',
    description: 'Redesign of the customer portal frontend and API layer.',
    owner: 'Design Systems',
    status: 'active',
    color: AR_COLOR_BLUE,
    created_at: now,
    updated_at: now
  },
  {
    id: '00000000-0000-0000-0010-000000000002',
    workspace: 'default',
    name: 'Auth Migration',
    description: 'Migration from legacy auth to the new identity platform.',
    owner: 'Security & Compliance',
    status: 'pinned',
    color: AR_COLOR_RED,
    created_at: now,
    updated_at: now
  }
];

export const seedSavedViews: SavedView[] = [
  {
    id: '00000000-0000-0000-0020-000000000001',
    workspace: 'default',
    name: 'Production Systems',
    description: 'All systems currently in production',
    view_mode: 'table',
    filters: {
      status: 'production',
      schemaId: '00000000-0000-0000-0000-000000000002'
    },
    config: null,
    created_at: now,
    updated_at: now
  },
  {
    id: '00000000-0000-0000-0020-000000000002',
    workspace: 'default',
    name: 'Security Radar',
    description: 'Radar view of security-related components',
    view_mode: 'radar',
    filters: {},
    config: {
      radar: {
        schemaId: '00000000-0000-0000-0000-000000000003',
        quadrantFieldId: '_lifecycle',
        ringFieldId: '_lifecycle',
        ringOrder: ['proposed', 'experimental', 'production', 'deprecated']
      }
    },
    created_at: now,
    updated_at: now
  },
  {
    id: '00000000-0000-0000-0020-000000000003',
    workspace: 'default',
    name: 'Platform Components',
    description: 'Components owned by Platform Engineering',
    view_mode: 'cards',
    filters: {
      owner: 'Platform Engineering',
      schemaId: '00000000-0000-0000-0000-000000000003'
    },
    config: null,
    created_at: now,
    updated_at: now
  }
];

export const seedProjectFiles: ProjectFile[] = [];
