import type { EventHandler, H3 } from 'h3';
import type { DatabaseAdapter } from './db/database';
import type { StorageAdapter } from './storage/storage';
import { API_PREFIXES } from './constants';
import { createOidcCallbackRoute } from './domain/auth/oidcCallbackRoute';
import {
  createPublicAuthORPCHandler,
  createProtectedAuthORPCHandler
} from './domain/auth/authOrpc';
import { createWorkspaceEnumORPCHandler } from './domain/catalog/enumOrpc';
import { createWorkspaceFieldGroupORPCHandler } from './domain/catalog/fieldGroupOrpc';
import { createWorkspaceSchemaORPCHandler } from './domain/catalog/schemaOrpc';
import { createWorkspaceRelationSchemaORPCHandler } from './domain/catalog/relationSchemaOrpc';
import {
  createWorkspaceRelationORPCHandler,
  createIntegrationRelationORPCHandler
} from './domain/catalog/relationOrpc';
import { createWorkspaceEntityORPCHandler } from './domain/catalog/entityOrpc';
import { createEntitySyncORPCHandler } from './domain/externalIdentity/entitySyncOrpc';
import { createApiSpecificationSyncORPCHandler } from './domain/artifact/apiSpecificationSyncOrpc';
import { createRelationSyncORPCHandler } from './domain/catalog/relationSyncOrpc';
import { createEntityVersionORPCHandler } from './domain/catalog/entityVersionOrpc';
import { createRelationVersionORPCHandler } from './domain/catalog/relationVersionOrpc';
import { createEntityChangeORPCHandler } from './domain/catalog/entityChangeOrpc';
import { createRelationChangeORPCHandler } from './domain/catalog/relationChangeOrpc';
import { createWorkspaceTemplateORPCHandler } from './domain/catalog/templateOrpc';
import { createWorkspaceViewORPCHandler } from './domain/catalog/viewOrpc';
import { createWorkspaceDashboardORPCHandler } from './domain/dashboard/dashboardOrpc';
import { createPersonalDashboardORPCHandler } from './domain/personalDashboard/personalDashboardOrpc';
import { createProjectDashboardORPCHandler } from './domain/dashboard/projectDashboardOrpc';
import { createWorkspaceCollectionORPCHandler } from './domain/catalog/collectionOrpc';
import { createWorkspaceManagementORPCHandler } from './domain/workspace/workspaceOrpc';
import { createWorkspaceConfigORPCHandler } from './domain/workspace/workspaceConfigOrpc';
import { createProjectORPCHandler } from './domain/project/projectOrpc';
import { createProjectFileRoutesHandler } from './domain/project/projectFileRoutes';
import { createAssessmentORPCHandler } from './domain/project/assessmentOrpc';
import { createAssessmentResponseORPCHandler } from './domain/project/assessmentResponseOrpc';
import { createMilestoneORPCHandler } from './domain/project/projectMilestoneOrpc';
import { createChangeCaseORPCHandler } from './domain/project/projectChangeCaseOrpc';
import { createAuditORPCHandler } from './domain/audit/auditOrpc';
import { createWatchORPCHandler } from './domain/watch/watchOrpc';
import { createNotificationPreferencesORPCHandler } from './domain/notification/notificationPreferenceOrpc';
import { createDiscussionORPCHandler } from './domain/discussion/discussionOrpc';
import { createGovernanceORPCHandler } from './domain/governance/governanceOrpc';
import { createIntegrationGovernanceORPCHandler } from './domain/governance/integrationGovernanceOrpc';
import { createGovernanceWorkflowConfigORPCHandler } from './domain/governance/governanceWorkflowConfigOrpc';
import { createWikiCommentORPCHandler } from './domain/wikiComments/wikiCommentOrpc';
import { createSearchORPCHandler } from './domain/search/searchOrpc';
import { createDevORPCHandler } from './domain/dev/devOrpc';
import { createAiORPCHandler } from './domain/ai/aiOrpc';
import { createDiagramCraftORPCHandler } from './domain/diagram/diagramCraftOrpc';
import { createWorkspaceAnalyticsORPCHandler } from './domain/analytics/workspaceAnalyticsOrpc';
import { createWorkspaceMetricORPCHandler } from './domain/metrics/metricOrpc';
import { createJobsORPCHandler } from './domain/jobs/jobsOrpc';
import { createExternalContentORPCHandler } from './domain/external-content/externalContentOrpc';
import { createWebhookORPCHandler } from './domain/webhook/webhookOrpc';
import { createAutomationRuleORPCHandler } from './domain/automation/automationRuleOrpc';
import { createDocumentORPCHandler } from './domain/document/documentOrpc';
import { createEntityDeprecationORPCHandler } from './domain/catalog/entityDeprecationOrpc';
import { createArtifactORPCHandler } from './domain/artifact/artifactOrpc';
import { createBaselineORPCHandler } from './domain/baseline/baselineOrpc';
import {
  createPublicCatalogConfigORPCHandler,
  createPublicCatalogORPCHandler
} from './domain/publicCatalog/publicCatalogOrpc';
import { createApplicationGovernanceRegistry } from './domain/governance/governanceRegistryFactory';
import type { GovernanceRegistry } from './domain/governance/governanceRegistry';

