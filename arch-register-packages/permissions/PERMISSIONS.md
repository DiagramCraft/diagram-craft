# Permission System Documentation

## Overview

The permission system provides fine-grained access control across three levels:
- **Global permissions**: Platform-wide capabilities (e.g., managing users, schemas)
- **Project permissions**: Team-based access to projects
- **Entity permissions**: Hierarchical access to entities with inheritance

## Architecture

The permission system is built on two complementary components:

### PermissionChecker (Pure Permission Logic)

Handles stateless evaluation of assigned permissions and roles:
- `hasEntityPermission()` - Check if user has specific entity permission
- `hasProjectPermission()` - Check if user has specific project permission
- `hasGlobalPermission()` - Check if user has specific global permission

**Characteristics:**
- No business logic or complex rules
- Directly maps to what permissions exist in the system
- Foundation layer for all permission checks
- Used when you need to verify a specific assigned permission exists

### CapabilityEvaluator (Business Logic Layer)

Handles computed capabilities based on context and business rules:
- `canCreateProject()` - Can user create project with specific owner?
- `canCreateTopLevelEntity()` - Can user create top-level entity with specific owner?
- Future: `canEditProject()`, `canDeleteProject()`, `canManageProjectFiles()`

**Characteristics:**
- Combines multiple permission checks
- Applies contextual business rules
- Determines what actions are possible given current state
- May evolve independently as business requirements change
- Used when you need to determine if an action is possible in the current context

### Design Benefits

This intentional separation provides:

1. **Clear Boundaries**: Pure permission checks vs. business logic
2. **Testability**: Can test permission logic independently from business rules
3. **Flexibility**: Business logic can evolve without changing core permission checks
4. **Reusability**: PermissionChecker can be used directly for low-level checks

## Permission Types

### Global Permissions

Global permissions are granted through **global roles** and control platform-wide operations.

| Permission | Description | Granted By Role(s) |
|------------|-------------|-------------------|
| `view_schema` | View entity schemas and their definitions | `platform_admin`, `schema_admin` |
| `edit_schema` | Create, modify, and delete entity schemas | `platform_admin`, `schema_admin` |
| `manage_users` | Create, modify, and delete user accounts | `platform_admin`, `user_admin` |
| `manage_teams` | Create, modify, and delete teams | `platform_admin`, `user_admin` |
| `manage_global_roles` | Assign and revoke global roles | `platform_admin`, `user_admin` |
| `view_audit` | View audit logs and system activity | `platform_admin`, `auditor` |
| `admin_platform` | Full platform administration access | `platform_admin` |

### Virtual Permissions

Virtual permissions are **computed dynamically** and don't exist in the database. They combine multiple checks into a single permission query.

| Permission | Description | Evaluation Logic |
|------------|-------------|------------------|
| `create_project` | Can create a new project | Platform admin OR has team membership in at least one owner option |
| `create_top_level_entity` | Can create a top-level entity | Platform admin OR has team membership in at least one owner option |

**Why Virtual Permissions?**
- Consolidate complex permission logic into reusable checks
- Provide consistent evaluation across client and server
- Enable UI enablement checks (can create ANY) vs validation checks (can create THIS with specific owner)

### Entity Permissions

Entity permissions control access to individual entities and are granted through **entity roles**.

| Action | Description | Granted By Role(s) |
|--------|-------------|-------------------|
| `view_entity` | View entity details | `viewer`, `editor`, `contributor`, `entity_admin`, `platform_admin` |
| `edit_entity` | Modify entity properties | `editor`, `contributor`, `entity_admin`, `platform_admin` |
| `create_child` | Create child entities | `contributor`, `entity_admin`, `platform_admin` |
| `admin_entity` | Full entity administration (delete, manage grants) | `entity_admin`, `platform_admin` |

**Entity Roles:**
- `viewer`: Read-only access
- `editor`: Can view and edit
- `contributor`: Can view, edit, and create children
- `entity_admin`: Full control over entity and its subtree

**Grant Scope:**
- `self`: Permission applies only to the specific entity
- `subtree`: Permission applies to entity and all descendants

### Project Permissions

Project permissions control access to projects and are **team-based** (not role-based).

| Action | Description | Required |
|--------|-------------|----------|
| `edit_project` | Modify project properties | Team membership in project's owner team |
| `delete_project` | Delete the project | Team membership in project's owner team |
| `manage_files` | Upload, modify, delete project files | Team membership in project's owner team |

**Note:** Projects don't use roles. Access is binary: if you're a member of the project's owner team, you have all project permissions.

## Global Roles

