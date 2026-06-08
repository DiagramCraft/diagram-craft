import { readFile } from 'node:fs/promises';
import { H3, defineHandler, handleCors, getRequestPath, getMethod } from 'h3';
import type { DatabaseAdapter } from './db/database';
import type { StorageAdapter } from './storage/storage';
import { createLogger } from './utils/logger';
import { createDataRoutes } from './domain/catalog/dataRoutes';
import { createProjectRoutes } from './domain/project/projectRoutes';
import { createSearchRoutes } from './domain/search/searchRoutes';
import { createSchemaRoutes } from './domain/catalog/schemaRoutes';
import { createEnumRoutes } from './domain/catalog/enumRoutes';
import { createWorkspaceRoutes } from './domain/workspace/workspaceRoutes';
import { createAuditRoutes } from './domain/audit/auditRoutes';
import { createWorkspaceConfigRoutes } from './domain/workspace/workspaceConfigRoutes';
import { createAiChatRoutes } from './domain/ai/aiRoutes';
import { createViewRoutes } from './domain/catalog/viewRoutes';
import { createDiagramCraftRoutes } from './domain/diagram/diagramCraftRoutes';
import { createAuthRoutes, createAuthProtectedRoutes } from './domain/auth/authRoutes';
import { createTemplateRoutes } from './domain/catalog/templateRoutes';
import { requireAuth } from './middleware/auth';

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

  // Auth routes (public, no middleware)
  app.use(createAuthRoutes(db));

  // Apply authentication middleware to all routes below
  const authMiddleware = requireAuth(db.auth);
  app.use(authMiddleware);

  // Protected routes (require authentication)
  app.use(createAuthProtectedRoutes(db));
  app.use(createWorkspaceRoutes(db, storage));
  app.use(createSchemaRoutes(db));
  app.use(createEnumRoutes(db));
  app.use(createDataRoutes(db));
  app.use(createViewRoutes(db));
  app.use(createDiagramCraftRoutes(db));
  app.use(createSearchRoutes(db));
  app.use(createTemplateRoutes(db));
  app.use(createProjectRoutes(db, storage));
  app.use(createAuditRoutes(db));
  app.use(createWorkspaceConfigRoutes(db));
  app.use(createAiChatRoutes(db, options.routeOverrides?.aiChat));

  return app;
};
