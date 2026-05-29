# @arch-register/permissions

Shared permission evaluation module for Arch Register. Provides consistent authorization logic for both server and web clients.

## Overview

This module implements a shared permission evaluation system that can be used by:
- **Server**: Direct database queries for authoritative permission checks
- **Web Client**: API-based data fetching for optimistic UI permission checks

## Installation

```bash
pnpm add @arch-register/permissions
```

## Architecture

The module is split into two main components with clear responsibilities. This separation is **intentional** and provides important architectural benefits:

### Design Rationale

**PermissionChecker** handles **pure permission logic**:
- Stateless evaluation of assigned permissions and roles
- Foundation layer for all permission checks
- No business logic or complex rules
- Directly maps to what permissions exist in the system

**CapabilityEvaluator** handles **business logic and computed capabilities**:
- Combines multiple permission checks
- Applies contextual business rules
- Determines what actions are possible given the current state
- May evolve independently as business requirements change

This separation provides:
1. **Clear boundaries**: Pure permission checks vs. business logic
2. **Testability**: Can test permission logic independently from business rules
3. **Flexibility**: Business logic can evolve without changing core permission checks
4. **Reusability**: PermissionChecker can be used directly when you need low-level checks

### When to Use Each

- Use **PermissionChecker** when you need to verify a specific assigned permission exists
- Use **CapabilityEvaluator** when you need to determine if an action is possible in the current context

### PermissionChecker

Checks **assigned permissions and roles** against an authorization context.

- `hasEntityPermission()` - Check assigned entity permissions
- `hasProjectPermission()` - Check assigned project permissions  
- `hasGlobalPermission()` - Check assigned global permissions

**Use when**: You need to verify if a user has a specific assigned permission.

### CapabilityEvaluator

Evaluates **computed capabilities** based on context and business rules.

- `canCreateProject()` - Check if user can create a project with specific owner
- `canCreateTopLevelEntity()` - Check if user can create top-level entity
- `canEditProject()` - Check if user can edit a project
- `canDeleteProject()` - Check if user can delete a project
- `canManageProjectFiles()` - Check if user can manage project files

**Use when**: You need to determine if a user CAN perform an action based on their roles, team memberships, and other contextual factors.

### Key Distinction

- **`has*` methods** = Checks assigned permissions/roles (static)
- **`can*` methods** = Computes capabilities based on context (dynamic)

## Core Concepts

### Permission Types

- **Global Permissions**: Assigned platform-wide permissions (e.g., `view_schema`, `manage_users`)
- **Entity Permissions**: Entity-specific actions (e.g., `view_entity`, `edit_entity`, `admin_entity`)
- **Project Permissions**: Project-level actions (e.g., `edit_project`, `delete_project`, `manage_files`)
- **Computed Capabilities**: Context-dependent checks (e.g., can create project for specific team)

### Authorization Context

The `AuthorizationContext` contains all data needed for permission evaluation:
- User's global roles and permissions
- Team memberships
- Owner options (teams that can own records)
- Entity schemas and data
- Entity grants (explicit permission assignments)

## Usage

### Basic Usage

```typescript
import { 
  PermissionChecker, 
  CapabilityEvaluator,
  buildAuthorizationContext,
  type AuthorizationContext 
} from '@arch-register/permissions';

// Create instances
const checker = new PermissionChecker();
const capabilities = new CapabilityEvaluator();

// Build context (see below for data fetching)
const context = buildAuthorizationContext({
  userId: 'user-123',
  globalRoles: ['schema_admin'],
  teamMemberships: ['team-456'],
  ownerOptions: [{ id: 'team-456', name: 'Engineering', type: 'team' }],
  schemas: [...],
  entities: [...],
  grants: [...]
});

// Check assigned permissions
const canEdit = checker.hasEntityPermission(context, entity, 'edit_entity');
const canManageUsers = checker.hasGlobalPermission(context, 'manage_users');
const canEditProject = checker.hasProjectPermission(context, ownerTeamId, 'edit_project');

// Check computed capabilities
const canCreateProject = capabilities.canCreateProject(context, ownerTeamId);
const canCreateEntity = capabilities.canCreateTopLevelEntity(context, ownerTeamId);
```

### Building Authorization Context

Use the helper functions to build context from raw data:

