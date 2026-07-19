import { readFile } from 'node:fs/promises';
import { defineHandler, getMethod, getRequestPath, H3, handleCors } from 'h3';
import type { DatabaseAdapter } from './db/database';
import type { StorageAdapter } from './storage/storage';
import { createLogger } from './utils/logger';
import { createUnifiedOpenAPISpecHandler } from './openapi';
import { createOidcCallbackRoute } from './domain/auth/oidcCallbackRoute';
import { requireAuth } from './middleware/auth';
import { createDevDelayMiddleware } from './middleware/devDelay';
import { createSecurityHeadersMiddleware } from './middleware/securityHeaders';
import { createWorkspaceEnumORPCHandler } from './domain/catalog/enumOrpc';
import { createWorkspaceSchemaORPCHandler } from './domain/catalog/schemaOrpc';
import { createWorkspaceEntityORPCHandler } from './domain/catalog/entityOrpc';
import { createEntityChangeORPCHandler } from './domain/catalog/entityChangeOrpc';
import { createWorkspaceTemplateORPCHandler } from './domain/catalog/templateOrpc';
import { createWorkspaceViewORPCHandler } from './domain/catalog/viewOrpc';
import { createWorkspaceCollectionORPCHandler } from './domain/catalog/collectionOrpc';
import { createWorkspaceManagementORPCHandler } from './domain/workspace/workspaceOrpc';
import { createWorkspaceConfigORPCHandler } from './domain/workspace/workspaceConfigOrpc';
import { createProjectORPCHandler } from './domain/project/projectOrpc';
import { createProjectFileRoutesHandler } from './domain/project/projectFileRoutes';
import { createAssessmentORPCHandler } from './domain/project/assessmentOrpc';
import { createAssessmentResponseORPCHandler } from './domain/project/assessmentResponseOrpc';
import { createMilestoneORPCHandler } from './domain/project/projectMilestoneOrpc';
import { createAuditORPCHandler } from './domain/audit/auditOrpc';
import { createWatchORPCHandler } from './domain/watch/watchOrpc';
import { createNotificationPreferencesORPCHandler } from './domain/notification/notificationPreferenceOrpc';
import { createDiscussionORPCHandler } from './domain/discussion/discussionOrpc';
import { createGovernanceORPCHandler } from './domain/governance/governanceOrpc';
import { createWikiCommentORPCHandler } from './domain/wikiComments/wikiCommentOrpc';
import { createSearchORPCHandler } from './domain/search/searchOrpc';
import {
  createPublicAuthORPCHandler,
  createProtectedAuthORPCHandler
} from './domain/auth/authOrpc';
import { createDevORPCHandler } from './domain/dev/devOrpc';
import { createAiORPCHandler } from './domain/ai/aiOrpc';
import { createDiagramCraftORPCHandler } from './domain/diagram/diagramCraftOrpc';
import { createWorkspaceAnalyticsORPCHandler } from './domain/analytics/workspaceAnalyticsOrpc';
import { createWorkspaceMetricORPCHandler } from './domain/metrics/metricOrpc';
import { createJobsORPCHandler } from './domain/jobs/jobsOrpc';
import { createExternalContentORPCHandler } from './domain/external-content/externalContentOrpc';
import { createWebhookORPCHandler } from './domain/webhook/webhookOrpc';
import { createDocumentORPCHandler } from './domain/document/documentOrpc';
import { createEntityGovernanceRegistry } from './domain/catalog/entityChangeOperations';
import { createEntityDeprecationORPCHandler } from './domain/catalog/entityDeprecationOrpc';
import { createDeprecationGovernanceRegistry } from './domain/catalog/entityDeprecationOperations';
import { getHttpErrorLogLevel } from './utils/errorLogging';

const openApiSpecUrl = new URL('../openapi.yaml', import.meta.url);

const httpLogger = createLogger('http');

type AppOptions = {
  routeOverrides?: {
    aiChat?: Parameters<typeof createAiORPCHandler>[1];
  };
};

