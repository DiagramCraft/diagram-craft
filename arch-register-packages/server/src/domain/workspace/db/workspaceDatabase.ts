import type {
  TeamMembership,
  WorkspaceMember,
  WorkspaceOwner,
  WorkspaceRoleDefinition
} from '../../../types';

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
