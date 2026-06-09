import { TeamRole, WorkspaceCapability } from '@arch-register/permissions';

export type WorkspaceRow = {
  id: string;
  name: string;
  url_slug: string;
  short_code: string;
  color: string;
  description: string;
  created_at: Date;
  updated_at: Date;
};

export type CreateWorkspaceInput = WorkspaceRow;

export type UpdateWorkspaceInput = Omit<WorkspaceRow, 'id' | 'created_at'>;

export type WorkspaceLifecycleStateRow = {
  id: string;
  workspace: string;
  label: string;
  color: string;
  sort_order: number;
  created_at: Date;
};

export type CreateWorkspaceLifecycleState = WorkspaceLifecycleStateRow;

export type WorkspaceOwnerRow = {
  id: string;
  workspace: string;
  name: string;
  sort_order: number;
  color: string | null;
  description: string;
  created_at: Date;
};

export type CreateWorkspaceOwner = WorkspaceOwnerRow;

export type WorkspaceMemberRow = {
  workspace: string;
  user_id: string;
  role: string;
  created_at: Date;
};

export type TeamMembershipRow = {
  workspace: string;
  team_id: string;
  user_id: string;
  role: TeamRole;
  created_at: Date;
};

export type CreateTeamMembership = TeamMembershipRow;

export type WorkspaceRoleDefinitionRow = {
  id: string;
  workspace: string;
  name: string;
  description: string;
  tone: string;
  builtin: boolean;
  capabilities: WorkspaceCapability[];
  created_at: Date;
  updated_at: Date;
};

export type CreateWorkspaceRoleDefinition = WorkspaceRoleDefinitionRow;
export type UpdateWorkspaceRoleDefinition = Omit<
  WorkspaceRoleDefinitionRow,
  'id' | 'workspace' | 'created_at'
>;

export type WorkspaceDatabase = {
  listWorkspaces(): Promise<WorkspaceRow[]>;
  getWorkspace(id: string): Promise<WorkspaceRow | null>;
  createWorkspace(input: CreateWorkspaceInput): Promise<WorkspaceRow>;
  updateWorkspace(id: string, input: UpdateWorkspaceInput): Promise<WorkspaceRow | null>;
  deleteWorkspace(id: string): Promise<{ workspace: WorkspaceRow | null; projectIds: string[] }>;

  listLifecycleStates(ws: string): Promise<WorkspaceLifecycleStateRow[]>;
  replaceLifecycleStates(
    ws: string,
    states: CreateWorkspaceLifecycleState[]
  ): Promise<WorkspaceLifecycleStateRow[]>;

  listTeams(ws: string): Promise<WorkspaceOwnerRow[]>;
  replaceTeams(ws: string, teams: CreateWorkspaceOwner[]): Promise<WorkspaceOwnerRow[]>;

  listTeamAssignments(ws: string): Promise<TeamMembershipRow[]>;
  replaceTeamAssignments(
    ws: string,
    assignments: CreateTeamMembership[]
  ): Promise<TeamMembershipRow[]>;

  listWorkspaceMembers(ws: string): Promise<WorkspaceMemberRow[]>;
  getWorkspaceMember(ws: string, userId: string): Promise<WorkspaceMemberRow | null>;
  setWorkspaceMemberRole(
    ws: string,
    userId: string,
    role: string,
    createdAt: Date
  ): Promise<WorkspaceMemberRow>;
  removeWorkspaceMember(ws: string, userId: string): Promise<WorkspaceMemberRow | null>;

  getWorkspaceRole(ws: string, userId: string): Promise<string | null>;
  listCustomWorkspaceRoles(ws: string): Promise<WorkspaceRoleDefinitionRow[]>;
  getCustomWorkspaceRole(ws: string, roleId: string): Promise<WorkspaceRoleDefinitionRow | null>;
  createCustomWorkspaceRole(
    input: CreateWorkspaceRoleDefinition
  ): Promise<WorkspaceRoleDefinitionRow>;
  updateCustomWorkspaceRole(
    ws: string,
    roleId: string,
    input: UpdateWorkspaceRoleDefinition
  ): Promise<WorkspaceRoleDefinitionRow | null>;
  deleteCustomWorkspaceRole(ws: string, roleId: string): Promise<WorkspaceRoleDefinitionRow | null>;
  countWorkspaceMembersByRole(ws: string, roleId: string): Promise<number>;
};
