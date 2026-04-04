import { createApp, defineEventHandler, handleCors } from 'h3';
import { createAIRoutes } from './aiRoutes';
import { createDataRoutes } from './dataRoutes';
import { createFilesystemRoutes } from './filesystemRoutes';
import type { ServerModules } from './serverFactory';
import openapiSpec from './openapi.json';

export const createServerApp = (servers: ServerModules) => {
  const app = createApp();
  app.use(
    defineEventHandler(event => {
      const didHandleCors = handleCors(event, {
        origin: '*',
        preflight: {
          statusCode: 204
        },
        methods: '*'
      });
      if (didHandleCors) {
        return;
      }
    })
  );

  app.use(
    '/api/openapi.json',
    defineEventHandler(() => {
      return openapiSpec;
    })
  );

  app.use(createDataRoutes(servers.modelServer));
  app.use(createFilesystemRoutes(servers.fileSystemServer));

  if (servers.aiServer) {
    app.use(createAIRoutes(servers.aiServer));
    console.log(
      'AI routes enabled with model:',
      servers.aiDefaultModel ?? 'anthropic/claude-3.5-sonnet'
    );
  } else {
    console.log('AI routes disabled: No OpenRouter API key configured');
    console.log('Set OPENROUTER_API_KEY environment variable or use --openrouter-api-key flag');
  }

  return app;
};
