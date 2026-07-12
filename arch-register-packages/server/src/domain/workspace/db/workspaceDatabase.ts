import { TeamRole, WorkspaceCapability } from '@arch-register/permissions';
import type { ImportCacheEntry } from '../importCache';
import { databaseBoolean, databaseDate, parseDatabaseJson, type DatabaseRow } from '../../../db/rowMappers';

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

export const workspaceMappers = {
  workspace: (row: DatabaseRow): WorkspaceDbResult => ({
    id: String(row['id']), name: String(row['name']), url_slug: String(row['url_slug']),
    short_code: String(row['short_code']), color: String(row['color'] ?? ''),
    description: String(row['description']), created_at: databaseDate(row['created_at']),
    updated_at: databaseDate(row['updated_at'])
  }),
  lifecycleState: (row: DatabaseRow): LifecycleStateDbResult => ({
    id: String(row['id']), workspace: String(row['workspace']), label: String(row['label']),
    color: String(row['color']), sort_order: Number(row['sort_order']), created_at: databaseDate(row['created_at'])
  }),
  projectEntityType: (row: DatabaseRow): ProjectEntityTypeDbResult => ({
    id: String(row['id']), workspace: String(row['workspace']), label: String(row['label']),
    sort_order: Number(row['sort_order']), created_at: databaseDate(row['created_at'])
  }),
  owner: (row: DatabaseRow): OwnerDbResult => ({
    id: String(row['id']), workspace: String(row['workspace']), name: String(row['name']),
    sort_order: Number(row['sort_order']), color: row['color'] == null ? null : String(row['color']),
    description: String(row['description']), created_at: databaseDate(row['created_at'])
  }),
  member: (row: DatabaseRow): MemberDbResult => ({
    workspace: String(row['workspace']), user_id: String(row['user_id']), role: String(row['role']),
    created_at: databaseDate(row['created_at'])
  }),
  teamMembership: (row: DatabaseRow): TeamMembershipDbResult => ({
    workspace: String(row['workspace']), team_id: String(row['team_id']), user_id: String(row['user_id']),
    role: String(row['role']) as TeamMembershipDbResult['role'], created_at: databaseDate(row['created_at'])
  }),
  roleDefinition: (row: DatabaseRow): RoleDefinitionDbResult => ({
    id: String(row['id']), workspace: String(row['workspace']), name: String(row['name']),
    description: String(row['description']), tone: String(row['tone']), builtin: databaseBoolean(row['builtin']),
    capabilities: parseDatabaseJson<RoleDefinitionDbResult['capabilities']>(row['capabilities'], [], 'workspace_role.capabilities'),
    created_at: databaseDate(row['created_at']), updated_at: databaseDate(row['updated_at'])
  })
};

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

  registerPublicIdPrefix(
    prefix: string,
    ownerType: 'workspace' | 'schema',
    ownerId: string,
    createdAt: Date
  ): Promise<void>;
  updatePublicIdPrefix(
    oldPrefix: string,
    newPrefix: string,
    ownerType: 'workspace' | 'schema',
    ownerId: string,
    updatedAt: Date
  ): Promise<void>;
  deletePublicIdPrefix(prefix: string): Promise<void>;
  allocatePublicId(prefix: string, updatedAt: Date): Promise<number>;
  setPublicIdNextNumber(prefix: string, nextNumber: number, updatedAt: Date): Promise<void>;

  // Import cache operations
  storeImportCache(entry: ImportCacheEntry): Promise<void>;
  getImportCache(importId: string): Promise<ImportCacheEntry | null>;
  deleteImportCache(importId: string): Promise<void>;
  cleanupExpiredImportCache(): Promise<number>;
};
