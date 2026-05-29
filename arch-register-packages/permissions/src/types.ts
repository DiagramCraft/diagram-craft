// ── Core Permission Types ─────────────────────────────────────

export type GlobalRole = 'global_admin' | 'workspace_admin';

export type GlobalPermission =
  | 'admin_platform'
  | 'create_workspaces'
  | 'manage_workspace_roles';

export type WorkspaceRole = 'owner' | 'admin' | 'editor' | 'reviewer' | 'viewer';

export type TeamRole = 'team_admin' | 'team_editor' | 'team_reviewer';

export type WorkspaceCapability =
  | 'ws.view'
  | 'ws.settings'
  | 'ws.delete'
  | 'ws.audit'
  | 'people.invite'
  | 'people.role'
  | 'people.remove'
  | 'people.teams'
  | 'proj.create'
  | 'proj.edit'
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

export type VisibilityMode = 'public' | 'restricted';

// ── Capability Types ──────────────────────────────────────────

export type EntityCapabilities = {
  canView: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canAdmin: boolean;
  canCreateChild: boolean;
};

export type ProjectCapabilities = {
  canEdit: boolean;
  canDelete: boolean;
  canManageFiles: boolean;
};

// ── Entity & Schema Types ─────────────────────────────────────

export type EntityLink = {
  url: string;
  title: string;
  type?: string;
};

export type TextField = {
  id: string;
  name: string;
  type: 'text' | 'longtext';
};

export type BooleanField = {
  id: string;
  name: string;
  type: 'boolean';
};

export type SelectField = {
  id: string;
  name: string;
  type: 'select';
  options: Array<{ value: string; label: string }>;
};

export type ReferenceField = {
  id: string;
  name: string;
  type: 'reference';
  schemaId: string;
  minCount: number;
  maxCount: number;
};

export type ContainmentField = {
  id: string;
  name: string;
  type: 'containment';
  schemaId: string;
  minCount: number;
  maxCount: number;
};

export type SchemaField =
  | TextField
  | BooleanField
  | SelectField
  | ReferenceField
  | ContainmentField;

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

export type AuthorizationContext = {
  userId: string;
  globalRoles: Set<GlobalRole>;
  globalPermissions: Set<GlobalPermission>;
  workspaceRole: WorkspaceRole | null;
  teamIds: Set<string>;
  teamAssignments: TeamAssignment[];
  teamRolesByTeam: Map<string, Set<TeamRole>>;
  teams: WorkspaceTeam[];
  schemas: Map<string, EntitySchema>;
  entities: Map<string, Entity>;
  grants: EntityGrant[];
};
