import { createApp, defineEventHandler, handleCors } from 'h3';
import { FileSystemDataStore } from './dataStore';
import { createDataRoutes } from './dataRoutes';
import { createFilesystemRoutes } from './filesystemRoutes';
import { createAIRoutes } from './aiRoutes';
import openapiSpec from './openapi.json';

// Parse CLI arguments
const parseArgs = () => {
  const args = process.argv.slice(2);
  const config: {
    dataDir?: string;
    fsRoot?: string;
    bootstrapData?: string;
    bootstrapSchemas?: string;
    openrouterApiKey?: string;
    openrouterModel?: string;
    openrouterSiteUrl?: string;
    openrouterAppName?: string;
  } = {};

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--data-dir':
        config.dataDir = args[++i];
        break;
      case '--fs-root':
        config.fsRoot = args[++i];
        break;
      case '--bootstrap-data':
        config.bootstrapData = args[++i];
        break;
      case '--bootstrap-schemas':
        config.bootstrapSchemas = args[++i];
        break;
      case '--openrouter-api-key':
        config.openrouterApiKey = args[++i];
        break;
      case '--openrouter-model':
        config.openrouterModel = args[++i];
        break;
      case '--openrouter-site-url':
        config.openrouterSiteUrl = args[++i];
        break;
      case '--openrouter-app-name':
        config.openrouterAppName = args[++i];
        break;
      case '--help':
        console.log(`
Usage: node main.js [OPTIONS]

Options:
  --data-dir <path>              Directory to store data files (default: ./data)
  --fs-root <path>               Root directory for filesystem API (default: ../main/public)
  --bootstrap-data <path>        JSON file to bootstrap initial data from
  --bootstrap-schemas <path>     JSON file to bootstrap initial schemas from
  --openrouter-api-key <key>     OpenRouter API key (can also use OPENROUTER_API_KEY env var)
  --openrouter-model <model>     Default model to use (default: anthropic/claude-3.5-sonnet)
  --openrouter-site-url <url>    Site URL for OpenRouter analytics
  --openrouter-app-name <name>   App name for OpenRouter analytics
  --help                         Show this help message

Example:
  node main.js --data-dir ./storage --fs-root ./public --bootstrap-data ./init-data.json --bootstrap-schemas ./init-schemas.json --openrouter-api-key sk-or-v1-xxx
        `);
        process.exit(0);
        break;
    }
  }

  return config;
};

// Initialize data store and filesystem root
const config = parseArgs();
const dataDir = config.dataDir ?? './data';
const fsRoot = config.fsRoot ?? '../main/public';
const dataStore = new FileSystemDataStore(dataDir);

// Bootstrap data if files are provided
if (config.bootstrapData && config.bootstrapSchemas) {
  try {
    dataStore.bootstrapFromFiles(config.bootstrapData, config.bootstrapSchemas);
    console.log('Successfully bootstrapped data and schemas');
  } catch (error) {
    console.error('Failed to bootstrap data:', error);
    process.exit(1);
  }
} else if (config.bootstrapData || config.bootstrapSchemas) {
  console.warn('Both --bootstrap-data and --bootstrap-schemas must be provided for bootstrapping');
}

export const app = createApp();
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

// Add OpenAPI spec route
app.use(
  '/api/openapi.json',
  defineEventHandler(() => {
    return openapiSpec;
  })
);

// Add data API routes
app.use(createDataRoutes(dataStore));

// Add filesystem API routes
app.use(createFilesystemRoutes(fsRoot));

// Add AI routes if OpenRouter API key is configured
const openrouterApiKey =
  config.openrouterApiKey ?? process.env.OPENROUTER_API_KEY ?? process.env.OPENAI_API_KEY;
const openrouterModel = config.openrouterModel ?? process.env.OPENROUTER_DEFAULT_MODEL;
const openrouterSiteUrl = config.openrouterSiteUrl ?? process.env.OPENROUTER_SITE_URL;
const openrouterAppName = config.openrouterAppName ?? process.env.OPENROUTER_APP_NAME;

if (openrouterApiKey) {
  app.use(
    createAIRoutes({
      apiKey: openrouterApiKey,
      defaultModel: openrouterModel,
      siteUrl: openrouterSiteUrl,
      appName: openrouterAppName
    })
  );
  console.log('AI routes enabled with model:', openrouterModel ?? 'anthropic/claude-3.5-sonnet');
} else {
  console.log('AI routes disabled: No OpenRouter API key configured');
  console.log('Set OPENROUTER_API_KEY environment variable or use --openrouter-api-key flag');
}
