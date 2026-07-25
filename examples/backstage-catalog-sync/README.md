# Backstage Catalog Sync

A CLI tool that syncs Backstage `catalog-info.yaml` files from GitHub repositories into Arch Register using the idempotent entity sync API.

## Overview

This tool scans all repositories in a GitHub organization, finds `catalog-info.yaml` files, parses Backstage entities, and syncs them to Arch Register. It uses external identifiers to ensure repeated runs update existing entities instead of creating duplicates.

## Features

- ✅ Scans entire GitHub organizations for catalog-info.yaml files
- ✅ Supports Component, API, Resource, System, and Domain entity kinds
- ✅ Idempotent sync using external identifiers (no duplicates)
- ✅ Auto-discovers Arch Register schemas by name
- ✅ Handles rate limiting and transient errors with retry logic
- ✅ Comprehensive error reporting per entity
- ✅ Dry-run mode for previewing changes
- ✅ Verbose output for debugging

## Prerequisites

1. **Arch Register Workspace**: Create a workspace using the "Backstage" template, which includes pre-configured schemas for Domain, System, Component, API, and Resource.

2. **API Token**: Generate an Arch Register API token with the following permissions:
   - `content.view` - Read entities through the public API
   - `ws.view` - Read workspace schemas for schema auto-discovery
   - `ent.external_update` - Write to entities using external identity

3. **GitHub Access** (optional): For private repositories or higher rate limits, create a GitHub personal access token with `repo` scope.

## Installation

```bash
cd examples/backstage-catalog-sync
pnpm install
```

## Configuration

Copy the example environment file and configure it:

```bash
cp .env.example .env
```

### Required Environment Variables

```bash
# Arch Register Configuration
ARCH_REGISTER_URL=http://127.0.0.1:3000
ARCH_REGISTER_WORKSPACE=default
ARCH_REGISTER_TOKEN=ar_pat_...
```

### Optional Environment Variables

```bash
# GitHub Configuration (for private repos or higher rate limits)
GITHUB_TOKEN=ghp_...

# Schema Mapping (auto-discovered if not provided)
SCHEMA_DOMAIN=uuid-for-domain-schema
SCHEMA_SYSTEM=uuid-for-system-schema
SCHEMA_COMPONENT=uuid-for-component-schema
SCHEMA_API=uuid-for-api-schema
SCHEMA_RESOURCE=uuid-for-resource-schema

# Sync Configuration
DRY_RUN=false
```

## Usage

### Basic Usage

Sync all catalog-info.yaml files from a GitHub organization:

```bash
pnpm start -- --org DiagramCraft
```

### Dry Run

Preview changes without syncing to Arch Register:

```bash
pnpm start -- --org DiagramCraft --dry-run
```

### Verbose Output

Enable detailed logging for debugging:

```bash
pnpm start -- --org DiagramCraft --verbose
```

### With GitHub Token

For private repositories or to avoid rate limiting:

```bash
GITHUB_TOKEN=ghp_xxx pnpm start -- --org DiagramCraft
```

### Help

Display usage information:

```bash
pnpm start -- --help
```

## External Identity Scheme

The tool uses a deterministic external identity to ensure idempotent syncs:

- **Source**: `backstage-github-{org}` (e.g., `backstage-github-DiagramCraft`)
- **External Key**: `{namespace}/{kind}/{name}` (e.g., `default/component/artist-web`)

This scheme is based on Backstage's stable entity references (namespace/kind/name) rather than UIDs, which can change when entities are re-registered.

## Field Mapping

### Component → Arch Register Component

| Backstage Field | Arch Register Field | Notes |
|----------------|-------------------|-------|
| `metadata.name` | `_name` | Entity name |
| `metadata.namespace` | `_namespace` | Defaults to "default" |
| `metadata.description` | `_description` | Entity description |
| `metadata.tags` | `_tags` | Array of tags |
| `metadata.links` | `_links` | External links |
| `spec.owner` | `_owner` | Owner team reference |
| `spec.lifecycle` | `_lifecycle` | Lifecycle state |
| `spec.type` | `kind` | Enum: service, library, website, documentation |
| `spec.system` | `system` | Containment reference to System |
| `spec.providesApis` | `provides_apis` | Array of API references |
| `spec.consumesApis` | `consumes_apis` | Array of API references |
| `metadata.annotations['backstage.io/techdocs-ref']` | `technology` | Technology reference |

### API → Arch Register API

| Backstage Field | Arch Register Field | Notes |
|----------------|-------------------|-------|
| `metadata.name` | `_name` | Entity name |
| `metadata.namespace` | `_namespace` | Defaults to "default" |
| `metadata.description` | `_description` | Entity description |
| `metadata.tags` | `_tags` | Array of tags |
| `metadata.links` | `_links` | External links |
| `spec.owner` | `_owner` | Owner team reference |
| `spec.lifecycle` | `_lifecycle` | Lifecycle state |
| `spec.type` | `api_type` | Enum: openapi, grpc, graphql, asyncapi |
| `spec.system` | `system` | Containment reference to System |

### Resource → Arch Register Resource

| Backstage Field | Arch Register Field | Notes |
|----------------|-------------------|-------|
| `metadata.name` | `_name` | Entity name |
| `metadata.namespace` | `_namespace` | Defaults to "default" |
| `metadata.description` | `_description` | Entity description |
| `metadata.tags` | `_tags` | Array of tags |
| `metadata.links` | `_links` | External links |
| `spec.owner` | `_owner` | Owner team reference |
| `spec.type` | `kind` | Enum: database, cache, queue, blob-storage |
| `spec.system` | `system` | Optional containment reference to System |

