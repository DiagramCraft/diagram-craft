import { createApp, defineEventHandler, handleCors } from 'h3';
import { createAIRoutes } from './aiRoutes';
import { createDataRoutes } from './dataRoutes';
import { FileSystemDataStore } from './dataStore';
import { createFilesystemRoutes } from './filesystemRoutes';
import type { ServerMainConfig } from './config';
import openapiSpec from './openapi.json';

export const createServerApp = (config: ServerMainConfig) => {
  const dataStore = new FileSystemDataStore(config.dataDir);

  if (config.bootstrapData && config.bootstrapSchemas) {
    dataStore.bootstrapFromFiles(config.bootstrapData, config.bootstrapSchemas);
  } else if (config.bootstrapData || config.bootstrapSchemas) {
    console.warn('Both --bootstrap-data and --bootstrap-schemas must be provided for bootstrapping');
  }

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

  app.use(createDataRoutes(dataStore));
  app.use(createFilesystemRoutes(config.fsRoot));

  if (config.openrouterApiKey) {
    app.use(
      createAIRoutes({
        apiKey: config.openrouterApiKey,
        defaultModel: config.openrouterModel,
        siteUrl: config.openrouterSiteUrl,
        appName: config.openrouterAppName
      })
    );
    console.log(
      'AI routes enabled with model:',
      config.openrouterModel ?? 'anthropic/claude-3.5-sonnet'
    );
  } else {
    console.log('AI routes disabled: No OpenRouter API key configured');
    console.log('Set OPENROUTER_API_KEY environment variable or use --openrouter-api-key flag');
  }

  return app;
};
