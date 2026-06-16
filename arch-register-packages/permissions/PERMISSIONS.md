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
| `admin_platform` | Full platform administration access | `global_admin` |
| `create_workspaces` | Create new workspaces | `global_admin`, `workspace_admin` |
| `manage_workspace_roles` | Manage global workspace-role assignments | `global_admin`, `workspace_admin` |

### Virtual Permissions

Virtual permissions are **computed dynamically** and don't exist in the database. They combine multiple checks into a single permission query.

| Permission | Description | Evaluation Logic |
|------------|-------------|------------------|
| `create_project` | Can create a new project | `global_admin`, a workspace role with `proj.create`, or a team role that grants project creation for the requested owner |
| `create_top_level_entity` | Can create a top-level entity | `global_admin`, a workspace role with `ent.edit`, or a team role that grants entity creation for the requested owner |

**Why Virtual Permissions?**
- Consolidate complex permission logic into reusable checks
- Provide consistent evaluation across client and server
- Enable UI enablement checks (can create ANY) vs validation checks (can create THIS with specific owner)

### Entity Permissions

Entity permissions control access to individual entities and are granted through **entity roles**.

| Action | Description | Granted By Role(s) |
|--------|-------------|-------------------|
| `view_entity` | View entity details | `viewer`, `editor`, `contributor`, `entity_admin`, `global_admin` |
| `edit_entity` | Modify entity properties | `editor`, `contributor`, `entity_admin`, `global_admin` |
| `create_child` | Create child entities | `contributor`, `entity_admin`, `global_admin` |
| `admin_entity` | Full entity administration (delete, manage grants) | `entity_admin`, `global_admin` |

**Entity Roles:**
- `viewer`: Read-only access
- `editor`: Can view and edit
- `contributor`: Can view, edit, and create children
- `entity_admin`: Full control over entity and its subtree

**Grant Scope:**
- `self`: Permission applies only to the specific entity
- `subtree`: Permission applies to entity and all descendants

### Project Permissions

Project permissions control access to projects and are granted through **owner-team roles**.

| Action | Description | Required |
|--------|-------------|----------|
| `edit_project` | Modify project properties | Team role with project edit permission in project's owner team |
| `delete_project` | Delete the project | Team role with project delete permission in project's owner team |
| `manage_files` | Upload, modify, delete project files | Team role with file-management permission in project's owner team |

**Note:** Projects are still team-owned, but access is now role-based rather than binary membership.

## Team Roles

Owner teams now grant permissions through **team roles** rather than plain membership.

Each team role contributes:

- **Direct permissions**: apply to entities directly owned by the team
- **Descendant permissions**: propagate to descendant entities in the hierarchy
- **Project permissions**: apply to projects owned by the team

Built-in team roles:

| Role | Direct entity permissions | Descendant entity permissions | Project permissions |
|------|---------------------------|-------------------------------|--------------------|
| `team_admin` | `entity_admin` | `contributor` | `edit_project`, `delete_project`, `manage_files` |
| `team_editor` | `contributor` | `editor` | `edit_project`, `manage_files` |
| `team_reviewer` | `viewer` | `viewer` | none |

## Administration Surfaces

The workspace admin UI separates permission concerns into four settings sections:

| Section | Purpose |
|---------|---------|
| `Lifecycle` | Configure lifecycle states only |
| `Teams` | Manage owner teams and team-role assignments |
| `Members` | Manage workspace-wide membership roles |
| `Global permissions` | Manage platform-wide global roles |

Those sections map to different runtime concepts and should not be conflated:

- lifecycle settings do not grant access
- team roles grant access to owned entities and projects
- workspace member roles grant workspace-wide capabilities
- global roles grant platform-wide capabilities

## Global Roles

| Role | Description | Permissions |
|------|-------------|-------------|
| `global_admin` | Full platform access | All global permissions + all workspace capabilities + all entity actions |
| `workspace_admin` | Global workspace administration | `create_workspaces`, `manage_workspace_roles` |

## Permission Evaluation Flows

### Global Permission Check

```
hasGlobalPermission(permission)
├─ Is user global_admin?
│  └─ YES → ALLOW
├─ Is permission virtual?
│  ├─ create_project or create_top_level_entity?
│  │  ├─ Does user have the matching workspace capability? → YES → ALLOW
│  │  └─ Does user have a team role in any owner team that grants creation?
│  │     └─ YES → ALLOW
│  │     └─ NO → DENY
│  └─ NO → Check user's global permissions set
│     └─ Permission in set? → YES → ALLOW
│                           → NO → DENY
```

**Implementation:**
- Shared: `PermissionChecker.hasGlobalPermission(context, permission)`
- Client: `AuthContext.hasGlobalPermission(permission, workspaceId?)`

### Project Permission Check

```
hasProjectPermission(ownerTeamId, action)
├─ Is user global_admin?
│  └─ YES → ALLOW
├─ Does user have workspace capability `proj.edit`?
│  └─ YES → ALLOW
└─ Does user have a team role on ownerTeamId that grants the requested project action?
   └─ YES → ALLOW
   └─ NO → DENY
```

**Implementation:**
- Shared: `PermissionChecker.hasProjectPermission(context, ownerTeamId, action)`
- Helper: `canCreateProject(context, ownerTeamId)` - validates specific owner
- Helper: `requireCanCreateProject(evaluator, context, ownerTeamId)` - throws if denied

**Key Operations:**
- **Create Project**: Requires a team role in the specified owner team that grants project creation
- **Edit/Delete Project**: Requires a team role in project's owner team that grants the requested action
- **Manage Files**: Requires a team role in project's owner team that grants file management

### Entity Permission Check

