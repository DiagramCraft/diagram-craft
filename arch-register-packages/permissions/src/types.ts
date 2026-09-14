// ── Imports from @arch-register/api-types ─────────────────────

// ── Core Permission Types ─────────────────────────────────────

import { SchemaField } from '@arch-register/api-types/schemaContract';
import { EntityLink } from '@arch-register/api-types/entityContract';
import type { WorkspaceCapability as ApiWorkspaceCapability } from '@arch-register/api-types/common';

export type GlobalRole = 'global_admin' | 'workspace_admin';

export type GlobalPermission = 'admin_platform' | 'create_workspaces' | 'manage_workspace_roles';

export type BuiltinWorkspaceRole = 'owner' | 'admin' | 'editor' | 'reviewer' | 'viewer';

export type WorkspaceRole = string;

export type WorkspaceRoleDefinition = {
  id: WorkspaceRole;
  name: string;
  description: string;
  tone: string;
  builtin: boolean;
  capabilities: WorkspaceCapability[];
};

export type TeamRole = 'team_admin' | 'team_editor' | 'team_reviewer';

export type WorkspaceCapability = ApiWorkspaceCapability;

export type ApplicationAccessMode = 'all_members' | 'selected';

export type ApplicationAccessPolicy = {
  mode: ApplicationAccessMode;
  userIds: readonly string[];
  teamIds: readonly string[];
};

export type EntityRole = 'editor' | 'contributor' | 'entity_admin';

export type CatalogRecordAction = 'view' | 'edit' | 'admin';

export type EntityAction = `${CatalogRecordAction}_entity` | 'create_child';

export type RelationAction = `${CatalogRecordAction}_relation`;

export type ProjectAction = 'edit_project' | 'delete_project' | 'manage_files';

export type EntityGrantScope = 'self' | 'subtree';

// Note: VisibilityMode is imported from @arch-register/api-types

// ── Entity & Schema Types ─────────────────────────────────────
// Note: EntityLink, SchemaField, and VisibilityMode are imported from @arch-register/api-types

// Internal EntitySchema type with Date objects (for database layer)
export type EntitySchema = {
  id: string;
  workspace: string;
  name: string;
  fields: SchemaField[];
  color: string | null;
  icon: string | null;
  default_owner: string | null;
  created_at: Date;
  updated_at: Date;
};

// Internal Entity type with Date objects (for database layer)
export type Entity = {
  id: string;
  workspace: string;
  slug: string;
  namespace: string;
  name: string;
  description: string;
  owner: string | null;
  lifecycle: string | null;
  tags: string[];
  links: EntityLink[];
  schema_id: string;
  data: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
};

// Minimal relation projection needed by PermissionChecker's direct-owner-only relation
// permission logic — relations have no containment hierarchy or schema/data fields to walk.
export type Relation = {
  id: string;
  workspace: string;
  owner: string | null;
  lifecycle: string | null;
};

// ── Owner Types ───────────────────────────────────────────────

export type WorkspaceTeam = {
  id: string;
  name: string;
  type: 'team';
};

export type TeamAssignment = {
  teamId: string;
  role: TeamRole;
};

// ── Grant Types ───────────────────────────────────────────────

export type EntityGrant = {
  id: string;
  workspace: string;
  entity_id: string;
  principal_type: 'user' | 'team';
  principal_id: string;
  role: EntityRole;
  applies_to: EntityGrantScope;
  created_at: Date;
};

// ── Workspace Member ─────────────────────────────────────────

export type WorkspaceMember = {
  workspace: string;
  user_id: string;
  role: WorkspaceRole;
  created_at: Date;
};

// ── Authorization Context ─────────────────────────────────────

export type WorkspaceAuthorizationContext = {
  userId: string;
  globalRoles: Set<GlobalRole>;
  globalPermissions: Set<GlobalPermission>;
  workspaceRole: WorkspaceRole | null;
  workspaceRoles: Map<string, WorkspaceRoleDefinition>;
  teamIds: Set<string>;
  teamAssignments: TeamAssignment[];
  teamRolesByTeam: Map<string, Set<TeamRole>>;
  teams: WorkspaceTeam[];
  workspaceCapabilityCeiling?: Set<WorkspaceCapability>;
};

export type AuthorizationContext = WorkspaceAuthorizationContext & {
  schemas: Map<string, EntitySchema>;
  entities: Map<string, Entity>;
  grants: EntityGrant[];
};
