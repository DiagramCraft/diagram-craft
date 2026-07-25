export interface SchemaMapping {
  domain?: string;
  system?: string;
  component?: string;
  api?: string;
  resource?: string;
}

export interface Config {
  githubToken?: string;
  githubOrg: string;
  archRegisterUrl: string;
  archRegisterWorkspace: string;
  archRegisterToken: string;
  schemaMapping: SchemaMapping;
  dryRun: boolean;
  verbose: boolean;
}

export const readConfig = (args: string[]): Config => {
  // Parse command line arguments
  const parsedArgs = parseArgs(args);

  // Required: GitHub organization
  const githubOrg = parsedArgs.org;
  if (!githubOrg) {
    throw new Error('Missing required argument: --org <github-organization>');
  }

  // Required: Arch Register configuration
  const archRegisterUrl = process.env.ARCH_REGISTER_URL;
  const archRegisterWorkspace = process.env.ARCH_REGISTER_WORKSPACE;
  const archRegisterToken = process.env.ARCH_REGISTER_TOKEN;

  if (!archRegisterUrl) {
    throw new Error('Missing required environment variable: ARCH_REGISTER_URL');
  }
  if (!archRegisterWorkspace) {
    throw new Error('Missing required environment variable: ARCH_REGISTER_WORKSPACE');
  }
  if (!archRegisterToken) {
    throw new Error('Missing required environment variable: ARCH_REGISTER_TOKEN');
  }

  // Optional: GitHub token
  const githubToken = process.env.GITHUB_TOKEN;

  // Optional: Schema mapping (can be auto-discovered if not provided)
  const schemaMapping: SchemaMapping = {
    domain: process.env.SCHEMA_DOMAIN,
    system: process.env.SCHEMA_SYSTEM,
    component: process.env.SCHEMA_COMPONENT,
    api: process.env.SCHEMA_API,
    resource: process.env.SCHEMA_RESOURCE
  };

  // Optional: Dry run mode
  const dryRun = parsedArgs.dryRun || process.env.DRY_RUN === 'true';

  // Optional: Verbose output
  const verbose = parsedArgs.verbose || false;

  return {
    githubToken,
    githubOrg,
    archRegisterUrl,
    archRegisterWorkspace,
    archRegisterToken,
    schemaMapping,
    dryRun,
    verbose
  };
};

interface ParsedArgs {
  org?: string;
  dryRun: boolean;
  verbose: boolean;
}

const parseArgs = (args: string[]): ParsedArgs => {
  const result: ParsedArgs = {
    dryRun: false,
    verbose: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--org' && i + 1 < args.length) {
      result.org = args[i + 1];
      i++;
    } else if (arg === '--dry-run') {
      result.dryRun = true;
    } else if (arg === '--verbose' || arg === '-v') {
      result.verbose = true;
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }
  }

  return result;
};

const printHelp = (): void => {
  console.log(`
Backstage Catalog Sync - Import Backstage catalog-info.yaml files into Arch Register

Usage:
  pnpm start -- --org <github-organization> [options]

Required Arguments:
  --org <org>          GitHub organization to scan for catalog-info.yaml files

Options:
  --dry-run            Preview changes without syncing to Arch Register
  --verbose, -v        Enable verbose output
  --help, -h           Show this help message

Environment Variables:
  ARCH_REGISTER_URL              Arch Register server URL (required)
  ARCH_REGISTER_WORKSPACE        Workspace slug (required)
  ARCH_REGISTER_TOKEN            API token with ent.external_update permission (required)
  GITHUB_TOKEN                   GitHub personal access token (optional, for private repos)
  SCHEMA_DOMAIN                  Domain schema UUID (optional, auto-discovered if not set)
  SCHEMA_SYSTEM                  System schema UUID (optional, auto-discovered if not set)
  SCHEMA_COMPONENT               Component schema UUID (optional, auto-discovered if not set)
  SCHEMA_API                     API schema UUID (optional, auto-discovered if not set)
  SCHEMA_RESOURCE                Resource schema UUID (optional, auto-discovered if not set)
  DRY_RUN                        Set to 'true' for dry run mode (optional)

Examples:
  # Basic usage
  pnpm start -- --org DiagramCraft

  # Dry run with verbose output
  pnpm start -- --org DiagramCraft --dry-run --verbose

  # With GitHub token for private repos
  GITHUB_TOKEN=ghp_xxx pnpm start -- --org DiagramCraft
`);
};