### System → Arch Register System

| Backstage Field | Arch Register Field | Notes |
|----------------|-------------------|-------|
| `metadata.name` | `_name` | Entity name |
| `metadata.namespace` | `_namespace` | Defaults to "default" |
| `metadata.description` | `_description` | Entity description |
| `metadata.tags` | `_tags` | Array of tags |
| `metadata.links` | `_links` | External links |
| `spec.owner` | `_owner` | Owner team reference |
| `spec.domain` | `domain` | Containment reference to Domain |

### Domain → Arch Register Domain

| Backstage Field | Arch Register Field | Notes |
|----------------|-------------------|-------|
| `metadata.name` | `_name` | Entity name |
| `metadata.namespace` | `_namespace` | Defaults to "default" |
| `metadata.description` | `_description` | Entity description |
| `metadata.tags` | `_tags` | Array of tags |
| `metadata.links` | `_links` | External links |
| `spec.owner` | `_owner` | Owner team reference |

## Supported Entity Kinds

- ✅ **Component** - Deployable units of code (services, libraries, websites)
- ✅ **API** - Machine-readable interface definitions
- ✅ **Resource** - Infrastructure dependencies (databases, caches, queues)
- ✅ **System** - Collections of components and resources
- ✅ **Domain** - High-level groupings of systems

### Unsupported Kinds

The following Backstage entity kinds are not currently supported but can be added in future iterations:

- ⊘ **Group** - Organizational entities (teams, business units)
- ⊘ **User** - Individual people
- ⊘ **Template** - Scaffolding templates
- ⊘ **Location** - Catalog data source markers

## Error Handling

The tool handles various error scenarios gracefully:

### GitHub API Errors

- **Rate Limiting**: Automatically waits and retries when rate limit is exceeded
- **404 (No catalog-info.yaml)**: Skips repository with info message
- **Authentication Errors**: Fails fast with clear message
- **Network Errors**: Retries with exponential backoff (max 3 attempts)

### YAML Parsing Errors

- **Invalid Syntax**: Skips file, logs error with details
- **Missing Required Fields**: Skips entity, logs validation error
- **Unsupported Kind**: Skips entity, logs info message

### Mapping Errors

- **Unknown Schema ID**: Fails fast (configuration error)
- **Invalid Field Values**: Skips entity, logs error
- **Missing Required Fields**: Skips entity, logs error

### Arch Register API Errors

- **Authentication Errors**: Fails fast with clear message
- **400 (Validation Error)**: Skips entity, logs error with details
- **404 (Schema Not Found)**: Fails fast (configuration error)
- **5xx Errors**: Retries with exponential backoff (max 3 attempts)

## Sync Report

After each sync run, a detailed report is displayed:

```
============================================================
📊 Sync Report
============================================================
Repositories scanned: 45
Entities found: 123
  ✓ Created: 15
  ✓ Updated: 8
  ✓ Unchanged: 95
  ⊘ Skipped: 3
  ✗ Failed: 2

❌ Errors:
  • repo: diagram-craft / Component:default/invalid-name
    Validation failed: Field metadata.name must match pattern
  • repo: arch-register / API:default/broken-spec
    Mapping failed: No schema mapping found for kind 'API'
============================================================
```

## Development

### Run Tests

```bash
pnpm test
```

### Type Check

```bash
pnpm typecheck
```

### Watch Mode

```bash
pnpm dev -- --org DiagramCraft
```

## Architecture

The tool is organized into modular components:

- **`config.ts`** - Configuration loading and validation
- **`github.ts`** - GitHub API client with retry logic
- **`backstage.ts`** - YAML parser and entity validator
- **`mapper.ts`** - Backstage → Arch Register field mapper
- **`archRegister.ts`** - Arch Register integration API client
- **`sync.ts`** - Main sync orchestration logic
- **`main.ts`** - CLI entry point

## Limitations

1. **Relationship Resolution**: Entity references (e.g., `spec.system`, `spec.providesApis`) are stored as strings. The tool does not currently resolve these to actual entity IDs in Arch Register.

2. **Schema Auto-Discovery**: Schemas are discovered by exact name match (case-insensitive). If your workspace uses different schema names, you must provide explicit schema IDs via environment variables.

3. **Single File Support**: Only `catalog-info.yaml` in the repository root is processed. Multi-file catalogs and nested locations are not supported.

4. **No Deletion**: The tool only creates and updates entities. It does not delete entities that no longer exist in Backstage.

## Future Enhancements

- Support for Group and User entity kinds
- Relationship resolution (convert entity references to Arch Register IDs)
- Incremental sync (only process changed files)
- Support for nested catalog locations
- Batch processing for better performance
- Webhook integration for real-time sync
- Deletion of entities removed from Backstage

## Troubleshooting

### "Organization not found or not accessible"

- Verify the organization name is correct
- For private organizations, ensure `GITHUB_TOKEN` is set with appropriate permissions

### "Authentication failed. Check your ARCH_REGISTER_TOKEN"

- Verify the token is valid and not expired
- Ensure the token has `content.view` and `ent.external_update` permissions
- Check that the workspace slug is correct

### "No schema mapping found for kind 'Component'"

- Ensure your workspace was created with the "Backstage" template
- Verify schemas exist by checking the Arch Register UI
- Provide explicit schema IDs via environment variables if auto-discovery fails

### "Validation failed: Field metadata.name must match pattern"

- Entity names must be 1-63 characters
- Only alphanumeric characters separated by `-`, `_`, or `.`
- Must start and end with alphanumeric character

## License

This example is part of the Diagram Craft project and follows the same license.