export type RouteOverrides = {
  aiChat?: Parameters<typeof createAiORPCHandler>[1];
};

export type RouteRegistrationDependencies = {
  db: DatabaseAdapter;
  storage: StorageAdapter;
  routeOverrides?: RouteOverrides;
  governanceRegistry: GovernanceRegistry;
};

export type RouteRegistryDependencies = Omit<
  RouteRegistrationDependencies,
  'governanceRegistry'
> & {
  governanceRegistry?: GovernanceRegistry;
};

export type RouteAuth = 'public' | 'protected';
export type RouteKind = 'orpc' | 'explicit';
export type RouteDependency = keyof RouteRegistrationDependencies;
export type RoutePrefix = (typeof API_PREFIXES)[keyof typeof API_PREFIXES];
type RouteMount = EventHandler | H3;

type RouteDescriptorBase = {
  id: string;
  auth: RouteAuth;
  kind: RouteKind;
  dependencies: readonly RouteDependency[];
  prefix: RoutePrefix;
  surfaces: readonly RoutePrefix[];
  precedence: number;
};

export type OrpcRouteDescriptor = RouteDescriptorBase & {
  kind: 'orpc';
  create: (dependencies: RouteRegistrationDependencies) => RouteMount;
};

export type ExplicitRouteDescriptor = RouteDescriptorBase & {
  kind: 'explicit';
  register: (app: H3, dependencies: RouteRegistrationDependencies) => void | (() => void);
};

export type RouteDescriptor = OrpcRouteDescriptor | ExplicitRouteDescriptor;
type RouteDefinition =
  | Omit<OrpcRouteDescriptor, 'precedence'>
  | Omit<ExplicitRouteDescriptor, 'precedence'>;

const publicRouteDefinitions = [
  {
    id: 'public-auth',
    auth: 'public',
    kind: 'orpc',
    dependencies: ['db'],
    prefix: API_PREFIXES.root,
    surfaces: [API_PREFIXES.root],
    create: ({ db }) => createPublicAuthORPCHandler(db)
  },
  {
    id: 'public-catalog',
    auth: 'public',
    kind: 'explicit',
    dependencies: ['db', 'storage'],
    prefix: API_PREFIXES.publicCatalog,
    surfaces: [API_PREFIXES.publicCatalog],
    register: (app, { db, storage }) => {
      app.use(createPublicCatalogORPCHandler(db, storage));
    }
  },
  {
    id: 'dev',
    auth: 'public',
    kind: 'orpc',
    dependencies: ['db'],
    prefix: API_PREFIXES.root,
    surfaces: [API_PREFIXES.root],
    create: ({ db }) => createDevORPCHandler(db)
  },
  {
    id: 'oidc-callback',
    auth: 'public',
    kind: 'explicit',
    dependencies: ['db'],
    prefix: API_PREFIXES.root,
    surfaces: [API_PREFIXES.root],
    register: (app, { db }) => {
      const route = createOidcCallbackRoute(db);
      app.use(route.app);
      return route.dispose;
    }
  }
] satisfies readonly RouteDefinition[];

