import {
  AR_COLOR_AMBER,
  AR_COLOR_BLUE,
  AR_COLOR_CYAN,
  AR_COLOR_GREEN,
  AR_COLOR_ORANGE,
  AR_COLOR_PINK,
  AR_COLOR_PURPLE,
  AR_COLOR_RED,
  AR_COLOR_TEAL,
  AR_COLOR_YELLOW
} from '@arch-register/api-types/colors';

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
    displayName: 'Emma Lindqvist',
    color: AR_COLOR_GREEN
  },
  workspaceAdmin: {
    id: '91000000-0000-0000-0000-000000000002',
    userId: 'workspaceadmin',
    email: 'james.chen@example.com',
    displayName: 'James Chen',
    color: AR_COLOR_BLUE
  },
  workspaceOwner: {
    id: '91000000-0000-0000-0000-000000000003',
    userId: 'workspaceowner',
    email: 'sofia.martinez@example.com',
    displayName: 'Sofia Martinez',
    color: AR_COLOR_ORANGE
  },
  platformTeamAdmin: {
    id: '91000000-0000-0000-0000-000000000004',
    userId: 'platformteamadmin',
    email: 'daniel.okonkwo@example.com',
    displayName: 'Daniel Okonkwo',
    color: AR_COLOR_PURPLE
  },
  platformTeamEditor: {
    id: '91000000-0000-0000-0000-000000000005',
    userId: 'platformteameditor',
    email: 'anna.kowalski@example.com',
    displayName: 'Anna Kowalski',
    color: AR_COLOR_YELLOW
  },
  designTeamAdmin: {
    id: '91000000-0000-0000-0000-000000000006',
    userId: 'designteamadmin',
    email: 'marcus.berg@example.com',
    displayName: 'Marcus Berg',
    color: AR_COLOR_RED
  },
  securityTeamAdmin: {
    id: '91000000-0000-0000-0000-000000000007',
    userId: 'securityteamadmin',
    email: 'lena.hoffmann@example.com',
    displayName: 'Lena Hoffmann',
    color: AR_COLOR_PINK
  },
  workspaceEditor: {
    id: '91000000-0000-0000-0000-000000000008',
    userId: 'workspaceeditor',
    email: 'raj.patel@example.com',
    displayName: 'Raj Patel',
    color: AR_COLOR_CYAN
  },
  workspaceReviewer: {
    id: '91000000-0000-0000-0000-000000000009',
    userId: 'workspacereviewer',
    email: 'clara.dubois@example.com',
    displayName: 'Clara Dubois',
    color: AR_COLOR_TEAL
  },
  workspaceViewer: {
    id: '91000000-0000-0000-0000-00000000000a',
    userId: 'workspaceviewer',
    email: 'oscar.nilsson@example.com',
    displayName: 'Oscar Nilsson',
    color: AR_COLOR_AMBER
  }
} as const;

export const seededProjects = {
  portalRedesign: {
    id: '00000000-0000-0000-0010-000000000001',
    publicId: 'DW-1',
    workspaceId: seededWorkspaces.default.id,
    name: 'Portal Redesign'
  },
  authMigration: {
    id: '00000000-0000-0000-0010-000000000002',
    publicId: 'DW-2',
    workspaceId: seededWorkspaces.default.id,
    name: 'Auth Migration'
  },
  checkoutRevamp: {
    id: '00000000-0000-0000-0010-000000000003',
    publicId: 'DW-3',
    workspaceId: seededWorkspaces.default.id,
    name: 'Checkout Revamp'
  }
} as const;

export const seededAssessments = {
  checkoutRevamp: {
    securityReadiness: {
      id: '00000000-0000-0000-0011-000000000001',
      projectId: seededProjects.checkoutRevamp.id,
      name: 'Security Readiness'
    },
    apiFitness: {
      id: '00000000-0000-0000-0011-000000000002',
      projectId: seededProjects.checkoutRevamp.id,
      name: 'API Fitness'
    }
  }
} as const;

export const seededSchemas = {
  default: {
    domain: {
      id: '00000000-0000-0000-0000-000000000001',
      workspaceId: seededWorkspaces.default.id,
      name: 'Domain'
    },
    system: {
      id: '00000000-0000-0000-0000-000000000002',
      workspaceId: seededWorkspaces.default.id,
      name: 'System'
    },
    component: {
      id: '00000000-0000-0000-0000-000000000003',
      workspaceId: seededWorkspaces.default.id,
      name: 'Component'
    },
    api: {
      id: '00000000-0000-0000-0000-000000000004',
      workspaceId: seededWorkspaces.default.id,
      name: 'API'
    },
    resource: {
      id: '00000000-0000-0000-0000-000000000005',
      workspaceId: seededWorkspaces.default.id,
      name: 'Resource'
    }
  },
  second: {
    application: {
      id: '00000000-0000-0000-0000-000000000011',
      workspaceId: seededWorkspaces.second.id,
      name: 'Application'
    },
    service: {
      id: '00000000-0000-0000-0000-000000000012',
      workspaceId: seededWorkspaces.second.id,
      name: 'Service'
    }
  }
} as const;

export const seededEntities = {
  default: {
    customerPortal: {
      id: '00000000-0000-0000-0002-000000000001',
      publicId: 'SYS-1',
      workspaceId: seededWorkspaces.default.id,
      schemaId: seededSchemas.default.system.id,
      name: 'Customer Portal'
    },
    customerApi: {
      id: '00000000-0000-0000-0004-000000000001',
      publicId: 'API-1',
      workspaceId: seededWorkspaces.default.id,
      schemaId: seededSchemas.default.api.id,
      name: 'Customer API'
    },
    authApi: {
      id: '00000000-0000-0000-0004-000000000002',
      publicId: 'API-2',
      workspaceId: seededWorkspaces.default.id,
      schemaId: seededSchemas.default.api.id,
      name: 'Auth API'
    },
    frontendApp: {
      id: '00000000-0000-0000-0003-000000000002',
      publicId: 'CMP-2',
      workspaceId: seededWorkspaces.default.id,
      schemaId: seededSchemas.default.component.id,
      name: 'Frontend App'
    },
    authService: {
      id: '00000000-0000-0000-0003-000000000003',
      publicId: 'CMP-3',
      workspaceId: seededWorkspaces.default.id,
      schemaId: seededSchemas.default.component.id,
      name: 'Auth Service'
    }
  },
  second: {
    notificationsService: {
      id: '00000000-0000-0000-0012-000000000001',
      publicId: 'SVC-1',
      workspaceId: seededWorkspaces.second.id,
      schemaId: seededSchemas.second.service.id,
      name: 'Notifications Service'
    },
    deliveryService: {
      id: '00000000-0000-0000-0012-000000000002',
      publicId: 'SVC-2',
      workspaceId: seededWorkspaces.second.id,
      schemaId: seededSchemas.second.service.id,
      name: 'Delivery Service'
    }
  }
} as const;
