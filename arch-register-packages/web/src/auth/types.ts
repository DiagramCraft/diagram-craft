export type User = {
  id: string;
  email: string | null;
  display_name: string;
  auth_provider: 'local' | 'oidc';
  created_at: string;
  last_login_at: string | null;
};

export type GlobalPermission =
  | 'view_schema'
  | 'edit_schema'
  | 'manage_users'
  | 'manage_teams'
  | 'manage_global_roles'
  | 'view_audit'
  | 'admin_platform';

export type GlobalRole = 'platform_admin' | 'schema_admin' | 'user_admin' | 'auditor';

export type WorkspaceTeamMembership = {
  workspace_id: string;
  team_ids: string[];
};

export type WorkspaceOwnerOption = {
  id: string;
  name: string;
  type: 'team';
};

export type AuthBaseData = {
  global_roles: GlobalRole[];
  global_permissions: GlobalPermission[];
  team_memberships: WorkspaceTeamMembership[];
  owner_options_by_workspace: Record<string, WorkspaceOwnerOption[]>;
};
