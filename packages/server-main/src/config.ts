export type ServerMainConfig = {
  host: string;
  port: number;
  dataDir: string;
  fsRoot: string;
  collaboration: boolean;
  bootstrapData?: string;
  bootstrapSchemas?: string;
  openrouterApiKey?: string;
  openrouterModel?: string;
  openrouterSiteUrl?: string;
  openrouterAppName?: string;
};

const parseNumberOption = (value: string | undefined, flag: string) => {
  if (value === undefined) {
    throw new Error(`Missing value for ${flag}`);
  }

  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed < 0) {
    throw new Error(`Invalid numeric value for ${flag}: ${value}`);
  }

  return parsed;
};

export const getHelpText = () => `
Usage: node main.js [OPTIONS]

Options:
  --host <host>                  Host to bind the server to (default: HOST env or localhost)
  --port <port>                  Port to bind the server to (default: PORT env or 3000)
  --data-dir <path>              Directory to store data files (default: ./data)
  --fs-root <path>               Root directory for filesystem API (default: ../main/public)
  --collaboration                Enable the Yjs collaboration websocket server
  --bootstrap-data <path>        JSON file to bootstrap initial data from
  --bootstrap-schemas <path>     JSON file to bootstrap initial schemas from
  --openrouter-api-key <key>     OpenRouter API key (can also use OPENROUTER_API_KEY env var)
  --openrouter-model <model>     Default model to use (default: anthropic/claude-3.5-sonnet)
  --openrouter-site-url <url>    Site URL for OpenRouter analytics
  --openrouter-app-name <name>   App name for OpenRouter analytics
  --help                         Show this help message

Example:
  node main.js --host 127.0.0.1 --port 3000 --data-dir ./storage --fs-root ./public --bootstrap-data ./init-data.json --bootstrap-schemas ./init-schemas.json --openrouter-api-key sk-or-v1-xxx
`;

export const parseArgs = (
  args: string[],
  env: NodeJS.ProcessEnv = process.env
): ServerMainConfig | 'help' => {
  const config: Partial<ServerMainConfig> = {};
  let collaboration = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case '--host':
        config.host = args[++i];
        break;
      case '--port':
        config.port = parseNumberOption(args[++i], '--port');
        break;
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
      case '--collaboration':
        collaboration = true;
        break;
      case '--help':
        return 'help';
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return {
    host: config.host ?? env.HOST ?? 'localhost',
    port: config.port ?? parseNumberOption(env.PORT ?? '3000', 'PORT'),
    dataDir: config.dataDir ?? './data',
    fsRoot: config.fsRoot ?? '../main/public',
    collaboration,
    bootstrapData: config.bootstrapData,
    bootstrapSchemas: config.bootstrapSchemas,
    openrouterApiKey: config.openrouterApiKey ?? env.OPENROUTER_API_KEY ?? env.OPENAI_API_KEY,
    openrouterModel: config.openrouterModel ?? env.OPENROUTER_DEFAULT_MODEL,
    openrouterSiteUrl: config.openrouterSiteUrl ?? env.OPENROUTER_SITE_URL,
    openrouterAppName: config.openrouterAppName ?? env.OPENROUTER_APP_NAME
  };
};
