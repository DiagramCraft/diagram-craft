# Architecture Register Packages

This directory contains the packages that make up the Architecture Register application - a collaborative platform for managing architectural entities, schemas, and documentation.

## 📦 Package Structure

### Core Packages

#### `api-types/`
**Shared TypeScript type definitions for the API contract**

- Single source of truth for all API types
- Used by both server and web client packages
- Includes validation script to ensure OpenAPI spec stays in sync
- **Key types**: Entity, EntitySchema, Project, Workspace, Audit logs

**Validation:**
```bash
cd api-types
pnpm validate:openapi
```

This validates that the OpenAPI specification (`server/openapi.yaml`) matches the TypeScript type definitions. Run this after making changes to either the types or the OpenAPI spec.

#### `server/`
**Express.js REST API server**

- Handles all backend logic and database operations
- Uses internal types with `Date` objects for database layer
- Transforms to/from API types (ISO date strings) at route boundaries
- OpenAPI specification: `server/openapi.yaml`

**Key features:**
- Entity and schema management
- Project and file management
- Workspace administration
- Audit logging
- Permission enforcement

#### `web/`
**React + Vite web client**

- Modern SPA built with React and TypeScript
- Uses TanStack Query for data fetching
- Imports types directly from `@arch-register/api-types`
- Material Design-inspired UI components

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

## 🏗️ Architecture Decisions

### Type System Design

**API Types vs Internal Types:**
- **API types** (`@arch-register/api-types`): Use ISO 8601 date strings, prefixed metadata fields (`_uid`, `_name`, etc.)
- **Internal types** (server): Use `Date` objects, database column names (`id`, `name`, etc.)
- **Transformation layer** (`server/src/api/transforms.ts`): Converts between representations

This separation ensures:
- Clean API contracts that serialize well
- Type-safe database operations
- Clear boundaries between layers

### OpenAPI Specification

The OpenAPI spec serves as:
1. API documentation
2. Contract for client generation
3. Validation reference (via `api-types/scripts/validate-openapi.ts`)

**Keeping it in sync:**
- Manual updates when adding/changing endpoints
- Automated validation catches schema drift
- Consider adding to CI/CD pipeline for stricter enforcement

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

### Adding a New API Endpoint

1. **Define types** in `api-types/src/`
2. **Update OpenAPI spec** in `server/openapi.yaml`
3. **Validate**: `cd api-types && pnpm validate:openapi`
4. **Implement route** in `server/src/routes/`
5. **Add transformation** in `server/src/api/transforms.ts` (if needed)
6. **Update web client** to use new endpoint

### Modifying Existing Types

1. **Update TypeScript types** in `api-types/src/`
2. **Update OpenAPI schema** in `server/openapi.yaml`
3. **Run validation**: `cd api-types && pnpm validate:openapi`
4. **Update transformations** in `server/src/api/transforms.ts`
5. **Update affected routes** in `server/src/routes/`
6. **Update web client** usage

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

### Simulating API Latency In Development

The server can add artificial latency to all API requests in development mode to help surface loading-state issues, race conditions, and responsiveness problems earlier.

Configure these environment variables in `server/.env` or `server/.env.local`:

```bash
NODE_ENV=development
DEV_API_DELAY_MS=500
DEV_API_DELAY_VARIANCE_MS=200
```

This applies an approximate 300-700ms delay to each API request. The delay middleware is disabled by default and has no effect outside development mode.

**Production build:**
```bash
# Build all packages
pnpm install
cd server && pnpm build
cd ../web && pnpm build
```

## 🧪 Testing

### Type Checking
```bash
# From repository root
pnpm lint:tsc

# Individual packages
cd server && pnpm exec tsc --noEmit
cd web && pnpm exec tsc --noEmit
cd permissions && pnpm exec tsc --noEmit
```

### API Validation
```bash
cd api-types
pnpm validate:openapi
```

### Unit Tests
```bash
# From repository root (all packages)
pnpm test

# Server package only
cd server && pnpm test
```

### E2E / Integration Tests

E2E tests live in `e2e/` and are split into two suites.

**API tests** — start a real H3 server with an in-memory SQLite database and test REST endpoints directly. No browser required.

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

- `api-types/src/index.ts` - Main type exports
- `server/openapi.yaml` - API specification
- `server/src/api/transforms.ts` - Type transformation layer
- `permissions/src/types.ts` - Permission type definitions
- `web/src/api.ts` - API client implementation

## 🔄 Package Dependencies

```
api-types (no dependencies)
    ↓
    ├─→ server
    ├─→ web
    └─→ permissions
```

All packages use `workspace:*` protocol for internal dependencies, managed by pnpm workspaces.

## 📚 Additional Documentation

- **API Documentation**: See `server/openapi.yaml` or run server and visit `/api-docs`
- **Permission System**: See `permissions/PERMISSIONS.md`
- **Type Sharing Plan**: See `API_TYPE_SHARING_PLAN.md`

## 🛠️ Maintenance

### Regular Tasks

1. **Keep OpenAPI spec in sync**: Run validation after type changes
2. **Update dependencies**: Use `pnpm update` in each package
3. **Review transformation layer**: Ensure all new types have proper transforms
4. **Check for type drift**: Run `pnpm lint:tsc` regularly

### Common Issues

**OpenAPI validation fails:**
- Check that all required fields are present in both TypeScript types and OpenAPI schemas
- Verify field names match exactly (case-sensitive)
- Ensure enum values are consistent

**Type errors in web client:**
- Verify `@arch-register/api-types` is up to date: `pnpm install`
- Check that imports use correct paths
- Ensure transformation functions are applied at API boundaries

**Permission checks failing:**
- Review authorization context building in `permissions/src/AuthorizationContextBuilder.ts`
- Verify grants are properly loaded
- Check team assignments and role inheritance
