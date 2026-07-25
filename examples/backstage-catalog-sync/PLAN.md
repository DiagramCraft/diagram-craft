# Backstage Catalog Sync Importer - Implementation Plan

## Overview

This example demonstrates a CLI tool that syncs Backstage `catalog-info.yaml` files from GitHub repositories into Arch Register using the idempotent entity sync API (`/integrations/v1/{workspace}/entities/byExternalKey/{source}/{externalKey}`).

## External Identity Scheme

### Source Identifier
- **Source**: `backstage-github-{org}` (e.g., `backstage-github-DiagramCraft`)
- This identifies the integration source and GitHub organization

### External Key Format
- **Format**: `{namespace}/{kind}/{name}` (e.g., `default/component/artist-web`)
- **Rationale**: 
  - Backstage UIDs are NOT stable (can change on re-registration)
  - The combination of namespace/kind/name is the stable identifier in Backstage
  - This matches Backstage's entity reference format
  - Defaults to `default` namespace if not specified

### Examples
```
Source: backstage-github-DiagramCraft
External Keys:
  - default/component/artist-web
  - default/api/artist-api
  - production/resource/artists-db
  - default/system/artist-engagement-portal
```

## Field Mapping Strategy

### Supported Backstage Entity Kinds

#### 1. Component → Arch Register Component Schema
**Backstage Fields** → **Arch Register Fields**
- `metadata.name` → `_name`
- `metadata.namespace` → `_namespace` (default: "default")
- `metadata.description` → `_description`
- `metadata.tags` → `_tags`
- `metadata.links` → `_links`
- `spec.owner` → `_owner` (resolve to team entity reference)
- `spec.lifecycle` → `_lifecycle` (map to lifecycle state)
- `spec.type` → field `kind` (enum: service, library, website, documentation)
- `spec.system` → containment field `system` (reference to System entity)
- `metadata.annotations['backstage.io/techdocs-ref']` → field `technology` (text)
- `spec.providesApis` → reference field `provides_apis` (array of API references)
- `spec.consumesApis` → reference field `consumes_apis` (array of API references)

#### 2. API → Arch Register API Schema
**Backstage Fields** → **Arch Register Fields**
- `metadata.name` → `_name`
- `metadata.namespace` → `_namespace`
- `metadata.description` → `_description`
- `metadata.tags` → `_tags`
- `metadata.links` → `_links`
- `spec.owner` → `_owner`
- `spec.lifecycle` → `_lifecycle`
- `spec.type` → field `api_type` (enum: openapi, grpc, graphql, asyncapi)
- `spec.system` → containment field `system` (reference to System entity)
- `spec.definition` → store as link or external reference (not in template by default)

#### 3. Resource → Arch Register Resource Schema
**Backstage Fields** → **Arch Register Fields**
- `metadata.name` → `_name`
- `metadata.namespace` → `_namespace`
- `metadata.description` → `_description`
- `metadata.tags` → `_tags`
- `metadata.links` → `_links`
- `spec.owner` → `_owner`
- `spec.type` → field `kind` (enum: database, cache, queue, blob-storage)
- `spec.system` → containment field `system` (optional reference to System entity)

#### 4. System → Arch Register System Schema
**Backstage Fields** → **Arch Register Fields**
- `metadata.name` → `_name`
- `metadata.namespace` → `_namespace`
- `metadata.description` → `_description`
- `metadata.tags` → `_tags`
- `metadata.links` → `_links`
- `spec.owner` → `_owner`
- `spec.domain` → reference field to Domain entity (if supported)

### Schema Configuration

**Important**: Arch Register already has a built-in "Backstage" workspace template with pre-configured schemas. When creating a workspace with the Backstage template, the following schemas are automatically created:

- **Domain** (symId: `domain`) - High-level grouping
- **System** (symId: `system`) - Collection of resources and APIs
- **Component** (symId: `component`) - Deployable unit of code
- **API** (symId: `api`) - Machine-readable interface definition
- **Resource** (symId: `resource`) - Infrastructure dependencies

The tool will need to discover these schema IDs at runtime by querying the workspace schemas and matching by name or by a conventional naming pattern. Alternatively, schema IDs can be provided via configuration:

```typescript
interface SchemaMapping {
  component: string;  // Schema ID for Component entities (or auto-discover by name)
  api: string;        // Schema ID for API entities
  resource: string;   // Schema ID for Resource entities
  system: string;     // Schema ID for System entities
  domain: string;     // Schema ID for Domain entities
}
```

### Unsupported Kinds

The following Backstage kinds will be logged but skipped in the initial implementation:
- `Group` (organizational entities)
- `User` (individual people)
- `Domain` (collection of systems)
- `Template` (scaffolding templates)
- `Location` (catalog data source markers)

These can be added in future iterations if needed.

## Architecture

### Project Structure