```typescript
import { 
  buildAuthorizationContext,
  fetchAuthorizationContextData,
  type PermissionDataProvider 
} from '@arch-register/permissions';

// Option 1: Build from data you already have
const context = buildAuthorizationContext({
  userId: 'user-123',
  globalRoles: ['platform_admin'],
  teamMemberships: ['team-456'],
  ownerOptions: [...],
  schemas: [...],
  entities: [...],
  grants: [...]
});

// Option 2: Fetch data using a provider
class MyDataProvider implements PermissionDataProvider {
  async getEntities(workspaceId: string) { /* ... */ }
  async getSchemas(workspaceId: string) { /* ... */ }
  async getEntityGrants(workspaceId: string) { /* ... */ }
  async getTeamMemberships(workspaceId: string, userId: string) { /* ... */ }
  async getGlobalRoles(userId: string) { /* ... */ }
  async getOwnerOptions(workspaceId: string) { /* ... */ }
}

const dataProvider = new MyDataProvider();
const contextData = await fetchAuthorizationContextData(
  dataProvider,
  'workspace-id',
  'user-id'
);
const context = buildAuthorizationContext(contextData);
```

## Server Implementation Example

```typescript
import { 
  PermissionChecker, 
  CapabilityEvaluator,
  buildAuthorizationContext,
  fetchAuthorizationContextData,
  type PermissionDataProvider 
} from '@arch-register/permissions';
import type { DatabaseAdapter } from './db/database.js';

class ServerDataProvider implements PermissionDataProvider {
  constructor(private db: DatabaseAdapter) {}

  async getEntities(workspaceId: string) {
    return this.db.listEntities(workspaceId);
  }

  async getSchemas(workspaceId: string) {
    return this.db.listSchemas(workspaceId);
  }

  async getEntityGrants(workspaceId: string) {
    return this.db.listEntityGrants(workspaceId);
  }

  async getTeamMemberships(workspaceId: string, userId: string) {
    const memberships = await this.db.listTeamMemberships(workspaceId);
    return memberships
      .filter(m => m.user_id === userId)
      .map(m => m.team_id);
  }

  async getGlobalRoles(userId: string) {
    const assignments = await this.db.listGlobalRoleAssignments(userId);
    return assignments.map(a => a.role);
  }

  async getOwnerOptions(workspaceId: string) {
    return this.db.listOwnerOptions(workspaceId);
  }
}

// In your route handlers
const checker = new PermissionChecker();
const capabilities = new CapabilityEvaluator();

async function handleRequest(db: DatabaseAdapter, workspaceId: string, userId: string) {
  // Build context
  const dataProvider = new ServerDataProvider(db);
  const contextData = await fetchAuthorizationContextData(dataProvider, workspaceId, userId);
  const context = buildAuthorizationContext(contextData);

  // Check permissions
  if (!checker.hasEntityPermission(context, entity, 'edit_entity')) {
    throw new Error('Forbidden');
  }

  // Check capabilities
  if (!capabilities.canCreateProject(context, ownerTeamId)) {
    throw new Error('Cannot create project for this team');
  }

  // Proceed with action...
}
```

## Web Implementation Example

```typescript
import { 
  PermissionChecker, 
  CapabilityEvaluator,
  buildAuthorizationContext,
  type AuthorizationContext 
} from '@arch-register/permissions';

// In a React context
export const PermissionProvider = ({ children }) => {
  const { user } = useAuth();
  const authData = useAuthorizationData();

  const checker = useMemo(() => new PermissionChecker(), []);
  const capabilities = useMemo(() => new CapabilityEvaluator(), []);

  const buildContext = useCallback((workspaceId: string) => {
    if (!user || !authData) return null;

    const teamMembership = authData.team_memberships.find(
      tm => tm.workspace_id === workspaceId
    );
    const ownerOptions = authData.owner_options_by_workspace[workspaceId] ?? [];

    return buildAuthorizationContext({
      userId: user.id,
      globalRoles: authData.global_roles,
      teamMemberships: teamMembership?.team_ids ?? [],
      ownerOptions,
      schemas: [], // Fetch separately if needed
      entities: [], // Fetch separately if needed
      grants: []
    });
  }, [user, authData]);

  const hasEntityPermission = useCallback((workspaceId, entity, action) => {
    const context = buildContext(workspaceId);
    return context ? checker.hasEntityPermission(context, entity, action) : false;
  }, [buildContext, checker]);

  const canCreateProject = useCallback((workspaceId, ownerTeamId) => {
    const context = buildContext(workspaceId);
    return context ? capabilities.canCreateProject(context, ownerTeamId) : false;
  }, [buildContext, capabilities]);

  return (
    <PermissionContext.Provider value={{ 
      hasEntityPermission, 
      canCreateProject,
      // ... other methods
    }}>
      {children}
    </PermissionContext.Provider>
  );
};
```

