import { TeamRole, WorkspaceCapability } from '@arch-register/permissions';

export type WorkspaceDbResult = {
  id: string;
  name: string;
  url_slug: string;
  short_code: string;
  color: string;
  description: string;
  created_at: Date;
  updated_at: Date;
};

export type WorkspaceDbCreate = WorkspaceDbResult;

export type WorkspaceDbUpdate = Omit<WorkspaceDbResult, 'id' | 'created_at'>;

export type LifecycleStateDbResult = {
  id: string;
  workspace: string;
  label: string;
  color: string;
  sort_order: number;
  created_at: Date;
};

export type LifecycleStateDbCreate = LifecycleStateDbResult;

export type ProjectEntityTypeDbResult = {
  id: string;
  workspace: string;
  label: string;
  sort_order: number;
  created_at: Date;
};

export type ProjectEntityTypeDbCreate = ProjectEntityTypeDbResult;

export type OwnerDbResult = {
  id: string;
  workspace: string;
  name: string;
  sort_order: number;
  color: string | null;
  description: string;
  created_at: Date;
};

export type OwnerDbCreate = OwnerDbResult;

export type MemberDbResult = {
  workspace: string;
  user_id: string;
  role: string;
  created_at: Date;
};

export type TeamMembershipDbResult = {
  workspace: string;
  team_id: string;
  user_id: string;
  role: TeamRole;
  created_at: Date;
};

export type TeamMembershipDbCreate = TeamMembershipDbResult;

export type RoleDefinitionDbResult = {
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

export type RoleDefinitionDbCreate = RoleDefinitionDbResult;
export type RoleDefinitionDbUpdate = Omit<
  RoleDefinitionDbResult,
  'id' | 'workspace' | 'created_at'
>;

export type WorkspaceDatabase = {
  listWorkspaces(): Promise<WorkspaceDbResult[]>;
  getWorkspace(id: string): Promise<WorkspaceDbResult | null>;
  createWorkspace(input: WorkspaceDbCreate): Promise<WorkspaceDbResult>;
  updateWorkspace(id: string, input: WorkspaceDbUpdate): Promise<WorkspaceDbResult | null>;
  deleteWorkspace(
    id: string
  ): Promise<{ workspace: WorkspaceDbResult | null; projectIds: string[] }>;

  listLifecycleStates(ws: string): Promise<LifecycleStateDbResult[]>;
  replaceLifecycleStates(
    ws: string,
    states: LifecycleStateDbCreate[]
  ): Promise<LifecycleStateDbResult[]>;

  listProjectEntityTypes(ws: string): Promise<ProjectEntityTypeDbResult[]>;
  replaceProjectEntityTypes(
    ws: string,
    types: ProjectEntityTypeDbCreate[]
  ): Promise<ProjectEntityTypeDbResult[]>;

  listTeams(ws: string): Promise<OwnerDbResult[]>;
  replaceTeams(ws: string, teams: OwnerDbCreate[]): Promise<OwnerDbResult[]>;

  listTeamAssignments(ws: string): Promise<TeamMembershipDbResult[]>;
  replaceTeamAssignments(
    ws: string,
    assignments: TeamMembershipDbCreate[]
  ): Promise<TeamMembershipDbResult[]>;

  listWorkspaceMembers(ws: string): Promise<MemberDbResult[]>;
  getWorkspaceMember(ws: string, userId: string): Promise<MemberDbResult | null>;
  setWorkspaceMemberRole(
    ws: string,
    userId: string,
    role: string,
    createdAt: Date
  ): Promise<MemberDbResult>;
  removeWorkspaceMember(ws: string, userId: string): Promise<MemberDbResult | null>;

  getWorkspaceRole(ws: string, userId: string): Promise<string | null>;
  listCustomWorkspaceRoles(ws: string): Promise<RoleDefinitionDbResult[]>;
  getCustomWorkspaceRole(ws: string, roleId: string): Promise<RoleDefinitionDbResult | null>;
  createCustomWorkspaceRole(input: RoleDefinitionDbCreate): Promise<RoleDefinitionDbResult>;
  updateCustomWorkspaceRole(
    ws: string,
    roleId: string,
    input: RoleDefinitionDbUpdate
  ): Promise<RoleDefinitionDbResult | null>;
  deleteCustomWorkspaceRole(ws: string, roleId: string): Promise<RoleDefinitionDbResult | null>;
  countWorkspaceMembersByRole(ws: string, roleId: string): Promise<number>;
};
