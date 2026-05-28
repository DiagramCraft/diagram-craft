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

const openApiSpecUrl = new URL('../openapi.yaml', import.meta.url);

export const createApp = (db: DatabaseAdapter, storage: StorageAdapter) => {
  const app = new H3();

  app.use(
    defineHandler(event => {
      const didHandleCors = handleCors(event, {
        origin: '*',
        preflight: { statusCode: 204 },
        methods: '*'
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
