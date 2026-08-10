# Backstage Catalog Sync

This example imports supported Backstage entities from the root `catalog-info.yaml` file in every repository in a GitHub organization and upserts them into an Arch Register workspace.

It demonstrates:

- GitHub organization and repository API access
- YAML parsing and basic Backstage entity validation
- Backstage-to-Arch Register field mapping
- schema auto-discovery
- idempotent sync using external identities
- dry-run, verbose logging, retries, and per-entity error reporting

## Scope and limitations

Supported kinds are `Component`, `API`, `Resource`, `System`, and `Domain`.

The importer currently reads only `catalog-info.yaml` from the repository root. It does not resolve Backstage `Group`, `User`, `Location`, or `Template` entities.

The importer synchronizes `system` and `domain` as entity fields, and `providesApis` / `consumesApis` as first-class `Provides API` / `Consumes API` typed relations. Components and Systems are the relation source (`in`) endpoint and APIs are the target (`out`) endpoint; API entities expose the inverse provider and consumer views. It scans all supported entities first, materializes scalar data, then resolves references to Arch Register IDs in a second pass. References may use Backstage's `kind:namespace/name`, `namespace/name`, or `name` forms; the field supplies defaults for omitted kind and namespace.

Missing, malformed, unsupported, or otherwise unresolved targets are omitted from the written relationship or typed-relation sync and reported as relationship warnings. Relationship warnings do not fail the source entity; API and entity/relation update failures still count as entity failures. Typed relation identities are stable across repeat runs, so synchronization is idempotent.

Owner references are also passed through as Backstage strings; Arch Register resolves them only when they match an existing team ID.

## Prerequisites

1. Create an Arch Register workspace using the **Backstage** template.
2. Create an API token with:
   - `ws.view` to discover schemas
   - `content.view` to read existing entities during repeat runs
   - `ent.edit` to create entities
   - `ent.external_update` to sync through the integration endpoint
3. Set up a GitHub token when scanning private repositories or when higher rate limits are needed.

## Setup

From the repository root:

```bash
pnpm install
cp examples/backstage-catalog-sync/.env.example examples/backstage-catalog-sync/.env
```

Fill in the Arch Register values in `.env`:

```dotenv
ARCH_REGISTER_URL=http://127.0.0.1:3010
ARCH_REGISTER_WORKSPACE=backstage
ARCH_REGISTER_TOKEN=ar_pat_...
```

The entity and typed relation schema UUIDs are discovered by name by default. Set `SCHEMA_DOMAIN`, `SCHEMA_SYSTEM`, `SCHEMA_COMPONENT`, `SCHEMA_API`, or `SCHEMA_RESOURCE` when explicit entity mappings are preferred; `RELATION_SCHEMA_PROVIDES_API` and `RELATION_SCHEMA_CONSUMES_API` can explicitly configure the typed relation mappings.

## Usage

Run from this directory or use the workspace command from the repository root:

```bash
pnpm start -- --org backstage
pnpm start -- --org backstage --dry-run
pnpm start -- --org backstage --verbose
```

Use `GITHUB_TOKEN` in `.env` for private repositories. `DRY_RUN=true` is also supported.

## External identity

Each entity uses:

- Source: `backstage-github-{organization}`
- Key: `{namespace}/{kind}/{name}`

For example, a default-namespace component named `artist-web` uses `default/component/artist-web`. This makes repeated runs update the same Arch Register entity instead of creating duplicates.

Each typed API relation uses the source entity key, relation kind, and target API key, for example `default/component/artist-web/typed-relations/provides-api/default/api/artist-api`.

## Field mapping

Common fields map as follows:

| Backstage | Arch Register |
| --- | --- |
| `metadata.name` / `metadata.title` | `_name` |
| `metadata.namespace` | `_namespace` |
| `metadata.description` | `_description` |
| `metadata.tags` | `_tags` |
| `metadata.links` | `_links` |
| `spec.owner` | `_owner` |
| `spec.lifecycle` | `_lifecycle` |

Kind-specific scalar fields are mapped as follows:

| Kind | Backstage | Arch Register |
| --- | --- | --- |
| Component | `spec.type` | `kind` |
| Component | `backstage.io/techdocs-ref` | `technology` |
| API | `spec.type` | `api_type` |
| Resource | `spec.type` | `kind` |

## Development

```bash
pnpm typecheck
pnpm test
```

The tests cover YAML parsing, reference parsing, validation, external-key generation, supported-kind handling, scalar/relationship mapping, and typed-relation request behavior. Synchronization runs in two passes so repository order does not affect relationship resolution.
