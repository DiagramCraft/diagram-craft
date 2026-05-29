import { readFile } from 'node:fs/promises';
import { H3, defineHandler, handleCors } from 'h3';
import type { DatabaseAdapter } from './db/database.js';
import type { StorageAdapter } from './storage/storage.js';
import { createDataRoutes } from './routes/data.js';
import { createProjectRoutes } from './routes/projects.js';
import { createSearchRoutes } from './routes/search.js';
import { createSchemaRoutes } from './routes/schemas.js';
import { createWorkspaceRoutes } from './routes/workspaces.js';
import { createAuditRoutes } from './routes/audit.js';
import { createWorkspaceConfigRoutes } from './routes/workspace-config.js';
import { createPublicRoutes } from './routes/public.js';
import { createAuthRoutes, createAuthProtectedRoutes } from './routes/auth.js';
import { requireAuth } from './middleware/auth.js';

const openApiSpecUrl = new URL('../openapi.yaml', import.meta.url);

export const createApp = (db: DatabaseAdapter, storage: StorageAdapter) => {
  const app = new H3();

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
  const authMiddleware = requireAuth(db);
  app.use(authMiddleware);

  // Protected routes (require authentication)
  app.use(createAuthProtectedRoutes(db));
  app.use(createWorkspaceRoutes(db, storage));
  app.use(createSchemaRoutes(db));
  app.use(createDataRoutes(db));
  app.use(createPublicRoutes(db));
  app.use(createSearchRoutes(db));
  app.use(createProjectRoutes(db, storage));
  app.use(createAuditRoutes(db));
  app.use(createWorkspaceConfigRoutes(db));

  return app;
};
