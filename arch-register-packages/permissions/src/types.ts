// ── Imports from @arch-register/api-types ─────────────────────

// ── Core Permission Types ─────────────────────────────────────

import { SchemaField } from '@arch-register/api-types/schemaContract';
import { EntityLink, VisibilityMode } from '@arch-register/api-types/entityContract';

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

export type WorkspaceCapability =
  | 'ws.view'
  | 'ws.settings'
  | 'ws.delete'
  | 'ws.audit'
  | 'ws.manage_views'
  | 'people.invite'
  | 'people.role'
  | 'people.remove'
  | 'people.teams'
  | 'proj.create'
  | 'proj.edit'
  | 'proj.delete'
  | 'content.view'
  | 'content.edit'
  | 'ent.edit'
  | 'ent.propose'
  | 'comments'
  | 'export'
  | 'schema.edit'
  | 'schema.publish';

export type EntityRole = 'viewer' | 'editor' | 'contributor' | 'entity_admin';

export type EntityAction = 'view_entity' | 'edit_entity' | 'create_child' | 'admin_entity';

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
  visibility_mode: VisibilityMode | null;
  created_at: Date;
  updated_at: Date;
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