const protectedRouteDefinitions = [
  {
    id: 'protected-auth',
    auth: 'protected',
    kind: 'orpc',
    dependencies: ['db'],
    prefix: API_PREFIXES.root,
    surfaces: [API_PREFIXES.root],
    create: ({ db }) => createProtectedAuthORPCHandler(db)
  },
  {
    id: 'workspace-management',
    auth: 'protected',
    kind: 'orpc',
    dependencies: ['db', 'storage'],
    prefix: API_PREFIXES.application,
    surfaces: [API_PREFIXES.application],
    create: ({ db, storage }) => createWorkspaceManagementORPCHandler(db, storage)
  },
  {
    id: 'workspace-enums',
    auth: 'protected',
    kind: 'orpc',
    dependencies: ['db'],
    prefix: API_PREFIXES.application,
    surfaces: [API_PREFIXES.application],
    create: ({ db }) => createWorkspaceEnumORPCHandler(db)
  },
  {
    id: 'workspace-field-groups',
    auth: 'protected',
    kind: 'orpc',
    dependencies: ['db'],
    prefix: API_PREFIXES.application,
    surfaces: [API_PREFIXES.application],
    create: ({ db }) => createWorkspaceFieldGroupORPCHandler(db)
  },
  {
    id: 'workspace-schemas',
    auth: 'protected',
    kind: 'orpc',
    dependencies: ['db'],
    prefix: API_PREFIXES.root,
    surfaces: [API_PREFIXES.application, API_PREFIXES.integrations],
    create: ({ db }) => createWorkspaceSchemaORPCHandler(db)
  },
  {
    id: 'workspace-relation-schemas',
    auth: 'protected',
    kind: 'orpc',
    dependencies: ['db'],
    prefix: API_PREFIXES.application,
    surfaces: [API_PREFIXES.application],
    create: ({ db }) => createWorkspaceRelationSchemaORPCHandler(db)
  },
  {
    id: 'workspace-relations',
    auth: 'protected',
    kind: 'orpc',
    dependencies: ['db'],
    prefix: API_PREFIXES.application,
    surfaces: [API_PREFIXES.application],
    create: ({ db }) => createWorkspaceRelationORPCHandler(db)
  },
  {
    id: 'integration-relations',
    auth: 'protected',
    kind: 'orpc',
    dependencies: ['db'],
    prefix: API_PREFIXES.root,
    surfaces: [API_PREFIXES.integrations],
    create: ({ db }) => createIntegrationRelationORPCHandler(db)
  },
  {
    id: 'integration-governance',
    auth: 'protected',
    kind: 'orpc',
    dependencies: ['db'],
    prefix: API_PREFIXES.root,
    surfaces: [API_PREFIXES.integrations],
    create: ({ db }) => createIntegrationGovernanceORPCHandler(db)
  },
  {
    id: 'workspace-entities',
    auth: 'protected',
    kind: 'orpc',
    dependencies: ['db'],
    prefix: API_PREFIXES.application,
    surfaces: [API_PREFIXES.application],
    create: ({ db }) => createWorkspaceEntityORPCHandler(db)
  },
  {
    id: 'entity-sync',
    auth: 'protected',
    kind: 'orpc',
    dependencies: ['db'],
    prefix: API_PREFIXES.root,
    surfaces: [API_PREFIXES.integrations],
    create: ({ db }) => createEntitySyncORPCHandler(db)
  },
  {
    id: 'api-specification-sync',
    auth: 'protected',
    kind: 'orpc',
    dependencies: ['db'],
    prefix: API_PREFIXES.root,
    surfaces: [API_PREFIXES.integrations],
    create: ({ db }) => createApiSpecificationSyncORPCHandler(db)
  },
  {
    id: 'relation-sync',
    auth: 'protected',
    kind: 'orpc',
    dependencies: ['db'],
    prefix: API_PREFIXES.root,
    surfaces: [API_PREFIXES.integrations],
    create: ({ db }) => createRelationSyncORPCHandler(db)
  },
  {
    id: 'entity-versions',
    auth: 'protected',
    kind: 'orpc',
    dependencies: ['db'],
    prefix: API_PREFIXES.application,
    surfaces: [API_PREFIXES.application],
    create: ({ db }) => createEntityVersionORPCHandler(db)
  },
  {
    id: 'relation-versions',
    auth: 'protected',
    kind: 'orpc',
    dependencies: ['db'],
    prefix: API_PREFIXES.application,
    surfaces: [API_PREFIXES.application],
    create: ({ db }) => createRelationVersionORPCHandler(db)
  },
  {
    id: 'entity-changes',
    auth: 'protected',
    kind: 'orpc',
    dependencies: ['db'],
    prefix: API_PREFIXES.application,
    surfaces: [API_PREFIXES.application],
    create: ({ db }) => createEntityChangeORPCHandler(db)
  },
  {
    id: 'relation-changes',
    auth: 'protected',
    kind: 'orpc',
    dependencies: ['db'],
    prefix: API_PREFIXES.application,
    surfaces: [API_PREFIXES.application],
    create: ({ db }) => createRelationChangeORPCHandler(db)
  },
  {
    id: 'entity-deprecation',
    auth: 'protected',
    kind: 'orpc',
    dependencies: ['db'],
    prefix: API_PREFIXES.application,
    surfaces: [API_PREFIXES.application],
    create: ({ db }) => createEntityDeprecationORPCHandler(db)
  },
  {
    id: 'artifacts',
    auth: 'protected',
    kind: 'orpc',
    dependencies: ['db'],
    prefix: API_PREFIXES.root,
    surfaces: [API_PREFIXES.application],
    create: ({ db }) => createArtifactORPCHandler(db)
  },
  {
    id: 'baselines',
    auth: 'protected',
    kind: 'orpc',
    dependencies: ['db'],
    prefix: API_PREFIXES.application,
    surfaces: [API_PREFIXES.application],
    create: ({ db }) => createBaselineORPCHandler(db)
  },
  {
    id: 'workspace-templates',
    auth: 'protected',
    kind: 'orpc',
    dependencies: ['db', 'storage'],
    prefix: API_PREFIXES.application,
    surfaces: [API_PREFIXES.application],
    create: ({ db, storage }) => createWorkspaceTemplateORPCHandler(db, storage)
  },
  {
    id: 'workspace-views',
    auth: 'protected',
    kind: 'orpc',
    dependencies: ['db'],
    prefix: API_PREFIXES.application,
    surfaces: [API_PREFIXES.application],
    create: ({ db }) => createWorkspaceViewORPCHandler(db)
  },
  {
    id: 'workspace-dashboards',
    auth: 'protected',
    kind: 'orpc',
    dependencies: ['db'],
    prefix: API_PREFIXES.application,
    surfaces: [API_PREFIXES.application],
    create: ({ db }) => createWorkspaceDashboardORPCHandler(db)
  },
  {
    id: 'personal-dashboards',
    auth: 'protected',
    kind: 'orpc',
    dependencies: ['db'],
    prefix: API_PREFIXES.application,
    surfaces: [API_PREFIXES.application],
    create: ({ db }) => createPersonalDashboardORPCHandler(db)
  },
  {
    id: 'project-dashboards',
    auth: 'protected',
    kind: 'orpc',
    dependencies: ['db'],
    prefix: API_PREFIXES.application,
    surfaces: [API_PREFIXES.application],
    create: ({ db }) => createProjectDashboardORPCHandler(db)
  },
  {
    id: 'workspace-collections',
    auth: 'protected',
    kind: 'orpc',
    dependencies: ['db'],
    prefix: API_PREFIXES.application,
    surfaces: [API_PREFIXES.application],
    create: ({ db }) => createWorkspaceCollectionORPCHandler(db)
  },
  {
    id: 'workspace-config',
    auth: 'protected',
    kind: 'orpc',
    dependencies: ['db'],
    prefix: API_PREFIXES.application,
    surfaces: [API_PREFIXES.application],
    create: ({ db }) => createWorkspaceConfigORPCHandler(db)
  },
  {
    id: 'public-catalog-config',
    auth: 'protected',
    kind: 'orpc',
    dependencies: ['db'],
    prefix: API_PREFIXES.application,
    surfaces: [API_PREFIXES.application],
    create: ({ db }) => createPublicCatalogConfigORPCHandler(db)
  },
  {
    id: 'workspace-analytics',
    auth: 'protected',
    kind: 'orpc',
    dependencies: ['db'],
    prefix: API_PREFIXES.application,
    surfaces: [API_PREFIXES.application],
    create: ({ db }) => createWorkspaceAnalyticsORPCHandler(db)
  },
  {
    id: 'workspace-metrics',
    auth: 'protected',
    kind: 'orpc',
    dependencies: ['db'],
    prefix: API_PREFIXES.application,
    surfaces: [API_PREFIXES.application],
    create: ({ db }) => createWorkspaceMetricORPCHandler(db)
  },
  {
    id: 'jobs',
    auth: 'protected',
    kind: 'orpc',
    dependencies: ['db'],
    prefix: API_PREFIXES.application,
    surfaces: [API_PREFIXES.application],
    create: ({ db }) => createJobsORPCHandler(db)
  },
  {
    id: 'external-content',
    auth: 'protected',
    kind: 'orpc',
    dependencies: ['db', 'storage'],
    prefix: API_PREFIXES.application,
    surfaces: [API_PREFIXES.application],
    create: ({ db, storage }) => createExternalContentORPCHandler(db, storage)
  },
  {
    id: 'webhooks',
    auth: 'protected',
    kind: 'orpc',
    dependencies: ['db'],
    prefix: API_PREFIXES.application,
    surfaces: [API_PREFIXES.application],
    create: ({ db }) => createWebhookORPCHandler(db)
  },
  {
    id: 'automation-rules',
    auth: 'protected',
    kind: 'orpc',
    dependencies: ['db'],
    prefix: API_PREFIXES.application,
    surfaces: [API_PREFIXES.application],
    create: ({ db }) => createAutomationRuleORPCHandler(db)
  },
  {
    id: 'documents',
    auth: 'protected',
    kind: 'orpc',
    dependencies: ['db'],
    prefix: API_PREFIXES.application,
    surfaces: [API_PREFIXES.application],
    create: ({ db }) => createDocumentORPCHandler(db)
  },
  {
    id: 'file-transfer',
    auth: 'protected',
    kind: 'explicit',
    dependencies: ['db', 'storage'],
    prefix: API_PREFIXES.application,
    surfaces: [API_PREFIXES.application],
    register: (app, { db, storage }) => {
      app.use(createProjectFileRoutesHandler(db, storage));
    }
  },
  {
    id: 'projects',
    auth: 'protected',
    kind: 'orpc',
    dependencies: ['db', 'storage'],
    prefix: API_PREFIXES.application,
    surfaces: [API_PREFIXES.application],
    create: ({ db, storage }) => createProjectORPCHandler(db, storage)
  },
  {
    id: 'assessments',
    auth: 'protected',
    kind: 'orpc',
    dependencies: ['db'],
    prefix: API_PREFIXES.application,
    surfaces: [API_PREFIXES.application],
    create: ({ db }) => createAssessmentORPCHandler(db)
  },
  {
    id: 'assessment-responses',
    auth: 'protected',
    kind: 'orpc',
    dependencies: ['db'],
    prefix: API_PREFIXES.application,
    surfaces: [API_PREFIXES.application],
    create: ({ db }) => createAssessmentResponseORPCHandler(db)
  },
  {
    id: 'milestones',
    auth: 'protected',
    kind: 'orpc',
    dependencies: ['db'],
    prefix: API_PREFIXES.application,
    surfaces: [API_PREFIXES.application],
    create: ({ db }) => createMilestoneORPCHandler(db)
  },
  {
    id: 'change-cases',
    auth: 'protected',
    kind: 'orpc',
    dependencies: ['db'],
    prefix: API_PREFIXES.application,
    surfaces: [API_PREFIXES.application],
    create: ({ db }) => createChangeCaseORPCHandler(db)
  },
  {
    id: 'audit',
    auth: 'protected',
    kind: 'orpc',
    dependencies: ['db'],
    prefix: API_PREFIXES.application,
    surfaces: [API_PREFIXES.application],
    create: ({ db }) => createAuditORPCHandler(db)
  },
  {
    id: 'watch',
    auth: 'protected',
    kind: 'orpc',
    dependencies: ['db'],
    prefix: API_PREFIXES.application,
    surfaces: [API_PREFIXES.application],
    create: ({ db }) => createWatchORPCHandler(db)
  },
  {
    id: 'notification-preferences',
    auth: 'protected',
    kind: 'orpc',
    dependencies: ['db'],
    prefix: API_PREFIXES.application,
    surfaces: [API_PREFIXES.application],
    create: ({ db }) => createNotificationPreferencesORPCHandler(db)
  },
  {
    id: 'discussions',
    auth: 'protected',
    kind: 'orpc',
    dependencies: ['db'],
    prefix: API_PREFIXES.application,
    surfaces: [API_PREFIXES.application],
    create: ({ db }) => createDiscussionORPCHandler(db)
  },
  {
    id: 'governance',
    auth: 'protected',
    kind: 'orpc',
    dependencies: ['db', 'governanceRegistry'],
    prefix: API_PREFIXES.application,
    surfaces: [API_PREFIXES.application],
    create: ({ db, governanceRegistry }) => createGovernanceORPCHandler(db, governanceRegistry)
  },
  {
    id: 'governance-workflow-config',
    auth: 'protected',
    kind: 'orpc',
    dependencies: ['db', 'governanceRegistry'],
    prefix: API_PREFIXES.application,
    surfaces: [API_PREFIXES.application],
    create: ({ db, governanceRegistry }) =>
      createGovernanceWorkflowConfigORPCHandler(db, governanceRegistry)
  },
  {
    id: 'wiki-comments',
    auth: 'protected',
    kind: 'orpc',
    dependencies: ['db'],
    prefix: API_PREFIXES.application,
    surfaces: [API_PREFIXES.application],
    create: ({ db }) => createWikiCommentORPCHandler(db)
  },
  {
    id: 'search',
    auth: 'protected',
    kind: 'orpc',
    dependencies: ['db'],
    prefix: API_PREFIXES.application,
    surfaces: [API_PREFIXES.application],
    create: ({ db }) => createSearchORPCHandler(db)
  },
  {
    id: 'ai',
    auth: 'protected',
    kind: 'explicit',
    dependencies: ['db', 'routeOverrides'],
    prefix: API_PREFIXES.application,
    surfaces: [API_PREFIXES.application],
    register: (app, { db, routeOverrides }) => {
      app.use(createAiORPCHandler(db, routeOverrides?.aiChat));
    }
  },
  {
    id: 'diagram-craft',
    auth: 'protected',
    kind: 'explicit',
    dependencies: ['db'],
    prefix: API_PREFIXES.root,
    surfaces: [API_PREFIXES.diagramCraft],
    register: (app, { db }) => {
      app.use(createDiagramCraftORPCHandler(db));
    }
  }
] satisfies readonly RouteDefinition[];

