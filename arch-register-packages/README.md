# Architecture Register Packages

This directory contains the packages that make up the Architecture Register application - a collaborative platform for managing architectural entities, schemas, projects, and documentation.

## 📦 Package Structure

### Core Packages

#### `api-types/`
**oRPC contracts and shared TypeScript types**

- Single source of truth for the API contract, defined TypeScript-first with `@orpc/contract` and Zod schemas
- One contract file per domain area (`entityContract.ts`, `projectContract.ts`, `governanceContract.ts`, ...)
- Consumed by the server (handler implementations), the web client (typed oRPC client), and the e2e tests

#### `server/`
**h3 + oRPC API server**

- Code is organized by domain area under `server/src/domain/<area>/`:
  - `<x>Orpc.ts` — oRPC handlers implementing the contract (via `implement(...)` from `@orpc/server`)
  - `<x>Operations.ts` — business logic
  - `db/` — database repositories
- Runs against PostgreSQL or SQLite; app wiring lives in `server/src/app.ts`
- The OpenAPI spec is generated from the contracts (`@orpc/openapi`) and served at `/openapi.json`

#### `web/`
**React + Vite web client**

- SPA built with React, TypeScript, and TanStack Router/Query
- Typed oRPC client in `web/src/lib/orpcClient.ts`; query hooks in `web/src/queries/`
- Imports contract types directly from `@arch-register/api-types`

#### `permissions/`
**Authorization and permission checking library**

- Shared between server and other services
- Implements role-based access control (RBAC)
- Entity-level permissions with inheritance
- Team-based access control

**Key concepts:**
- Global roles (platform admin, workspace admin)
- Workspace roles (owner, admin, editor, reviewer, viewer)
- Entity-level grants with scope (self, subtree)
- Team roles and assignments

See `permissions/PERMISSIONS.md` for details.

#### `e2e/`
**API and UI test suites**

- `src/api/` — API tests running against a real h3 server with an in-memory SQLite database
- `src/ui/` — Playwright tests that auto-start server and web dev server

### Supporting Packages

- `job-server/` — standalone scheduler and worker process for recurring workspace jobs
- `mcp-server/` — MCP tools for querying/updating an Arch Register workspace
- `webhook-test-server/` — small helper server for testing outgoing webhooks locally

## 🏗️ Architecture Decisions

### Contract-First API

Contracts in `api-types` are the single source of truth: request/response shapes are Zod schemas, so server handlers, the web client, and e2e tests all share the same types with no manual sync or generation step. The OpenAPI spec is derived from the contracts:

```bash
# Regenerate server/openapi.json from the contracts
pnpm --filter @arch-register/server openapi:generate

# Verify the checked-in spec is up to date
pnpm --filter @arch-register/server openapi:check
```

### Database Layer

Each domain area has repositories under `server/src/domain/<area>/db/` with parallel SQLite and PostgreSQL implementations (e.g. `sqliteCatalog.ts` / `postgresCatalog.ts`) behind a shared interface. Contract tests in `server/src/db/contract-tests/` run the same test suite against both implementations to keep them in sync.

### Permission Model

**Hierarchical permissions:**
```
Global Roles
  └─ Workspace Roles
      └─ Entity Grants (with scope)
          └─ Team Assignments
```

**Visibility modes:**
- `public`: Visible to all workspace members
- `restricted`: Only visible to users with explicit grants

## 🚀 Development Workflows

### Adding or Changing an API Endpoint

1. **Update the contract** in `api-types/src/<area>Contract.ts`
2. **Implement the handler** in the matching `server/src/domain/<area>/<x>Orpc.ts`
3. **Put business logic** in `<x>Operations.ts`
4. **Add db methods** to both the SQLite and PostgreSQL repositories in `domain/<area>/db/`, and cover them in the db contract tests
5. **Cover the endpoint** with e2e API tests in `e2e/src/api/`
6. **Update the web client** (`web/src/queries/`) to use the new endpoint

### Running the Application

**Development mode:**
```bash
# Terminal 1: Start server
cd server
pnpm dev

# Terminal 2: Start web client
cd web
pnpm dev
```

Server configuration lives in `server/.env` (see `server/.env.example` for available variables: database, auth/OIDC, CORS, AI provider, etc.).

### Simulating API Latency In Development

The server can add artificial latency to all API requests in development mode to help surface loading-state issues, race conditions, and responsiveness problems earlier.

Configure these environment variables in `server/.env`:

```bash
NODE_ENV=development
DEV_API_DELAY_MS=500
DEV_API_DELAY_VARIANCE_MS=200
```

This applies an approximate 300-700ms delay to each API request. The delay middleware is disabled by default and has no effect outside development mode.

## 🧪 Testing

### Type Checking
```bash
# From repository root
pnpm lint:tsc
```

### Unit Tests
```bash
# From repository root (all packages)
pnpm test

# Server package only
cd server && vitest run
```

### Database Contract Tests

Run the shared repository test suite against both SQLite and PostgreSQL:

```bash
pnpm --filter @arch-register/server test:db-contract
```

### E2E / Integration Tests

E2E tests live in `e2e/` and are split into two suites.

**API tests** — start a real h3 server with an in-memory SQLite database and test endpoints directly. No browser required.

```bash
pnpm --filter @arch-register/e2e test:api
```

**UI tests** — Playwright tests that auto-start both the server and the web dev server before running. The quick suite provides broad, fast feedback across the main workspace features; the full suite includes complete UI validation, including detailed history, failure-mode, export, and state-mutation coverage.

```bash
# Fast representative suite
pnpm --filter @arch-register/e2e test:ui:quick

# Complete suite
pnpm --filter @arch-register/e2e test:ui:full

# Backward-compatible alias for the complete suite
pnpm --filter @arch-register/e2e test:ui

# With browser visible
pnpm --filter @arch-register/e2e test:ui:headed
```

The UI test suite seeds the same bootstrap dataset as the server bootstrap script, including demo users, entities, projects, views, watches, and notifications. Use `james.chen@example.com` / `test` to sign in. The server runs on port 3011 to avoid conflicting with a locally running dev server.

## 📝 Key Files

- `api-types/src/*Contract.ts` - oRPC API contracts
- `server/src/app.ts` - Server app wiring (handlers, middleware, auth)
- `server/src/domain/` - Domain-organized handlers, operations, and db repositories
- `permissions/src/types.ts` - Permission type definitions
- `web/src/lib/orpcClient.ts` - Typed API client

## 🔄 Package Dependencies

```
api-types (contracts)
    ↓
    ├─→ server ←─ permissions
    ├─→ web    ←─ permissions
    └─→ e2e    ←─ server
```

All packages use `workspace:*` protocol for internal dependencies, managed by pnpm workspaces.

## 📚 Additional Documentation

- **API Documentation**: Run the server and fetch `/openapi.json`, or see the checked-in `server/openapi.json`
- **Permission System**: See `permissions/PERMISSIONS.md`
- **Feature Inventory**: See `FEATURES.md` and the repository-level `feature-maps/`
- **AI Setup**: See `AI_SETUP.md`
- **End-user docs**: See `docs-site/` at the repository root

## 🛠️ Maintenance

**Permission checks failing:**
- Review authorization context building in `permissions/src/AuthorizationContextBuilder.ts`
- Verify grants are properly loaded
- Check team assignments and role inheritance

**OpenAPI drift:**
- `pnpm --filter @arch-register/server openapi:check` fails when `server/openapi.json` is out of date; regenerate with `openapi:generate`
