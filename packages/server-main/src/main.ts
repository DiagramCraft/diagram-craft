import { createApp, defineEventHandler, handleCors } from 'h3';
import { FileSystemDataStore } from './dataStore';
import { createDataRoutes } from './dataRoutes';
import { createFilesystemRoutes } from './filesystemRoutes';

// Parse CLI arguments
const parseArgs = () => {
  const args = process.argv.slice(2);
  const config: {
    dataDir?: string;
    fsRoot?: string;
    bootstrapData?: string;
    bootstrapSchemas?: string;
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
      case '--help':
        console.log(`
Usage: node main.js [OPTIONS]

Options:
  --data-dir <path>           Directory to store data files (default: ./data)
  --fs-root <path>            Root directory for filesystem API (default: ../main/public)
  --bootstrap-data <path>     JSON file to bootstrap initial data from
  --bootstrap-schemas <path>  JSON file to bootstrap initial schemas from
  --help                      Show this help message

Example:
  node main.js --data-dir ./storage --fs-root ./public --bootstrap-data ./init-data.json --bootstrap-schemas ./init-schemas.json
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

// Add data API routes
app.use(createDataRoutes(dataStore));

// Add filesystem API routes
app.use(createFilesystemRoutes(fsRoot));