| Role | Description | Permissions |
|------|-------------|-------------|
| `platform_admin` | Full platform access | All global permissions + all entity actions on all entities |
| `schema_admin` | Manage entity schemas | `view_schema`, `edit_schema` |
| `user_admin` | Manage users and teams | `manage_users`, `manage_teams`, `manage_global_roles` |
| `auditor` | View audit logs | `view_audit` |

## Permission Evaluation Flows

### Global Permission Check

```
hasGlobalPermission(permission)
├─ Is user platform_admin?
│  └─ YES → ALLOW
├─ Is permission virtual?
│  ├─ create_project or create_top_level_entity?
│  │  ├─ Is user platform_admin? → YES → ALLOW
│  │  └─ Does user have team membership in any owner option?
│  │     └─ YES → ALLOW
│  │     └─ NO → DENY
│  └─ NO → Check user's global permissions set
│     └─ Permission in set? → YES → ALLOW
│                           → NO → DENY
```

**Implementation:**
- Server: `PermissionEvaluator.hasGlobalPermission(context, permission)`
- Client: `AuthContext.hasGlobalPermission(permission, workspaceId?)`

### Project Permission Check

```
hasProjectPermission(ownerTeamId, action)
├─ Is user platform_admin?
│  └─ YES → ALLOW
└─ Is user member of ownerTeamId?
   └─ YES → ALLOW
   └─ NO → DENY
```

**Implementation:**
- Server: `PermissionEvaluator.hasProjectPermission(context, ownerTeamId, action)`
- Helper: `canCreateProject(context, ownerTeamId)` - validates specific owner
- Helper: `requireCanCreateProject(evaluator, context, ownerTeamId)` - throws if denied

**Key Operations:**
- **Create Project**: Requires team membership in the specified owner team
- **Edit/Delete Project**: Requires team membership in project's owner team
- **Manage Files**: Requires team membership in project's owner team

### Entity Permission Check

```
hasEntityPermission(entity, action)
├─ Is user platform_admin?
│  └─ YES → ALLOW
├─ Is entity public?
│  ├─ YES → Check if action is 'view_entity'
│  │  └─ YES → ALLOW
│  │  └─ NO → Continue to grant check
│  └─ NO (restricted) → Continue to grant check
├─ Find applicable grants for user
│  ├─ Direct grants on entity (scope: self)
│  └─ Grants on ancestor entities (scope: subtree)
├─ Collect actions from grants
│  └─ For each grant:
│     ├─ User is grant recipient? → Add grant's role actions
│     └─ User in grant's team? → Add grant's role actions
└─ Is requested action in collected actions?
   └─ YES → ALLOW
   └─ NO → DENY
```

**Implementation:**
- Server: `PermissionEvaluator.hasEntityPermission(context, entity, action)`
- Helper: `canCreateTopLevelEntity(context, ownerTeamId)` - validates specific owner
- Helper: `requireEntityAction(evaluator, context, entity, action)` - throws if denied

**Key Operations:**
- **Create Top-Level Entity**: Requires team membership in the specified owner team
- **Create Child Entity**: Requires `create_child` permission on parent
- **View Entity**: Allowed if entity is public OR user has `view_entity` permission
- **Edit Entity**: Requires `edit_entity` permission
- **Delete Entity**: Requires `admin_entity` permission

**Visibility Modes:**
- `public`: Anyone can view (but not edit)
- `restricted`: Only users with explicit grants can view

**Grant Inheritance:**
- Grants with `subtree` scope apply to all descendants
- Child entities inherit visibility from ancestors (walks up tree until visibility found)
- Multiple grants combine (union of permissions)

## Authorization Context

The `AuthorizationContext` contains all data needed for permission evaluation:

```typescript
type AuthorizationContext = {
  userId: string;                           // Current user ID
  globalRoles: Set<GlobalRole>;             // User's global roles
  globalPermissions: Set<GlobalPermission>; // Computed from roles
  teamIds: Set<string>;                     // User's team memberships
  ownerOptions: WorkspaceOwnerOption[];     // Available owner options
  schemas: Map<string, EntitySchema>;       // Entity schemas (for traversal)
  entities: Map<string, Entity>;            // All entities (for traversal)
  grants: EntityGrant[];                    // All entity grants
};
```

**Building Context:**
1. Fetch user's global roles
2. Compute global permissions from roles
3. Fetch user's team memberships in workspace
4. Fetch workspace owner options (teams that can own records)
5. Fetch all schemas (for containment relationships)
6. Fetch all entities (for hierarchy traversal)
7. Fetch all entity grants (for permission checks)

## Server-Side vs Client-Side

### Server-Side (Authoritative)

**Location:** `arch-register-packages/server/src/auth/`

