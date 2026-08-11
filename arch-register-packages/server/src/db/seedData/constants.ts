import { seededUsers, seededWorkspaces } from '../seedFixtures';

export const now = new Date('2026-01-01T00:00:00.000Z');

export const WORKSPACE_ID = seededWorkspaces.default.id;
export const WORKSPACE2_ID = seededWorkspaces.second.id;

export const API_PROVIDER_RELATION_SCHEMA_ID = '00000000-0000-0000-0000-000000000034';
export const API_CONSUMER_RELATION_SCHEMA_ID = '00000000-0000-0000-0000-000000000035';

export const LIFECYCLE_IDS = {
  proposed: '90000000-0000-0000-0000-000000000011',
  experimental: '90000000-0000-0000-0000-000000000012',
  production: '90000000-0000-0000-0000-000000000013',
  deprecated: '90000000-0000-0000-0000-000000000014'
} as const;

export const LIFECYCLE2_IDS = {
  active: '90000000-0000-0000-0000-000000000015',
  beta: '90000000-0000-0000-0000-000000000016',
  stable: '90000000-0000-0000-0000-000000000017',
  retired: '90000000-0000-0000-0000-000000000018'
} as const;

export const TEAM_IDS = {
  platform: '90000000-0000-0000-0000-000000000021',
  design: '90000000-0000-0000-0000-000000000022',
  security: '90000000-0000-0000-0000-000000000023',
  data: '90000000-0000-0000-0000-000000000024',
  payments: '90000000-0000-0000-0000-000000000027'
} as const;

export const TEAM2_IDS = {
  mobile: '90000000-0000-0000-0000-000000000025',
  backend: '90000000-0000-0000-0000-000000000026'
} as const;

export const COLLECTION_IDS = {
  criticalSystems: '00000000-0000-0000-0030-000000000001',
  apisToReview: '00000000-0000-0000-0030-000000000002'
} as const;

export const TECHNOLOGY_IDS = {
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

export const TECHNOLOGY_RELEASE_IDS = {
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

export const USER_IDS = {
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

export const PROJECT_ENTITY_TYPE_IDS = {
  introduced: '90000000-0000-0000-0000-000000000201',
  decommissioned: '90000000-0000-0000-0000-000000000202',
  modified: '90000000-0000-0000-0000-000000000203',
  used: '90000000-0000-0000-0000-000000000204'
} as const;

export const MILESTONE_IDS = {
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

export const PII_FIELD_GROUP_ID = '00000000-0000-0000-0000-f00000000001';

export const AUTH_API_ENTITY_ID = '00000000-0000-0000-0004-000000000002';

export const CONTENT_IDS = {
  authApiOverviewFolder: '00000000-0000-0000-0030-000000000001',
  authApiOverviewDiagram: '00000000-0000-0000-0030-000000000002',
  authApiSequenceDiagram: '00000000-0000-0000-0030-000000000003',
  authApiSecurityFolder: '00000000-0000-0000-0030-000000000004',
  authApiThreatModel: '00000000-0000-0000-0030-000000000005',
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
  checkoutRevampPlanningFolder: '00000000-0000-0000-0032-000000000001',
  checkoutRevampProjectBrief: '00000000-0000-0000-0032-000000000002',
  checkoutRevampRolloutPlan: '00000000-0000-0000-0032-000000000003'
} as const;

export const DATA_FLOW_SCHEMA_ID = '00000000-0000-0000-0000-000000000030';
export const RISK_CONTROL_SCHEMA_ID = '00000000-0000-0000-0000-000000000032';
export const CONTROL_REQUIREMENT_SCHEMA_ID = '00000000-0000-0000-0000-000000000033';
