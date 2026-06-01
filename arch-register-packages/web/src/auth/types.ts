import type {
  GlobalRole,
  GlobalPermission,
  TeamRole,
  WorkspaceRole,
  WorkspaceRoleDefinition
} from '@arch-register/permissions';

export type User = {
  id: string;
  email: string | null;
  display_name: string;
  auth_provider: 'local' | 'oidc';
  created_at: string;
  last_login_at: string | null;
  color: string | null;
};

export type { GlobalPermission, GlobalRole, WorkspaceRole, WorkspaceRoleDefinition };

export type WorkspaceTeam = {
  id: string;
  name: string;
  type: 'team';
};

export type AuthBaseData = {
  global_roles: GlobalRole[];
  global_permissions: GlobalPermission[];
  team_assignments_by_workspace?: Record<
    string,
    Array<{
      team_id: string;
      role: TeamRole;
    }>
  >;
  workspace_roles: Record<string, WorkspaceRole>;
  workspace_role_definitions_by_workspace?: Record<string, WorkspaceRoleDefinition[]>;
  teams_by_workspace?: Record<string, WorkspaceTeam[]>;
};
