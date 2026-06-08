import type {
  TeamMembership,
  Workspace,
  WorkspaceLifecycleState,
  WorkspaceMember,
  WorkspaceOwner,
  WorkspaceRoleDefinition
} from '../../../types';

export type CreateWorkspaceInput = Omit<Workspace, 'created_at' | 'updated_at'> & {
  created_at: Date;
  updated_at: Date;
};

export type UpdateWorkspaceInput = {
  name: string;
  url_slug: string;
  short_code: string;
  color: string;
  description: string;
  updated_at: Date;
};

export type WorkspaceDatabase = {
  listWorkspaces(): Promise<Workspace[]>;
  getWorkspace(id: string): Promise<Workspace | null>;
  createWorkspace(input: CreateWorkspaceInput): Promise<Workspace>;
  updateWorkspace(id: string, input: UpdateWorkspaceInput): Promise<Workspace | null>;
  deleteWorkspace(id: string): Promise<{ workspace: Workspace | null; projectIds: string[] }>;

  listLifecycleStates(ws: string): Promise<WorkspaceLifecycleState[]>;
  replaceLifecycleStates(
    ws: string,
    states: WorkspaceLifecycleState[]
  ): Promise<WorkspaceLifecycleState[]>;
  listTeams(ws: string): Promise<WorkspaceOwner[]>;
  replaceTeams(ws: string, teams: WorkspaceOwner[]): Promise<WorkspaceOwner[]>;
  listTeamAssignments(ws: string): Promise<TeamMembership[]>;
  replaceTeamAssignments(ws: string, assignments: TeamMembership[]): Promise<TeamMembership[]>;

  listWorkspaceMembers(ws: string): Promise<WorkspaceMember[]>;
  getWorkspaceMember(ws: string, userId: string): Promise<WorkspaceMember | null>;
  setWorkspaceMemberRole(
    ws: string,
    userId: string,
    role: string,
    createdAt: Date
  ): Promise<WorkspaceMember>;
  removeWorkspaceMember(ws: string, userId: string): Promise<WorkspaceMember | null>;
  getWorkspaceRole(ws: string, userId: string): Promise<string | null>;
  listCustomWorkspaceRoles(ws: string): Promise<WorkspaceRoleDefinition[]>;
  getCustomWorkspaceRole(ws: string, roleId: string): Promise<WorkspaceRoleDefinition | null>;
  createCustomWorkspaceRole(input: WorkspaceRoleDefinition): Promise<WorkspaceRoleDefinition>;
  updateCustomWorkspaceRole(
    ws: string,
    roleId: string,
    input: Omit<WorkspaceRoleDefinition, 'id' | 'workspace' | 'created_at'>
  ): Promise<WorkspaceRoleDefinition | null>;
  deleteCustomWorkspaceRole(ws: string, roleId: string): Promise<WorkspaceRoleDefinition | null>;
  countWorkspaceMembersByRole(ws: string, roleId: string): Promise<number>;
};
