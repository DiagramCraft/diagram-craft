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

## Core Concepts

### Permission Types

- **Global Permissions**: Platform-wide permissions (e.g., `view_schema`, `manage_users`)
- **Entity Permissions**: Entity-specific actions (e.g., `view_entity`, `edit_entity`, `admin_entity`)
- **Project Permissions**: Project-level actions (e.g., `canEdit`, `canDelete`, `canManageFiles`)

### Authorization Context

The `AuthorizationContext` contains all data needed for permission evaluation:
- User's global roles and permissions
- Team memberships
- Entity schemas and data
- Entity grants (explicit permission assignments)

## Usage

### Abstract Base Class

The `PermissionEvaluator` abstract class provides the core permission logic:

```typescript
import { PermissionEvaluator, type AuthorizationContext, type Entity } from '@arch-register/permissions';

class MyPermissionEvaluator extends PermissionEvaluator {
  async buildContext(workspaceId: string, userId: string): Promise<AuthorizationContext> {
    // Implement data fetching
  }
}

const evaluator = new MyPermissionEvaluator(dataProvider);
const context = await evaluator.buildContext('workspace-id', 'user-id');

// Check entity permissions
const canEdit = evaluator.hasEntityPermission(context, entity, 'edit_entity');

// Get all entity capabilities
const capabilities = evaluator.getEntityCapabilities(context, entity);
// { canView: true, canEdit: true, canDelete: false, canAdmin: false, canCreateChild: true }

// Check project permissions
const canEditProject = evaluator.canEditProject(context, ownerTeamId);

// Get all project capabilities
const projectCaps = evaluator.getProjectCapabilities(context, ownerTeamId);
// { canEdit: true, canDelete: true, canManageFiles: true }

// Check global permissions
const canManageUsers = evaluator.hasGlobalPermission(context, 'manage_users');
```

### Data Provider Interface

Implement the `PermissionDataProvider` interface to provide data:

```typescript
import { type PermissionDataProvider } from '@arch-register/permissions';

class MyDataProvider implements PermissionDataProvider {
  async getEntities(workspaceId: string): Promise<Entity[]> {
    // Fetch entities
  }

  async getSchemas(workspaceId: string): Promise<EntitySchema[]> {
    // Fetch schemas
  }

  async getEntityGrants(workspaceId: string): Promise<EntityGrant[]> {
    // Fetch grants
  }

  async getTeamMemberships(workspaceId: string, userId: string): Promise<string[]> {
    // Fetch team IDs
  }

  async getGlobalRoles(userId: string): Promise<GlobalRole[]> {
    // Fetch global roles
  }
}
```

## Server Implementation Example

```typescript
import { PermissionEvaluator, type AuthorizationContext, type PermissionDataProvider } from '@arch-register/permissions';
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
}

export class ServerPermissionEvaluator extends PermissionEvaluator {
  constructor(private db: DatabaseAdapter) {
    super(new ServerDataProvider(db));
  }

  async buildContext(workspaceId: string, userId: string): Promise<AuthorizationContext> {
    const [globalRoles, teamMemberships, schemas, entities, grants] = await Promise.all([
      this.dataProvider.getGlobalRoles(userId),
      this.dataProvider.getTeamMemberships(workspaceId, userId),
      this.dataProvider.getSchemas(workspaceId),
      this.dataProvider.getEntities(workspaceId),
      this.dataProvider.getEntityGrants(workspaceId),
    ]);

    return this.buildAuthorizationContextFromData(
      userId,
      globalRoles,
      teamMemberships,
      schemas,
      entities,
      grants
    );
  }
}
```

## Web Implementation Example

```typescript
import { PermissionEvaluator, type AuthorizationContext, type PermissionDataProvider } from '@arch-register/permissions';

class WebDataProvider implements PermissionDataProvider {
  constructor(private apiBaseUrl: string) {}

  async getEntities(workspaceId: string) {
    const res = await fetch(`${this.apiBaseUrl}/api/${workspaceId}/data`);
    return res.json();
  }

  async getSchemas(workspaceId: string) {
    const res = await fetch(`${this.apiBaseUrl}/api/${workspaceId}/schemas`);
    return res.json();
  }

  async getEntityGrants(workspaceId: string) {
    const res = await fetch(`${this.apiBaseUrl}/api/${workspaceId}/grants`);
    return res.json();
  }

  async getTeamMemberships(workspaceId: string, userId: string) {
    const res = await fetch(`${this.apiBaseUrl}/api/${workspaceId}/teams/memberships?userId=${userId}`);
    return res.json();
  }

  async getGlobalRoles(userId: string) {
    const res = await fetch(`${this.apiBaseUrl}/api/users/${userId}/roles`);
    return res.json();
  }
}

export class WebPermissionEvaluator extends PermissionEvaluator {
  constructor(private apiBaseUrl: string) {
    super(new WebDataProvider(apiBaseUrl));
  }

  async buildContext(workspaceId: string, userId: string): Promise<AuthorizationContext> {
    // Consider caching this data
    const [globalRoles, teamMemberships, schemas, entities, grants] = await Promise.all([
      this.dataProvider.getGlobalRoles(userId),
      this.dataProvider.getTeamMemberships(workspaceId, userId),
      this.dataProvider.getSchemas(workspaceId),
      this.dataProvider.getEntities(workspaceId),
      this.dataProvider.getEntityGrants(workspaceId),
    ]);

    return this.buildAuthorizationContextFromData(
      userId,
      globalRoles,
      teamMemberships,
      schemas,
      entities,
      grants
    );
  }
}
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

1. **Global Roles**: `platform_admin` can edit all projects
2. **Owner Team Membership**: Team owners can edit their projects

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

## Constants

```typescript
import { ROLE_ACTIONS, GLOBAL_ROLE_PERMISSIONS } from '@arch-register/permissions';

// Maps entity roles to actions
ROLE_ACTIONS['viewer'] // ['view_entity']
ROLE_ACTIONS['editor'] // ['view_entity', 'edit_entity']
ROLE_ACTIONS['contributor'] // ['view_entity', 'edit_entity', 'create_child']
ROLE_ACTIONS['entity_admin'] // ['view_entity', 'edit_entity', 'create_child', 'admin_entity']

// Maps global roles to permissions
GLOBAL_ROLE_PERMISSIONS['platform_admin'] // All permissions + entity actions
GLOBAL_ROLE_PERMISSIONS['schema_admin'] // ['view_schema', 'edit_schema']
```

## Security Considerations

⚠️ **Important**: Client-side permission checks are for UX optimization only. Always enforce permissions on the server.

- Client checks enable optimistic UI (show/hide buttons)
- Server must always verify permissions before executing actions
- Client-side context may be stale; implement caching strategy
- Never trust client-side permission decisions for security

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
