import { readFile } from 'node:fs/promises';
import { defineHandler, getMethod, getRequestPath, H3, handleCors } from 'h3';
import type { DatabaseAdapter } from './db/database';
import type { StorageAdapter } from './storage/storage';
import { createLogger } from './utils/logger';
import {
  createApplicationOpenAPISpecHandler,
  createDiagramCraftAdapterOpenAPISpecHandler,
  createIntegrationOpenAPISpecHandler,
  createPublicCatalogOpenAPISpecHandler,
  createUnifiedOpenAPISpecHandler
} from './openapi';
import { requireAuth } from './middleware/auth';
import { createDevDelayMiddleware } from './middleware/devDelay';
import { createSecurityHeadersMiddleware } from './middleware/securityHeaders';
import { getHttpErrorLogLevel } from './utils/errorLogging';
import { createRouteRegistry, type RouteOverrides } from './routeRegistry';

const openApiSpecUrl = new URL('../openapi.yaml', import.meta.url);

const httpLogger = createLogger('http');

type AppOptions = {
  routeOverrides?: RouteOverrides;
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
  app.use('/openapi/application-v1.json', createApplicationOpenAPISpecHandler());
  app.use('/openapi/public-v1.json', createPublicCatalogOpenAPISpecHandler());
  app.use('/api/public/v1/openapi.json', createPublicCatalogOpenAPISpecHandler());
  app.use('/openapi/integrations-v1.json', createIntegrationOpenAPISpecHandler());
  app.use('/openapi/adapters/diagram-craft.json', createDiagramCraftAdapterOpenAPISpecHandler());

  app.use(createDevDelayMiddleware());

  const routeRegistry = createRouteRegistry({
    db,
    storage,
    routeOverrides: options.routeOverrides
  });

  routeRegistry.mount(app, 'public');

  app.use(requireAuth(db.auth));

  routeRegistry.mount(app, 'protected');
  routeRegistry.assertComplete();

  return {
    app,
    dispose: routeRegistry.dispose
  };
};