const withPrecedence = (
  definitions: readonly RouteDefinition[],
  start: number
): RouteDescriptor[] =>
  definitions.map((definition, index) => ({
    ...definition,
    precedence: start + index
  }));

export const routeDescriptors = [
  ...withPrecedence(publicRouteDefinitions, 0),
  ...withPrecedence(protectedRouteDefinitions, 1000)
] satisfies readonly RouteDescriptor[];

export const validateRouteDescriptors = (descriptors: readonly RouteDescriptor[]) => {
  const ids = new Set<string>();
  const precedence = new Set<string>();

  for (const descriptor of descriptors) {
    if (ids.has(descriptor.id)) {
      throw new Error(`Duplicate route descriptor id: ${descriptor.id}`);
    }
    ids.add(descriptor.id);

    const precedenceKey = `${descriptor.auth}:${descriptor.precedence}`;
    if (precedence.has(precedenceKey)) {
      throw new Error(
        `Duplicate route descriptor precedence for ${descriptor.auth}: ${descriptor.precedence}`
      );
    }
    precedence.add(precedenceKey);
  }
};

export const sortRouteDescriptors = (descriptors: readonly RouteDescriptor[], auth: RouteAuth) =>
  descriptors
    .filter(descriptor => descriptor.auth === auth)
    .toSorted((left, right) => left.precedence - right.precedence);