```
examples/backstage-catalog-sync/
├── src/
│   ├── main.ts              # CLI entry point
│   ├── config.ts            # Configuration loading and validation
│   ├── github.ts            # GitHub API client
│   ├── backstage.ts         # Backstage YAML parser and validator
│   ├── mapper.ts            # Backstage → Arch Register mapper
│   ├── archRegister.ts      # Arch Register integration API client
│   ├── sync.ts              # Main sync orchestration logic
│   ├── github.test.ts       # GitHub client tests
│   ├── backstage.test.ts    # Parser tests
│   ├── mapper.test.ts       # Mapper tests
│   ├── archRegister.test.ts # API client tests
│   └── sync.test.ts         # Integration tests
├── fixtures/                # Test fixtures
│   ├── valid-component.yaml
│   ├── valid-api.yaml
│   ├── invalid-yaml.yaml
│   └── unsupported-kind.yaml
├── .env.example
├── package.json
├── tsconfig.json
└── README.md
```

### Module Responsibilities

#### 1. `config.ts`
- Load environment variables
- Validate required configuration
- Provide typed configuration object

```typescript
interface Config {
  githubToken?: string;
  githubOrg: string;
  archRegisterUrl: string;
  archRegisterWorkspace: string;
  archRegisterToken: string;
  schemaMapping: SchemaMapping;
  dryRun: boolean;
}
```

#### 2. `github.ts`
- List all repositories in an organization
- Fetch `catalog-info.yaml` from default branch
- Handle rate limiting and errors
- Support both public and private repos (with token)

```typescript
interface GitHubRepo {
  name: string;
  fullName: string;
  defaultBranch: string;
  url: string;
}

async function listRepos(org: string, token?: string): Promise<GitHubRepo[]>
async function fetchCatalogInfo(repo: GitHubRepo, token?: string): Promise<string | null>
```

#### 3. `backstage.ts`
- Parse YAML content
- Validate against Backstage schema
- Extract entity metadata and spec
- Handle malformed YAML gracefully

```typescript
interface BackstageEntity {
  apiVersion: string;
  kind: string;
  metadata: {
    name: string;
    namespace?: string;
    description?: string;
    tags?: string[];
    links?: Array<{ url: string; title: string; type?: string }>;
    annotations?: Record<string, string>;
  };
  spec: Record<string, unknown>;
}

function parseBackstageYaml(content: string): BackstageEntity[]
function validateEntity(entity: BackstageEntity): ValidationResult
```

#### 4. `mapper.ts`
- Map Backstage entities to Arch Register format
- Handle field type conversions
- Resolve entity references
- Generate external keys

```typescript
interface ArchRegisterEntity {
  _schemaId: string;
  _name: string;
  _namespace?: string;
  _description?: string;
  _tags?: string[];
  _links?: Array<{ url: string; title: string; type?: string }>;
  _owner?: string;
  _lifecycle?: string;
  [key: string]: unknown; // Custom fields
}

function mapBackstageToArchRegister(
  entity: BackstageEntity,
  schemaMapping: SchemaMapping
): ArchRegisterEntity | null
```

#### 5. `archRegister.ts`
- Call integration sync API
- Handle authentication
- Parse sync responses (created/updated/unchanged)
- Handle API errors

```typescript
interface SyncResult {
  status: 'created' | 'updated' | 'unchanged';
  entity: {
    id: string;
    publicId: string;
    name: string;
  };
}

async function syncEntity(
  workspace: string,
  source: string,
  externalKey: string,
  entity: ArchRegisterEntity,
  token: string,
  baseUrl: string
): Promise<SyncResult>
```

#### 6. `sync.ts`
- Orchestrate the sync process
- Iterate through repos and entities
- Collect and report results
- Handle errors per entity

```typescript
interface SyncReport {
  totalRepos: number;
  totalEntities: number;
  created: number;
  updated: number;
  unchanged: number;
  skipped: number;
  failed: number;
  errors: Array<{ repo: string; entity?: string; error: string }>;
}

async function syncOrganization(
  org: string,
  config: Config
): Promise<SyncReport>
```

## Error Handling Strategy

### Error Categories

1. **GitHub API Errors**
   - Rate limiting → Wait and retry with exponential backoff
   - 404 (no catalog-info.yaml) → Skip repo, log info
   - Authentication errors → Fail fast with clear message
   - Network errors → Retry with backoff, fail after 3 attempts

2. **YAML Parsing Errors**
   - Invalid YAML syntax → Skip file, log error with details
   - Missing required fields → Skip entity, log validation error
   - Unsupported kind → Skip entity, log info

3. **Mapping Errors**
   - Unknown schema ID → Fail fast (configuration error)
   - Invalid field values → Skip entity, log error
   - Missing required Arch Register fields → Skip entity, log error

4. **Arch Register API Errors**
   - Authentication errors → Fail fast
   - 400 (validation error) → Skip entity, log error with details
   - 404 (schema not found) → Fail fast (configuration error)
   - 5xx errors → Retry with backoff, fail after 3 attempts

### Error Reporting

