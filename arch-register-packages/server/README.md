# @arch-register/server

REST API server for the Architecture Register. Stores entities (components, systems, servers, etc.) and their schemas in PostgreSQL or SQLite.

## Prerequisites

- Node.js 20+
- pnpm
- PostgreSQL 15+ running locally for PostgreSQL mode

## Database configuration

The server supports two runtime-selectable database drivers:

```bash
DB_DRIVER=postgres
DATABASE_URL=postgresql://arch_register:yourpassword@localhost:5432/arch_register
```

```bash
DB_DRIVER=sqlite
SQLITE_PATH=./data/arch-register.sqlite
```

If `DB_DRIVER` is omitted, the server defaults to `postgres`.

## Job server

Recurring schedules and durable job runs share this database through the standalone
`@arch-register/job-server` package. Start it separately from the API server:

```bash
pnpm --filter @arch-register/job-server start
```

Production and multi-worker job deployments require PostgreSQL. SQLite is available only
for explicitly enabled, single-worker local development with
`JOB_SERVER_ALLOW_SQLITE=true`; it must not be used as the production job-server backend.

The worker concurrency and lease settings are configured with
`JOB_SERVER_ID`, `JOB_SERVER_NAME`, `JOB_SERVER_MAX_CONCURRENCY`,
`JOB_SERVER_POLL_INTERVAL_MS`, `JOB_SERVER_LEASE_DURATION_MS`,
`JOB_SERVER_HEARTBEAT_INTERVAL_MS`, `JOB_SERVER_PING_INTERVAL_MS`,
`JOB_SERVER_JOB_TIMEOUT_MS`, and `JOB_SERVER_SHUTDOWN_TIMEOUT_MS`.

## Local PostgreSQL setup

### 1. Install PostgreSQL

**macOS (Homebrew):**
```bash
brew install postgresql@15
brew services start postgresql@15
```

**Ubuntu/Debian:**
```bash
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
```

### 2. Create the database and user

Connect to PostgreSQL as the superuser:

```bash
# macOS
psql postgres

# Linux
sudo -u postgres psql
```

Then run:

```sql
CREATE USER arch_register WITH PASSWORD 'yourpassword';
CREATE DATABASE arch_register OWNER arch_register;
GRANT ALL PRIVILEGES ON DATABASE arch_register TO arch_register;
GRANT USAGE, CREATE ON SCHEMA public TO arch_register;
ALTER SCHEMA public OWNER TO arch_register;
\q
```

### 3. Configure the connection string

Copy the example env file and fill in your credentials:

```bash
cp .env.example .env
```

Edit `.env`:

```
DB_DRIVER=postgres
DATABASE_URL=postgresql://arch_register:yourpassword@localhost:5432/arch_register
```

## Local SQLite setup

Create `.env` with:

```
DB_DRIVER=sqlite
SQLITE_PATH=./data/arch-register.sqlite
```

## Database contract tests

Cross-driver contract tests verify that the SQLite and PostgreSQL adapters behave identically (type
normalization, constraint/transaction semantics, error codes) for a given domain. They are separate from the
regular unit test suite (`pnpm test`) so they aren't run on every `vitest run`.

All domains with a dual-driver adapter are covered: `project`, `catalog` (including saved views), `workspace`,
`auth`, `ai`, `watch`, and `audit` (see issue #1957). Domains without their own DB adapter (`analytics`,
`collaboration`, `diagram`, `search`) call into the domains above and don't need separate suites.

Run with SQLite only (no setup required):

```bash
pnpm --filter @arch-register/server test:db-contract
```