export const createRouteRegistry = (
  dependencies: RouteRegistryDependencies,
  descriptors: readonly RouteDescriptor[] = routeDescriptors
) => {
  validateRouteDescriptors(descriptors);

  const resolvedDependencies: RouteRegistrationDependencies = {
    ...dependencies,
    governanceRegistry: dependencies.governanceRegistry ?? createApplicationGovernanceRegistry()
  };
  const mounted = new Set<string>();
  const disposers: Array<() => void> = [];

  const mount = (app: H3, auth: RouteAuth) => {
    for (const descriptor of sortRouteDescriptors(descriptors, auth)) {
      if (mounted.has(descriptor.id)) {
        throw new Error(`Route descriptor already mounted: ${descriptor.id}`);
      }

      if (descriptor.kind === 'orpc') {
        app.use(descriptor.create(resolvedDependencies));
      } else {
        const dispose = descriptor.register(app, resolvedDependencies);
        if (dispose) disposers.push(dispose);
      }

      mounted.add(descriptor.id);
    }
  };

  const assertComplete = () => {
    const missing = descriptors
      .filter(descriptor => !mounted.has(descriptor.id))
      .map(descriptor => descriptor.id);
    if (missing.length > 0) {
      throw new Error(`Route descriptors were not mounted: ${missing.join(', ')}`);
    }
  };

  const dispose = () => {
    for (const disposer of disposers.splice(0).reverse()) disposer();
  };

  return { mount, assertComplete, dispose };
};

validateRouteDescriptors(routeDescriptors);