## Permission Logic

### Entity Permissions

Entity permissions are evaluated based on:

1. **Global Roles**: `platform_admin` has all entity actions
2. **Visibility Mode**: Public entities are viewable by all
3. **Owner Team Membership**: Team owners get `entity_admin` role
4. **Entity Grants**: Explicit role assignments on entities or subtrees

### Project Permissions

Project permissions are evaluated based on:

1. **Global Roles**: `platform_admin` can perform all project actions
2. **Owner Team Membership**: Team owners can perform all project actions

### Global Permissions

Global permissions are derived from global role assignments:

- `platform_admin`: All permissions
- `schema_admin`: `view_schema`, `edit_schema`
- `user_admin`: `manage_users`, `manage_teams`, `manage_global_roles`
- `auditor`: `view_audit`

### Role Hierarchy

**Entity Roles** (from least to most privileged):
- `viewer`: Can view entity
- `editor`: Can view and edit entity
- `contributor`: Can view, edit, and create child entities
- `entity_admin`: Full control over entity

**Global Roles**:
- `platform_admin`: Full platform access
- `schema_admin`: Can manage schemas
- `user_admin`: Can manage users and teams
- `auditor`: Can view audit logs

## Computed Capabilities

Some checks depend on workspace context rather than just assigned permissions:

### `canCreateProject(context, ownerTeamId)`

A user can create a project if:
- They are a `platform_admin` (can create for any owner), OR
- The owner is a team they are a member of

### `canCreateTopLevelEntity(context, ownerTeamId)`

A user can create a top-level entity if:
- They are a `platform_admin` (can create for any owner), OR
- They have `view_schema` permission AND the owner is a team they are a member of

## Constants

```typescript
import { ROLE_ACTIONS, GLOBAL_ROLE_PERMISSIONS, getGlobalPermissionsForRoles } from '@arch-register/permissions';

// Maps entity roles to actions
ROLE_ACTIONS['viewer'] // ['view_entity']
ROLE_ACTIONS['editor'] // ['view_entity', 'edit_entity']
ROLE_ACTIONS['contributor'] // ['view_entity', 'edit_entity', 'create_child']
ROLE_ACTIONS['entity_admin'] // ['view_entity', 'edit_entity', 'create_child', 'admin_entity']

// Maps global roles to permissions
GLOBAL_ROLE_PERMISSIONS['platform_admin'] // All permissions + entity actions
GLOBAL_ROLE_PERMISSIONS['schema_admin'] // ['view_schema', 'edit_schema']

// Get permissions for a set of roles
const permissions = getGlobalPermissionsForRoles(new Set(['schema_admin', 'auditor']));
```

## Security Considerations

⚠️ **Important**: Client-side permission checks are for UX optimization only. Always enforce permissions on the server.

- Client checks enable optimistic UI (show/hide buttons)
- Server must always verify permissions before executing actions
- Client-side context may be stale; implement caching strategy
- Never trust client-side permission decisions for security

## Migration from PermissionEvaluator

The old `PermissionEvaluator` class is still exported for backward compatibility but is deprecated. Migrate to the new API:

```typescript
// Old (deprecated)
const evaluator = new PermissionEvaluator();
evaluator.hasEntityPermission(context, entity, action);
evaluator.canCreateProject(context, ownerTeamId);

// New (recommended)
const checker = new PermissionChecker();
const capabilities = new CapabilityEvaluator();
checker.hasEntityPermission(context, entity, action);
capabilities.canCreateProject(context, ownerTeamId);
```

## Development

```bash
# Build the module
pnpm build

# Watch mode
pnpm dev

# Clean build artifacts
pnpm clean
```

## License

See root LICENSE file.