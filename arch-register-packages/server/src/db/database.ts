import type {
  AuditLogEntry,
  Entity,
  EntityGrant,
  EntitySchema,
  GlobalRole,
  GlobalRoleAssignment,
  Project,
  ProjectFile,
  TeamMembership,
  User,
  Workspace,
  WorkspaceLifecycleState,
  WorkspaceOwner,
} from '../types.js';

export type DbDriver = 'postgres' | 'sqlite';

export type NormalizedDbErrorCode = 'unique' | 'foreign' | 'check' | 'notnull' | 'unknown';

export class DatabaseError extends Error {
  constructor(
    readonly code: NormalizedDbErrorCode,
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
  }
}

export type CreateWorkspaceInput = Omit<Workspace, 'created_at' | 'updated_at'> & {
  created_at: Date;
  updated_at: Date;
};

export type UpdateWorkspaceInput = {
  name: string;
  url_slug: string;
  short_code: string;
  description: string;
  updated_at: Date;
};

export type CreateSchemaInput = Omit<EntitySchema, 'created_at' | 'updated_at'> & {
  created_at: Date;
  updated_at: Date;
};

export type UpdateSchemaInput = {
  name: string;
  fields: EntitySchema['fields'];
  color: string | null;
  icon: string | null;
  default_owner: string | null;
  updated_at: Date;
};

export type CreateEntityInput = Omit<Entity, 'created_at' | 'updated_at'> & {
  created_at: Date;
  updated_at: Date;
};

export type UpdateEntityInput = Omit<Entity, 'id' | 'workspace' | 'created_at' | 'updated_at'> & {
  updated_at: Date;
};

export type CreateProjectInput = Omit<Project, 'created_at' | 'updated_at'> & {
  created_at: Date;
  updated_at: Date;
};

export type UpdateProjectInput = {
  name: string;
  description: string;
  status: Project['status'];
  updated_at: Date;
};

export type UpsertProjectFileInput = {
  workspace: string;
  project_id: string;
  path: string;
  name: string;
  size_bytes: number;
  updated_at: Date;
  created_atIfNew: Date;
};

export type CreateAuditLogInput = Omit<AuditLogEntry, 'id'>;

export type CreateUserInput = Omit<User, 'created_at' | 'updated_at' | 'last_login_at'> & {
  created_at: Date;
  updated_at: Date;
  last_login_at: Date | null;
};

export type UpdateUserInput = {
  email?: string | null;
  display_name?: string;
  password_hash?: string | null;
  is_active?: boolean;
  updated_at: Date;
};

export type CreateTeamMembershipInput = TeamMembership;

export type CreateEntityGrantInput = Omit<EntityGrant, 'id'> & {
  id: string;
};

export type DatabaseAdapter = {
  driver: DbDriver;
  close(): Promise<void>;
  reset(): Promise<void>;

  resolveWorkspaceSlug(slug: string): Promise<string | null>;
  listWorkspaces(): Promise<Workspace[]>;
  getWorkspace(id: string): Promise<Workspace | null>;
  createWorkspace(input: CreateWorkspaceInput): Promise<Workspace>;
  updateWorkspace(id: string, input: UpdateWorkspaceInput): Promise<Workspace | null>;
  deleteWorkspace(id: string): Promise<{ workspace: Workspace | null; projectIds: string[] }>;

  listLifecycleStates(workspace: string): Promise<WorkspaceLifecycleState[]>;
  replaceLifecycleStates(workspace: string, states: WorkspaceLifecycleState[]): Promise<WorkspaceLifecycleState[]>;
  listOwners(workspace: string): Promise<WorkspaceOwner[]>;
  replaceOwners(workspace: string, owners: WorkspaceOwner[]): Promise<WorkspaceOwner[]>;
  listTeamMemberships(workspace: string): Promise<TeamMembership[]>;
  replaceTeamMemberships(workspace: string, memberships: TeamMembership[]): Promise<TeamMembership[]>;

  listSchemas(workspace: string): Promise<EntitySchema[]>;
  getSchema(workspace: string, id: string): Promise<EntitySchema | null>;
  createSchema(input: CreateSchemaInput): Promise<EntitySchema>;
  updateSchema(workspace: string, id: string, input: UpdateSchemaInput): Promise<EntitySchema | null>;
  deleteSchema(workspace: string, id: string): Promise<EntitySchema | null>;

  listEntities(workspace: string): Promise<Entity[]>;
  getEntity(workspace: string, id: string): Promise<Entity | null>;
  createEntity(input: CreateEntityInput): Promise<Entity>;
  updateEntity(workspace: string, id: string, input: UpdateEntityInput): Promise<Entity | null>;
  deleteEntity(workspace: string, id: string): Promise<Entity | null>;
  listEntityGrants(workspace: string): Promise<EntityGrant[]>;
  getEntityGrants(workspace: string, entityId: string): Promise<EntityGrant[]>;
  replaceEntityGrants(workspace: string, entityId: string, grants: CreateEntityGrantInput[]): Promise<EntityGrant[]>;

  listProjects(workspace: string): Promise<Project[]>;
  getProject(workspace: string, id: string): Promise<Project | null>;
  createProject(input: CreateProjectInput): Promise<Project>;
  updateProject(workspace: string, id: string, input: UpdateProjectInput): Promise<Project | null>;
  deleteProject(workspace: string, id: string): Promise<Project | null>;

  listProjectFiles(workspace: string, projectId: string): Promise<ProjectFile[]>;
  getProjectFileByPath(workspace: string, projectId: string, path: string): Promise<ProjectFile | null>;
  updateProjectFileSizeById(workspace: string, projectId: string, fileId: string, sizeBytes: number, updated_at: Date): Promise<void>;
  upsertProjectFile(input: UpsertProjectFileInput): Promise<ProjectFile>;
  createProjectFileIfAbsent(input: Omit<UpsertProjectFileInput, 'updated_at'> & { updated_at: Date }): Promise<ProjectFile | null>;
  deleteProjectFileByPath(workspace: string, projectId: string, path: string): Promise<ProjectFile | null>;
  renameProjectFileFolder(workspace: string, projectId: string, oldPath: string, newPath: string, updated_at: Date): Promise<string[]>;
  deleteProjectFileFolder(workspace: string, projectId: string, folderPath: string): Promise<ProjectFile[]>;

  listAuditLogs(workspace: string): Promise<AuditLogEntry[]>;
  createAuditLog(input: CreateAuditLogInput): Promise<AuditLogEntry>;

  getUser(id: string): Promise<User | null>;
  getUserByEmail(email: string): Promise<User | null>;
  getUserByOidc(issuer: string, subject: string): Promise<User | null>;
  createUser(input: CreateUserInput): Promise<User>;
  updateUser(id: string, input: UpdateUserInput): Promise<User | null>;
  updateUserLastLogin(id: string, timestamp: Date): Promise<void>;
  listUsers(): Promise<User[]>;
  listGlobalRoleAssignments(userId?: string): Promise<GlobalRoleAssignment[]>;
  replaceGlobalRoleAssignments(userId: string, roles: GlobalRole[], createdAt: Date): Promise<GlobalRoleAssignment[]>;
};