To also exercise the PostgreSQL suite, point `DATABASE_URL` at a local scratch Postgres (see "Local PostgreSQL
setup" above) before running the same command — a random schema is created and dropped per run:

```bash
export DATABASE_URL=postgresql://arch_register:yourpassword@localhost:5432/arch_register
pnpm --filter @arch-register/server test:db-contract
```

## Installation

From the repo root or this directory:

```bash
pnpm install
```

## Bootstrap the database

This resets the selected database driver, recreates the schema, and loads seed data:

```bash
pnpm bootstrap
```

You should see:

```
Bootstrapping database...
Dropping existing tables...
Tables dropped.
Creating schema...
Schema created.
Seeding data...
Seed data loaded.
Bootstrap complete.
```

Re-running `pnpm bootstrap` at any time resets the database to the seed state.

## Start the server

```bash
pnpm dev      # watch mode — restarts on file changes
pnpm start    # single run
```

The server listens on `http://localhost:3010` by default. Set `PORT` in `.env` to use a different port.

## Maintenance

### Cleaning up orphaned files

File content (diagrams, markdown, uploaded files) is stored on disk separately from the database
row that references it. If a delete or move operation fails partway through, a file can be left on
disk with no corresponding `content_node` row. `cleanup:orphaned-files` finds and (optionally)
removes these orphans:

```bash
pnpm cleanup:orphaned-files                            # dry run — reports only, deletes nothing
pnpm cleanup:orphaned-files -- --max-age-days 14        # dry run with a custom age threshold
pnpm cleanup:orphaned-files -- --apply                  # actually delete orphaned files
```

By default, only files untouched for at least 30 days are considered — this leaves a safety margin
around in-flight operations. Run without `--apply` first to review what would be deleted before
committing to it.

This is not run automatically. To schedule it, add an external cron entry, e.g. nightly at 3am:

```cron
0 3 * * * cd /path/to/arch-register-packages/server && pnpm cleanup:orphaned-files -- --apply >> /var/log/arch-register-cleanup.log 2>&1
```

## OpenAPI

The OpenAPI 3.1 spec for this server lives at [openapi.yaml](./openapi.yaml) and is served by the running server at `GET /openapi.yaml`.

## API

### Workspaces

Workspaces define the top-level isolation boundary for schemas and data.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/workspaces` | List all workspaces |

**Example — list workspaces:**
```bash
curl http://localhost:3000/api/workspaces
```

### Schemas

Schemas define the available entity types and their fields.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/:workspace/schemas` | List all schemas |
| GET | `/api/:workspace/schemas/:id` | Get a schema by ID |
| POST | `/api/:workspace/schemas` | Create a schema |
| PUT | `/api/:workspace/schemas/:id` | Update a schema |
| DELETE | `/api/:workspace/schemas/:id` | Delete a schema (fails if data records exist) |

Response format matches `packages/main/public/data/dataset1/schemas.json`. `source` is always returned as `"external"` and is not stored in the database.

**Example — create a schema:**
```bash
curl -X POST http://localhost:3000/api/default/schemas \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "Database",
    "fields": [
      { "id": "name",        "name": "Name",        "type": "text",     "description": "Display name of the database" },
      { "id": "engine",      "name": "Engine",      "type": "text",     "description": "Database engine (postgres/mysql/etc)" },
      { "id": "version",     "name": "Version",     "type": "text",     "description": "Engine version" },
      { "id": "environment", "name": "Environment", "type": "text",     "description": "Environment (dev/staging/prod)" },
      { "id": "notes",       "name": "Notes",       "type": "longtext", "description": "Additional notes" }
    ]
  }'
```

### Data

Data records are instances of a schema type. The wire format is flat: `{ _uid, _workspace, _schemaId, ...fields }`.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/:workspace/data` | List all records |
| GET | `/api/:workspace/data?_schemaId=<uuid>` | List records of a specific schema type |
| GET | `/api/:workspace/data/:id` | Get a record by ID |
| POST | `/api/:workspace/data` | Create a record |
| PUT | `/api/:workspace/data/:id` | Update a record |
| DELETE | `/api/:workspace/data/:id` | Delete a record |

**Example — list all Component records:**
```bash
# Get the Component schema ID first
curl http://localhost:3000/api/default/schemas

# Then filter by that ID
curl "http://localhost:3000/api/default/data?_schemaId=00000000-0000-0000-0000-000000000001"
```

**Example — create a record:**
```bash
curl -X POST http://localhost:3000/api/default/data \
  -H 'Content-Type: application/json' \
  -d '{
    "_schemaId": "00000000-0000-0000-0000-000000000001",
    "name": "payment-service",
    "technology": "Java",
    "version": "1.0.0",
    "team": "Payments",
    "tier": "backend"
  }'
```

**Example response:**
```json
{
  "_uid": "a1b2c3d4-...",
  "_workspace": "default",
  "_schemaId": "00000000-0000-0000-0000-000000000001",
  "name": "payment-service",
  "technology": "Java",
  "version": "1.0.0",
  "team": "Payments",
  "tier": "backend"
}
```

## Database schema

```
workspace
  id         TEXT  (primary key)
  name       TEXT
  created_at TIMESTAMPTZ
  updated_at TIMESTAMPTZ

entity_schema
  id         UUID  (primary key)
  workspace  TEXT  (foreign key → workspace.id)
  name       TEXT  (unique within workspace)
  fields     JSON / JSONB (array of field descriptors)
  created_at TIMESTAMPTZ
  updated_at TIMESTAMPTZ

entity
  id         UUID  (primary key)
  workspace  TEXT  (foreign key → workspace.id)
  name       TEXT
  schema_id  UUID  (workspace-scoped foreign key → entity_schema)
  data       JSON / JSONB (dynamic fields, flattened in API responses)
  created_at TIMESTAMPTZ
  updated_at TIMESTAMPTZ
```

`updated_at` is maintained in application code so both drivers behave consistently.

## Search compatibility

Search keeps the same endpoints and response shapes across PostgreSQL and SQLite. Free-text matching is intentionally portable, so match quality should be equivalent, but ordering and ranking are not guaranteed to be byte-for-byte identical between engines.

## Supabase

To connect to Supabase instead of a local database, set `DB_DRIVER=postgres` and `DATABASE_URL` to your Supabase connection string.
