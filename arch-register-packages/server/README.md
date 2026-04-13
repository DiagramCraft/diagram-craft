# @arch-register/server

REST API server for the Architecture Register. Stores entities (components, systems, servers, etc.) and their schemas in PostgreSQL.

## Prerequisites

- Node.js 20+
- pnpm
- PostgreSQL 15+ running locally

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
\q
```

### 3. Configure the connection string

Copy the example env file and fill in your credentials:

```bash
cp .env.example .env
```

Edit `.env`:

```
DATABASE_URL=postgresql://arch_register:yourpassword@localhost:5432/arch_register
```

## Installation

From the repo root or this directory:

```bash
pnpm install
```

## Bootstrap the database

This drops any existing tables, recreates the schema, and loads seed data:

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

The server listens on `http://localhost:3000` by default. Set `PORT` in `.env` to use a different port.

## API

### Schemas

Schemas define the available entity types and their fields.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/schemas` | List all schemas |
| GET | `/api/schemas/:id` | Get a schema by ID |
| POST | `/api/schemas` | Create a schema |
| PUT | `/api/schemas/:id` | Update a schema |
| DELETE | `/api/schemas/:id` | Delete a schema (fails if data records exist) |

Response format matches `packages/main/public/data/dataset1/schemas.json`. `source` is always returned as `"external"` and is not stored in the database.

**Example — create a schema:**
```bash
curl -X POST http://localhost:3000/api/schemas \
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

Data records are instances of a schema type. The wire format is flat: `{ _uid, _schemaId, ...fields }`, matching `packages/main/public/data/dataset1/data.json`.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/data` | List all records |
| GET | `/api/data?_schemaId=<uuid>` | List records of a specific schema type |
| GET | `/api/data/:id` | Get a record by ID |
| POST | `/api/data` | Create a record |
| PUT | `/api/data/:id` | Update a record |
| DELETE | `/api/data/:id` | Delete a record |

**Example — list all Component records:**
```bash
# Get the Component schema ID first
curl http://localhost:3000/api/schemas

# Then filter by that ID
curl "http://localhost:3000/api/data?_schemaId=00000000-0000-0000-0000-000000000001"
```

**Example — create a record:**
```bash
curl -X POST http://localhost:3000/api/data \
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
entity_schema
  id         UUID  (primary key)
  name       TEXT  (unique)
  fields     JSONB (array of field descriptors)
  created_at TIMESTAMPTZ
  updated_at TIMESTAMPTZ

entity
  id         UUID  (primary key)
  name       TEXT
  schema_id  UUID  (foreign key → entity_schema)
  data       JSONB (dynamic fields, flattened in API responses)
  created_at TIMESTAMPTZ
  updated_at TIMESTAMPTZ
```

`updated_at` is maintained automatically by a database trigger.

## Supabase

To connect to Supabase instead of a local database, set `DATABASE_URL` to your Supabase connection string. If using the **Transaction Mode** pooler (port 6543), also add `prepare: false` to the postgres options in `src/db/client.ts`.