```
hasEntityPermission(entity, action)
├─ Is user global_admin?
│  └─ YES → ALLOW
├─ Does user have workspace capability that implies entity access?
│  ├─ `ent.edit` → contributor actions
│  ├─ `ent.propose` → editor actions
│  └─ `ws.view` → view_entity
├─ Is entity public?
│  ├─ YES → Check if action is 'view_entity'
│  │  └─ YES → ALLOW
│  │  └─ NO → Continue to grant check
│  └─ NO (restricted) → Continue to grant check
├─ Apply direct owner-team permissions for entity.owner
├─ Apply descendant owner-team permissions from ancestor-owned entities
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
- Shared: `PermissionChecker.hasEntityPermission(context, entity, action)`
- Helper: `canCreateTopLevelEntity(context, ownerTeamId)` - validates specific owner
- Helper: `requireEntityAction(evaluator, context, entity, action)` - throws if denied

**Key Operations:**
- **Create Top-Level Entity**: Requires a team role in the specified owner team that grants entity creation
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
  teamIds: Set<string>;                     // Convenience set of teams with any assignment
  teamAssignments: TeamAssignment[];        // User's team-role assignments
  teamRolesByTeam: Map<string, Set<TeamRole>>; // Roles grouped by owner team
  teams: WorkspaceTeam[];                   // Available owner teams
  schemas: Map<string, EntitySchema>;       // Entity schemas (for traversal)
  entities: Map<string, Entity>;            // All entities (for traversal)
  grants: EntityGrant[];                    // All entity grants
};
```

**Building Context:**
1. Fetch user's global roles
2. Compute global permissions from roles
3. Fetch user's team-role assignments in workspace
4. Fetch workspace owner teams (teams that can own records)
5. Fetch all schemas (for containment relationships)
6. Fetch all entities (for hierarchy traversal)
7. Fetch all entity grants (for permission checks)

## Server-Side vs Client-Side

### Server-Side (Authoritative)

**Location:** `arch-register-packages/server/src/auth/`

**Components:**
- `PermissionChecker`: Shared pure permission logic
- `CapabilityEvaluator`: Shared computed capability logic
- `ServerDataProvider`: Fetches permission data from database
- `authorization.ts`: Helper functions for route protection

**Usage:**
```typescript
// Build context
const context = buildAuthorizationContext(
  await fetchAuthorizationContextData(dataProvider, workspaceId, userId)
);

// Check permissions
if (!checker.hasGlobalPermission(context, 'admin_platform')) {
  throw new Error('Forbidden');
}

// Or use helpers
requireEntityAction(context, entity, 'edit_entity');
requireCanCreateProject(context, ownerTeamId);
```

### Client-Side (UI Enablement)

**Location:** `arch-register-packages/web/src/auth/`

**Components:**
- `AuthContext`: React context providing permission checks
- `WebDataProvider`: Fetches permission data from API endpoints

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

`PermissionChecker` resolves inherited visibility and ancestor relationships internally when
evaluating `hasEntityPermission(...)`. Callers should use the high-level check rather than
re-implement containment traversal.

### Caching (Client-Side Only)

```typescript
// Web clients should invalidate cached auth state after role/grant changes.
```

## Security Considerations

1. **Server is Authoritative**: Client-side checks are for UX only. Always validate on server.
2. **Global Admin Bypass**: `global_admin` bypasses all permission checks.
3. **Public Entities**: Public entities are viewable by anyone, but editing still requires grants.
4. **Team Assignments**: Team-role assignments are workspace-scoped. Users can hold different team roles in different workspaces.
5. **Grant Inheritance**: Subtree grants are powerful. Be careful when granting `entity_admin` with subtree scope.
6. **Virtual Permissions**: Virtual permissions combine multiple checks. Ensure both client and server implement the same logic.

## Testing Permissions

### Unit Tests

Test individual permission checks with mock contexts:

```typescript
const context: AuthorizationContext = {
  userId: 'user-123',
  globalRoles: new Set(['workspace_admin']),
  globalPermissions: new Set(['create_workspaces', 'manage_workspace_roles']),
  workspaceRole: 'viewer',
  workspaceRoles: new Map(),
  teamIds: new Set(['team-1']),
  teamAssignments: [{ teamId: 'team-1', role: 'team_admin' }],
  teamRolesByTeam: new Map([['team-1', new Set(['team_admin'])]]),
  teams: [{ id: 'team-1', name: 'team-1', type: 'team' }],
  schemas: new Map(),
  entities: new Map(),
  grants: []
};

expect(checker.hasGlobalPermission(context, 'manage_workspace_roles')).toBe(true);
```

### Integration Tests

Test full permission flows with database:

```typescript
// Create user, assign role, check permission
const user = await db.createUser({ email: 'test@example.com' });
await db.assignGlobalRole(user.id, 'workspace_admin');
const context = buildAuthorizationContext(
  await fetchAuthorizationContextData(dataProvider, 'workspace-1', user.id)
);
expect(checker.hasGlobalPermission(context, 'manage_workspace_roles')).toBe(true);
```

## Migration Guide

### Adding a New Permission

1. Add to `GlobalPermission` type in `types.ts`
2. Add to appropriate role in `GLOBAL_ROLE_PERMISSIONS` in `constants.ts`
3. Update this documentation
4. Add tests

### Adding a New Virtual Permission

1. Add to `GlobalPermission` type with `| 'new_virtual_permission'`
2. Implement logic in `PermissionChecker.hasGlobalPermission()` or `CapabilityEvaluator`
3. Update client-side `AuthContext.hasGlobalPermission()` if needed
4. Update this documentation
5. Add tests for both client and server

### Changing Permission Logic

1. Update `PermissionChecker` or `CapabilityEvaluator`
2. Ensure both server and client call sites continue to use the updated logic
3. Update tests
4. Update this documentation