Each sync run produces a detailed report:
```
Sync Report for organization: DiagramCraft
=====================================
Repositories scanned: 45
Entities found: 123
  - Created: 15
  - Updated: 8
  - Unchanged: 95
  - Skipped: 3 (unsupported kinds)
  - Failed: 2

Errors:
  - repo: diagram-craft, entity: default/component/invalid-name
    error: Invalid entity name format
  - repo: arch-register, entity: default/api/broken-spec
    error: Missing required field: spec.type
```

## CLI Interface

### Command Structure

```bash
# Basic usage
pnpm start -- --org DiagramCraft

# With GitHub token for private repos
pnpm start -- --org DiagramCraft --github-token ghp_xxx

# Dry run (no actual sync)
pnpm start -- --org DiagramCraft --dry-run

# Verbose output
pnpm start -- --org DiagramCraft --verbose
```

### Environment Variables

```bash
# Required
ARCH_REGISTER_URL=http://127.0.0.1:3000
ARCH_REGISTER_WORKSPACE=default
ARCH_REGISTER_TOKEN=ar_pat_xxx

# Schema mappings (required)
SCHEMA_COMPONENT=uuid-for-component-schema
SCHEMA_API=uuid-for-api-schema
SCHEMA_RESOURCE=uuid-for-resource-schema
SCHEMA_SYSTEM=uuid-for-system-schema

# Optional
GITHUB_TOKEN=ghp_xxx
DRY_RUN=false
```

## Testing Strategy

### Unit Tests

1. **GitHub Client Tests** (`github.test.ts`)
   - Mock GitHub API responses
   - Test repo listing
   - Test catalog-info.yaml fetching
   - Test error handling

2. **Parser Tests** (`backstage.test.ts`)
   - Valid YAML parsing
   - Invalid YAML handling
   - Multi-document YAML support
   - Validation logic

3. **Mapper Tests** (`mapper.test.ts`)
   - Field mapping for each kind
   - External key generation
   - Reference resolution
   - Edge cases (missing optional fields)

4. **API Client Tests** (`archRegister.test.ts`)
   - Mock Arch Register API
   - Test sync endpoint calls
   - Test authentication
   - Test error handling

### Integration Tests

1. **End-to-End Sync** (`sync.test.ts`)
   - Use fixtures for GitHub responses
   - Mock Arch Register API
   - Test full sync flow
   - Verify report generation

### Test Fixtures

Create realistic Backstage YAML files:
- `valid-component.yaml` - Complete Component entity
- `valid-api.yaml` - Complete API entity
- `invalid-yaml.yaml` - Malformed YAML
- `unsupported-kind.yaml` - Valid but unsupported kind
- `missing-required.yaml` - Missing required fields

## Implementation Phases

### Phase 1: Core Infrastructure
1. Set up project structure
2. Implement configuration loading
3. Implement GitHub API client
4. Write tests for GitHub client

### Phase 2: Parsing and Validation
1. Implement Backstage YAML parser
2. Implement validation logic
3. Write tests for parser
4. Create test fixtures

### Phase 3: Mapping Logic
1. Implement entity mapper
2. Implement external key generation
3. Write tests for mapper
4. Handle edge cases

### Phase 4: Integration API
1. Implement Arch Register API client
2. Implement sync logic
3. Write tests for API client
4. Test error handling

### Phase 5: Orchestration
1. Implement main sync orchestration
2. Implement CLI interface
3. Implement reporting
4. Write integration tests

### Phase 6: Documentation
1. Write comprehensive README
2. Document mapping strategy
3. Create usage examples
4. Document error scenarios

## Success Criteria

- [ ] CLI accepts GitHub organization parameter
- [ ] Tool discovers all repos in organization
- [ ] Tool fetches catalog-info.yaml from each repo
- [ ] Tool parses and validates Backstage entities
- [ ] Tool maps Component, API, Resource, System kinds
- [ ] Tool uses integration sync API with external identifiers
- [ ] Tool handles create/update/unchanged results
- [ ] Tool reports per-entity errors without failing entire sync
- [ ] Tool handles malformed YAML gracefully
- [ ] Tool skips unsupported kinds with clear logging
- [ ] Tool supports dry-run mode
- [ ] Comprehensive test coverage (unit + integration)
- [ ] Clear documentation with examples
- [ ] Repeatable runs produce consistent results

## Future Enhancements

1. **Additional Entity Kinds**
   - Support Group, User, Domain entities
   - Map to appropriate Arch Register schemas

2. **Relationship Mapping**
   - Map Backstage relations (dependsOn, providesApi, etc.)
   - Create Arch Register entity references

3. **Incremental Sync**
   - Track last sync timestamp
   - Only process changed files
   - Use GitHub webhooks for real-time sync

4. **Advanced Filtering**
   - Filter by repository patterns
   - Filter by entity tags
   - Filter by namespace

5. **Batch Processing**
   - Parallel repository processing
   - Batch API calls for better performance

6. **Monitoring**
   - Prometheus metrics
   - Sync duration tracking
   - Error rate monitoring
