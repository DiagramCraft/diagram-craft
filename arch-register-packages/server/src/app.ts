import { readFile } from 'node:fs/promises';
import { H3, defineHandler, handleCors, getRequestPath, getMethod } from 'h3';
import type { DatabaseAdapter } from './db/database.js';
import type { StorageAdapter } from './storage/storage.js';
import { createLogger } from './utils/logger.js';
import { createDataRoutes } from './routes/data.js';
import { createProjectRoutes } from './routes/projects.js';
import { createSearchRoutes } from './routes/search.js';
import { createSchemaRoutes } from './routes/schemas.js';
import { createEnumRoutes } from './routes/enums.js';
import { createWorkspaceRoutes } from './routes/workspaces.js';
import { createAuditRoutes } from './routes/audit.js';
import { createWorkspaceConfigRoutes } from './routes/workspace-config.js';
import { createAiChatRoutes } from './routes/ai-chat.js';
import { createDiagramCraftRoutes } from './routes/diagram-craft.js';
import { createAuthRoutes, createAuthProtectedRoutes } from './routes/auth.js';
import { createTemplateRoutes } from './routes/templates.js';
import { requireAuth } from './middleware/auth.js';

const openApiSpecUrl = new URL('../openapi.yaml', import.meta.url);

const httpLogger = createLogger('http');

type AppOptions = {
  routeOverrides?: {
    aiChat?: Parameters<typeof createAiChatRoutes>[1];
  };
};

export const createApp = (db: DatabaseAdapter, storage: StorageAdapter, options: AppOptions = {}) => {
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
  const authMiddleware = requireAuth(db.identityAuth);
  app.use(authMiddleware);

  // Protected routes (require authentication)
  app.use(createAuthProtectedRoutes(db));
  app.use(createWorkspaceRoutes(db, storage));
  app.use(createSchemaRoutes(db));
  app.use(createEnumRoutes(db));
  app.use(createDataRoutes(db));
  app.use(createDiagramCraftRoutes(db));
  app.use(createSearchRoutes(db));
  app.use(createTemplateRoutes(db));
  app.use(createProjectRoutes(db, storage));
  app.use(createAuditRoutes(db));
  app.use(createWorkspaceConfigRoutes(db));
  app.use(createAiChatRoutes(db, options.routeOverrides?.aiChat));

  return app;
};
