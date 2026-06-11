export const seededTestPassword = 'test';

export const seededWorkspaces = {
  default: {
    id: '90000000-0000-0000-0000-000000000001',
    slug: 'default',
    name: 'Default Workspace',
    shortCode: 'DW',
    description: 'The default workspace'
  },
  second: {
    id: '90000000-0000-0000-0000-000000000002',
    slug: 'second',
    name: 'Second Workspace',
    shortCode: 'SW',
    description: 'A secondary workspace for testing multi-workspace scenarios'
  }
} as const;

export const seededUsers = {
  globalAdmin: {
    id: '91000000-0000-0000-0000-000000000001',
    userId: 'globaladmin',
    email: 'emma.lindqvist@example.com',
    displayName: 'Emma Lindqvist'
  },
  workspaceAdmin: {
    id: '91000000-0000-0000-0000-000000000002',
    userId: 'workspaceadmin',
    email: 'james.chen@example.com',
    displayName: 'James Chen'
  },
  workspaceOwner: {
    id: '91000000-0000-0000-0000-000000000003',
    userId: 'workspaceowner',
    email: 'sofia.martinez@example.com',
    displayName: 'Sofia Martinez'
  },
  platformTeamAdmin: {
    id: '91000000-0000-0000-0000-000000000004',
    userId: 'platformteamadmin',
    email: 'daniel.okonkwo@example.com',
    displayName: 'Daniel Okonkwo'
  },
  platformTeamEditor: {
    id: '91000000-0000-0000-0000-000000000005',
    userId: 'platformteameditor',
    email: 'anna.kowalski@example.com',
    displayName: 'Anna Kowalski'
  },
  designTeamAdmin: {
    id: '91000000-0000-0000-0000-000000000006',
    userId: 'designteamadmin',
    email: 'marcus.berg@example.com',
    displayName: 'Marcus Berg'
  },
  securityTeamAdmin: {
    id: '91000000-0000-0000-0000-000000000007',
    userId: 'securityteamadmin',
    email: 'lena.hoffmann@example.com',
    displayName: 'Lena Hoffmann'
  },
  workspaceEditor: {
    id: '91000000-0000-0000-0000-000000000008',
    userId: 'workspaceeditor',
    email: 'raj.patel@example.com',
    displayName: 'Raj Patel'
  },
  workspaceReviewer: {
    id: '91000000-0000-0000-0000-000000000009',
    userId: 'workspacereviewer',
    email: 'clara.dubois@example.com',
    displayName: 'Clara Dubois'
  },
  workspaceViewer: {
    id: '91000000-0000-0000-0000-00000000000a',
    userId: 'workspaceviewer',
    email: 'oscar.nilsson@example.com',
    displayName: 'Oscar Nilsson'
  }
} as const;

export const seededProjects = {
  authMigration: {
    id: '00000000-0000-0000-0010-000000000002',
    workspaceId: seededWorkspaces.default.id,
    name: 'Auth Migration'
  }
} as const;
