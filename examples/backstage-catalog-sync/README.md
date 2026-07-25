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

Backstage relationship references are reported as warnings and are not written yet. Backstage references such as `system:default/my-system` are namespaced catalog references, while Arch Register relationship fields require entity IDs. Relationship synchronization is tracked in [the follow-up issue](https://github.com/DiagramCraft/diagram-craft/issues/2426).

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

The schema UUIDs are discovered by name by default. Set `SCHEMA_DOMAIN`, `SCHEMA_SYSTEM`, `SCHEMA_COMPONENT`, `SCHEMA_API`, or `SCHEMA_RESOURCE` when explicit mappings are preferred.

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

The tests cover YAML parsing, validation, external-key generation, supported-kind handling, and scalar field mapping.
