import type { GlobalRole, GlobalPermission, WorkspaceRole } from '@arch-register/permissions';

export type User = {
  id: string;
  email: string | null;
  display_name: string;
  auth_provider: 'local' | 'oidc';
  created_at: string;
  last_login_at: string | null;
};

export type { GlobalPermission, GlobalRole, WorkspaceRole };

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
  workspace_roles: Record<string, WorkspaceRole>;
  owner_options_by_workspace: Record<string, WorkspaceOwnerOption[]>;
};