**Components:**
- `ServerPermissionEvaluator`: Extends `PermissionEvaluator` with database queries
- `ServerDataProvider`: Fetches permission data from database
- `authorization.ts`: Helper functions for route protection

**Usage:**
```typescript
// Build context
const context = await evaluator.buildContext(workspaceId, userId, dataProvider);

// Check permissions
if (!evaluator.hasGlobalPermission(context, 'edit_schema')) {
  throw new Error('Forbidden');
}

// Or use helpers
requireEntityAction(evaluator, context, entity, 'edit_entity');
requireCanCreateProject(evaluator, context, ownerTeamId);
```

### Client-Side (UI Enablement)

**Location:** `arch-register-packages/web/src/auth/`

**Components:**
- `WebPermissionEvaluator`: Extends `PermissionEvaluator` with API calls and caching
- `WebDataProvider`: Fetches permission data from API endpoints
- `AuthContext`: React context providing permission checks

**Usage:**
```typescript
// In React components
const { hasGlobalPermission } = useAuth();

// Check virtual permissions with workspace context
const canCreate = hasGlobalPermission('create_project', workspace.id);

// Enable/disable UI elements
<Button disabled={!canCreate}>Create Project</Button>
```

**Important:** Client-side checks are for UI enablement only. Server always validates.

## Common Patterns

### Creating Records with Owners

**Two-Phase Check:**
1. **UI Enablement**: Can user create ANY record? (virtual permission)
2. **Validation**: Can user create THIS record with THIS owner? (specific check)

**Example: Creating a Project**

```typescript
// Client: Enable "Create Project" button
const canCreateAny = hasGlobalPermission('create_project', workspace.id);

// Server: Validate specific owner when creating
requireCanCreateProject(evaluator, context, requestedOwnerTeamId);
```

### Checking Entity Hierarchy

**Pattern:** Walk up containment tree to find inherited properties

```typescript
// Find effective visibility (walks up to first ancestor with visibility set)
const visibility = evaluator.getEffectiveVisibility(context, entity);

// Collect all ancestor IDs (for subtree grant checks)
const ancestors = evaluator.collectAncestorIds(context, entity);
```

### Caching (Client-Side Only)

```typescript
// WebPermissionEvaluator caches contexts for 5 minutes
const evaluator = new WebPermissionEvaluator();

// Clear cache when permissions change
evaluator.clearCache(workspaceId, userId);

// Or clear all
evaluator.clearCache();
```

## Security Considerations

1. **Server is Authoritative**: Client-side checks are for UX only. Always validate on server.
2. **Platform Admin Bypass**: Platform admins bypass all permission checks.
3. **Public Entities**: Public entities are viewable by anyone, but editing still requires grants.
4. **Team Membership**: Team membership is workspace-scoped. Users can be in different teams per workspace.
5. **Grant Inheritance**: Subtree grants are powerful. Be careful when granting `entity_admin` with subtree scope.
6. **Virtual Permissions**: Virtual permissions combine multiple checks. Ensure both client and server implement the same logic.

## Testing Permissions

### Unit Tests

Test individual permission checks with mock contexts:

```typescript
const context: AuthorizationContext = {
  userId: 'user-123',
  globalRoles: new Set(['schema_admin']),
  globalPermissions: new Set(['view_schema', 'edit_schema']),
  teamIds: new Set(['team-1']),
  ownerOptions: [{ id: 'team-1', name: 'Team 1', type: 'team' }],
  schemas: new Map(),
  entities: new Map(),
  grants: []
};

expect(evaluator.hasGlobalPermission(context, 'edit_schema')).toBe(true);
```

### Integration Tests

Test full permission flows with database:

```typescript
// Create user, assign role, check permission
const user = await db.createUser({ email: 'test@example.com' });
await db.assignGlobalRole(user.id, 'schema_admin');
const context = await evaluator.buildContext('workspace-1', user.id, dataProvider);
expect(evaluator.hasGlobalPermission(context, 'edit_schema')).toBe(true);
```

## Migration Guide

### Adding a New Permission

1. Add to `GlobalPermission` type in `types.ts`
2. Add to appropriate role in `GLOBAL_ROLE_PERMISSIONS` in `constants.ts`
3. Update this documentation
4. Add tests

### Adding a New Virtual Permission

1. Add to `GlobalPermission` type with `| 'new_virtual_permission'`
2. Implement logic in `PermissionEvaluator.hasGlobalPermission()`
3. Update client-side `AuthContext.hasGlobalPermission()` if needed
4. Update this documentation
5. Add tests for both client and server

### Changing Permission Logic

1. Update `PermissionEvaluator` base class
2. Ensure both `ServerPermissionEvaluator` and `WebPermissionEvaluator` inherit changes
3. Update tests
4. Update this documentation
