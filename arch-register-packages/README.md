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
- The core and surface-specific OpenAPI documents are generated from the contracts (`@orpc/openapi`) and served at `/openapi.json`, `/openapi/application-v1.json`, `/openapi/integrations-v1.json`, and `/openapi/adapters/diagram-craft.json`.

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

## 🧩 Apps: pluggable domain packs

Arch Register's core — entities, relations, schemas, projects, assessments, governance workflow,
and permissions — is domain-agnostic. **Apps** are optional packs that build on that core to support
a specific domain, such as Business Glossary. An app owns a set of entity/relation schemas, the
capability binding that lets other features discover them, and (optionally) its own API contract,
server handlers, and web UI. It never gets special treatment from core: an app schema is an ordinary
entity schema, and app code reaches core the same way any other domain module does, via
`@arch-register/api-types` contracts and `server/src/domain/<area>/` handlers/operations.

App code lives in a package-local `src/app/<app-name>/` directory, parallel to `src/domain/<area>/`:

- `api-types/src/app/<app-name>/` — the app's own contract file(s), if it needs endpoints beyond
  generic entity/relation CRUD
- `server/src/app/<app-name>/` — oRPC handlers/operations for those endpoints, plus the app's schema
  template pack and any demo/seed data
- `web/src/app/<app-name>/` — screens, routes, and query hooks
- `e2e/src/app/<app-name>/` — API/UI tests for the app

`server/src/app/business-glossary/` is the current example: `glossaryOrpc.ts`/`glossaryOperations.ts`
implement `glossaryContract.ts`'s endpoints, and `glossarySchemaTemplate.ts` exports the Term/Term
Category schemas that get spread into `domain/catalog/schemaTemplates.ts`'s `SCHEMA_TEMPLATES` array
(see `domain/catalog/schemaTemplateBase.ts` for the small, dependency-free helpers — `enumDefinition`,
the shared ADR document type/template — that both core and app schema packs import, without an app
pack ever importing back from `schemaTemplates.ts` at the value level, which would create a circular
import). Most other cross-cutting concerns (Strategy Model, Security/Threat Model, Risk & Compliance,
Retention) don't have dedicated app code yet — they exist only as data entries in
`schemaTemplates.ts`/`integrationCatalog.ts` and are candidates for the same treatment over time.

Two registries are the extension points an app plugs into, both composed by importing one factory per
registrant rather than a central switch statement:

- **Workspace capabilities** (`api-types/src/integrationCatalog.ts`'s `workspaceCapabilityDefinitions`)
  bind an app's semantic roles (e.g. "term", "category") to concrete entity/relation schemas in a
  workspace, so other features can discover them without knowing the app's schema ids. An app exports
  its `WorkspaceCapabilityDefinition` from `api-types/src/app/<app-name>/` and `integrationCatalog.ts`
  spreads it into the array — see `glossaryCapability.ts`.
- **Governance case kinds** (`server/src/domain/governance/governanceRegistryFactory.ts`) let an app
  register workflow behavior (approvals, reminders, escalation) for a case kind it owns, by exporting a
  `createXGovernanceRegistry()` factory that gets spread into `createApplicationGovernanceRegistry()`.
  No app currently owns a case kind, but this is the pattern to follow if one needs to.

On the web client, an app that needs a workspace-rail entry (icon, route, breadcrumbs) registers it in
`web/src/shell/appShellRegistry.ts` rather than hardcoding the id in `shell/shellTypes.ts` or
`layouts/workspaceShellDescriptors.tsx` — see `app/business-glossary/glossaryShell.tsx`.

This is a step toward a future plugin/extension framework, not a full plugin system yet — apps are
still first-party code in this repo, registered by import rather than dynamically loaded.

## 🏗️ Architecture Decisions

### Contract-First API

Contracts in `api-types` are the single source of truth: request/response shapes are Zod schemas, so server handlers, the web client, and e2e tests all share the same types with no manual sync or generation step. The OpenAPI spec is derived from the contracts:

```bash
# Regenerate the checked-in OpenAPI documents from the contracts
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

This is the workflow for generic core endpoints. For an endpoint that belongs to an app (see
[🧩 Apps](#-apps-pluggable-domain-packs) above), use the same steps but under
`api-types/src/app/<app-name>/`, `server/src/app/<app-name>/`, `web/src/app/<app-name>/`, and
`e2e/src/app/<app-name>/` instead — and add the test directory to `e2e/vitest.config.ts`'s `include`
if the app doesn't have one yet.

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

### Switching Users In Development

A dev-only user switcher lets you instantly assume the identity of any user in the database, bypassing login
entirely — useful for testing permissions and workspace roles without juggling credentials.

Configure these environment variables in `server/.env`:

```bash
NODE_ENV=development
DEV_USER_SWITCHER_ENABLED=true
```

Both must be set — the switcher stays disabled if either is missing, and it is always disabled when
`NODE_ENV=production` regardless of the flag. When enabled, a floating dev toolbar appears in the web app (even on
the login screen) listing all users; picking one signs you in as that user immediately.

### Request Tracing In Development

A dev-only tracer correlates a UI interaction with the work it triggers:

```
interaction (click / navigation)
  └─ API request (oRPC operation)
       └─ SQL statement
```

Configure these environment variables in `server/.env`:

```bash
NODE_ENV=development
DEV_TRACING_ENABLED=true
```

Both must be set (and it is always off when `NODE_ENV=production`). When enabled, the `DEV` panel in the web app
gains a **Traces** tab showing the interaction → request → SQL tree with per-span timings, full SQL text, and bound
parameters. The same spans are logged to the server console (namespace `trace`), and every server log line emitted
during a traced request is prefixed with `[trace:… span:…]`.

Traces are held in a small in-memory ring buffer (last ~50) and are never persisted. Postgres SQL spans do not
carry a duration (postgres.js reports queries before they execute); SQLite spans do.

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
- `*/src/app/<app-name>/` - App-specific code (e.g. `business-glossary`); see 🧩 Apps above
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

- **API Documentation**: Run the server and fetch the core document at `/openapi.json` or a surface-specific document such as `/openapi/application-v1.json`, or see the checked-in documents under `server/openapi.json` and `server/openapi/`
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
- `pnpm --filter @arch-register/server openapi:check` fails when any checked-in OpenAPI document is out of date; regenerate with `openapi:generate`
