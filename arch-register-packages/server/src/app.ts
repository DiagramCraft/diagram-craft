import { readFile } from 'node:fs/promises';
import { H3, defineHandler, handleCors, getRequestPath, getMethod } from 'h3';
import type { DatabaseAdapter } from './db/database';
import type { StorageAdapter } from './storage/storage';
import { createLogger } from './utils/logger';
import { createUnifiedOpenAPISpecHandler } from './openapi';
import { createProjectRoutes } from './domain/project/projectRoutes';
import { createAiChatRoutes } from './domain/ai/aiRoutes';
import { createDiagramCraftRoutes } from './domain/diagram/diagramCraftRoutes';
import { createAuthRoutes, createAuthProtectedRoutes } from './domain/auth/authRoutes';
import { createTemplateRoutes } from './domain/catalog/templateRoutes';
import { requireAuth } from './middleware/auth';
import {
  createWorkspaceEnumOpenAPISpecHandler,
  createWorkspaceEnumORPCHandler
} from './domain/catalog/enumOrpc';
import {
  createWorkspaceSchemaOpenAPISpecHandler,
  createWorkspaceSchemaORPCHandler
} from './domain/catalog/schemaOrpc';
import {
  createWorkspaceEntityOpenAPISpecHandler,
  createWorkspaceEntityORPCHandler
} from './domain/catalog/entityOrpc';
import {
  createWorkspaceTemplateOpenAPISpecHandler,
  createWorkspaceTemplateORPCHandler
} from './domain/catalog/templateOrpc';
import {
  createWorkspaceViewOpenAPISpecHandler,
  createWorkspaceViewORPCHandler
} from './domain/catalog/viewOrpc';
import {
  createWorkspaceManagementOpenAPISpecHandler,
  createWorkspaceManagementORPCHandler
} from './domain/workspace/workspaceOrpc';
import {
  createWorkspaceConfigOpenAPISpecHandler,
  createWorkspaceConfigORPCHandler
} from './domain/workspace/workspaceConfigOrpc';
import {
  createProjectOpenAPISpecHandler,
  createProjectORPCHandler
} from './domain/project/projectOrpc';
import {
  createAuditOpenAPISpecHandler,
  createAuditORPCHandler
} from './domain/audit/auditOrpc';
import {
  createWatchOpenAPISpecHandler,
  createWatchORPCHandler
} from './domain/watch/watchOrpc';
import {
  createSearchOpenAPISpecHandler,
  createSearchORPCHandler
} from './domain/search/searchOrpc';

const openApiSpecUrl = new URL('../openapi.yaml', import.meta.url);

const httpLogger = createLogger('http');

type AppOptions = {
  routeOverrides?: {
    aiChat?: Parameters<typeof createAiChatRoutes>[1];
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
      if (error.status >= 500) {
        const cause = error.cause instanceof Error ? error.cause : error;
        httpLogger.error(`${error.status} ${method} ${path}: ${error.message}`, cause);
      } else if (error.status === 404) {
        httpLogger.info(`404 ${method} ${path}`);
      } else {
        httpLogger.warn(`${error.status} ${method} ${path}: ${error.message}`);
      }
    }
  });

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
      if (didHandleCors) return;
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
  app.use('/openapi-orpc-enums.json', createWorkspaceEnumOpenAPISpecHandler());
  app.use('/openapi-orpc-schemas.json', createWorkspaceSchemaOpenAPISpecHandler());
  app.use('/openapi-orpc-entities.json', createWorkspaceEntityOpenAPISpecHandler());
  app.use('/openapi-orpc-templates.json', createWorkspaceTemplateOpenAPISpecHandler());
  app.use('/openapi-orpc-views.json', createWorkspaceViewOpenAPISpecHandler());
  app.use('/openapi-orpc-workspaces.json', createWorkspaceManagementOpenAPISpecHandler());
  app.use('/openapi-orpc-workspace-config.json', createWorkspaceConfigOpenAPISpecHandler());
  app.use('/openapi-orpc-projects.json', createProjectOpenAPISpecHandler());
  app.use('/openapi-orpc-audit.json', createAuditOpenAPISpecHandler());
  app.use('/openapi-orpc-watch.json', createWatchOpenAPISpecHandler());
  app.use('/openapi-orpc-search.json', createSearchOpenAPISpecHandler());

  app.use(createAuthRoutes(db));

  const authMiddleware = requireAuth(db.auth);
  app.use(authMiddleware);

  app.use(createAuthProtectedRoutes(db));
  app.use(createWorkspaceEnumORPCHandler(db));
  app.use(createWorkspaceSchemaORPCHandler(db));
  app.use(createWorkspaceEntityORPCHandler(db));
  app.use(createWorkspaceTemplateORPCHandler(db));
  app.use(createWorkspaceViewORPCHandler(db));
  app.use(createWorkspaceManagementORPCHandler(db, storage));
  app.use(createWorkspaceConfigORPCHandler(db));
  app.use(createProjectORPCHandler(db, storage));
  app.use(createAuditORPCHandler(db));
  app.use(createWatchORPCHandler(db));
  app.use(createSearchORPCHandler(db));
  app.use(createDiagramCraftRoutes(db));
  app.use(createTemplateRoutes(db));
  app.use(createProjectRoutes(db, storage));
  app.use(createAiChatRoutes(db, options.routeOverrides?.aiChat));

  return app;
};