export const createApp = (
  db: DatabaseAdapter,
  storage: StorageAdapter,
  options: AppOptions = {}
) => {
  const app = new H3({
    onError: (error, event) => {
      const method = getMethod(event);
      const path = getRequestPath(event);
      switch (getHttpErrorLogLevel(error)) {
        case 'error': {
          const cause = error.cause instanceof Error ? error.cause : error;
          httpLogger.error(`${error.status} ${method} ${path}: ${error.message}`, cause);
          break;
        }
        case 'debug':
          httpLogger.debug(`${error.status} ${method} ${path}: ${error.message}`);
          break;
        case 'info':
          httpLogger.info(`404 ${method} ${path}`);
          break;
        case 'warn':
          httpLogger.warn(`${error.status} ${method} ${path}: ${error.message}`);
          break;
      }
    }
  });

  app.use(createSecurityHeadersMiddleware());

  const corsOriginEnv = process.env['CORS_ORIGIN'] ?? '*';
  const corsOrigin: '*' | string[] =
    corsOriginEnv === '*' ? '*' : corsOriginEnv.split(',').map(s => s.trim());

  app.use(
    defineHandler(event => {
      const didHandleCors = handleCors(event, {
        origin: corsOrigin,
        preflight: { statusCode: 204 },
        methods: '*',
        credentials: corsOriginEnv !== '*'
      });
      if (didHandleCors) {
        return;
      }
    })
  );

  app.use(
    '/openapi.yaml',
    defineHandler(async () => {
      const body = await readFile(openApiSpecUrl, 'utf8');
      return new Response(body, {
        headers: {
          'content-type': 'application/yaml; charset=utf-8'
        }
      });
    })
  );

  app.use('/openapi.json', createUnifiedOpenAPISpecHandler());

  app.use(createDevDelayMiddleware());

  // Public routes (no auth required)
  app.use(createPublicAuthORPCHandler(db));
  // Always mounted: dev.config must be reachable to report enabled/disabled, and
  // dev.listUsers/dev.switchUser re-check isDevUserSwitcherEnabled() on every call.
  app.use(createDevORPCHandler(db));
  const oidcCallbackRoute = createOidcCallbackRoute(db);
  app.use(oidcCallbackRoute.app);

  app.use(requireAuth(db.auth));

  // Protected routes (auth required)
  app.use(createProtectedAuthORPCHandler(db));
  // workspaceManagement must come before workspace-prefixed handlers to avoid
  // GET /workspaces/templates being matched as GET /{workspace}/templates
  app.use(createWorkspaceManagementORPCHandler(db, storage));
  app.use(createWorkspaceEnumORPCHandler(db));
  app.use(createWorkspaceSchemaORPCHandler(db));
  app.use(createWorkspaceEntityORPCHandler(db));
  app.use(createEntityChangeORPCHandler(db));
  app.use(createEntityDeprecationORPCHandler(db));
  app.use(createWorkspaceTemplateORPCHandler(db));
  app.use(createWorkspaceViewORPCHandler(db));
  app.use(createWorkspaceCollectionORPCHandler(db));
  app.use(createWorkspaceConfigORPCHandler(db));
  app.use(createWorkspaceAnalyticsORPCHandler(db));
  app.use(createWorkspaceMetricORPCHandler(db));
  app.use(createJobsORPCHandler(db));
  app.use(createExternalContentORPCHandler(db, storage));
  app.use(createWebhookORPCHandler(db));
  app.use(createDocumentORPCHandler(db));
  app.use(createProjectFileRoutesHandler(db, storage));
  app.use(createProjectORPCHandler(db, storage));
  app.use(createAssessmentORPCHandler(db));
  app.use(createAssessmentResponseORPCHandler(db));
  app.use(createMilestoneORPCHandler(db));
  app.use(createAuditORPCHandler(db));
  app.use(createWatchORPCHandler(db));
  app.use(createNotificationPreferencesORPCHandler(db));
  app.use(createDiscussionORPCHandler(db));
  app.use(
    createGovernanceORPCHandler(
      db,
      new Map([...createEntityGovernanceRegistry(), ...createDeprecationGovernanceRegistry()])
    )
  );
  app.use(createWikiCommentORPCHandler(db));
  app.use(createSearchORPCHandler(db));
  app.use(createAiORPCHandler(db, options.routeOverrides?.aiChat));
  app.use(createDiagramCraftORPCHandler(db));

  return {
    app,
    dispose: oidcCallbackRoute.dispose
  };
};
