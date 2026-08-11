import {
  AR_COLOR_BLUE,
  AR_COLOR_CYAN,
  AR_COLOR_GREEN,
  AR_COLOR_ORANGE,
  AR_COLOR_PURPLE,
  AR_COLOR_RED,
  AR_COLOR_TEAL,
  AR_COLOR_YELLOW
} from '@arch-register/api-types/colors';
import type {
  AssessmentTypeDbResult,
  LifecycleStateDbResult,
  MemberDbResult,
  OwnerDbResult,
  ProjectEntityTypeDbResult,
  TeamMembershipDbResult,
  WorkspaceDbResult
} from '../../domain/workspace/db/workspaceDatabase';
import type { GlobalRoleAssignmentDbResult } from '../../domain/auth/db/authDatabase';
import {
  LIFECYCLE2_IDS,
  LIFECYCLE_IDS,
  TEAM2_IDS,
  TEAM_IDS,
  USER_IDS,
  WORKSPACE2_ID,
  WORKSPACE_ID,
  now
} from './constants';
import { seededUsers, seededWorkspaces } from '../seedFixtures';

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

export const seedAssessmentTypes: AssessmentTypeDbResult[] = [
  {
    id: '00000000-0000-0000-0024-000000000001',
    workspace: WORKSPACE_ID,
    name: 'Risk & compliance',
    sort_order: 0,
    created_at: now,
    updated_at: now
  },
  {
    id: '00000000-0000-0000-0024-000000000002',
    workspace: WORKSPACE_ID,
    name: 'Quality Review',
    sort_order: 1,
    created_at: now,
    updated_at: now
  },
  {
    id: '00000000-0000-0000-0024-000000000003',
    workspace: WORKSPACE_ID,
    name: 'Project',
    sort_order: 2,
    created_at: now,
    updated_at: now
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
