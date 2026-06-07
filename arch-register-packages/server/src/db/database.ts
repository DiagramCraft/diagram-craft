import type {
  AiConversation,
  AiMessage,
  AuditLogEntry,
  Entity,
  EntityGrant,
  EntitySchema,
  GlobalRole,
  GlobalRoleAssignment,
  Project,
  ProjectFile,
  SavedView,
  TeamMembership,
  User,
  Workspace,
  WorkspaceAiConfig,
  WorkspaceEnum,
  WorkspaceLifecycleState,
  WorkspaceMember,
  WorkspaceOwner,
  WorkspaceRoleDefinition
} from '../types';

export type DbDriver = 'postgres' | 'sqlite';

export type NormalizedDbErrorCode = 'unique' | 'foreign' | 'check' | 'notnull' | 'unknown';

export class DatabaseError extends Error {
  constructor(
    readonly code: NormalizedDbErrorCode,
    message: string,
    readonly cause?: unknown
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
  color: string;
  description: string;
  updated_at: Date;
};

export type CreateSchemaInput = Omit<EntitySchema, 'created_at' | 'updated_at'> & {
  created_at: Date;
  updated_at: Date;
};

export type UpdateSchemaInput = {
  name: string;
  description: string;
  fields: EntitySchema['fields'];
  color: string | null;
  icon: string | null;
  default_owner: string | null;
  updated_at: Date;
};

export type CreateEnumInput = Omit<WorkspaceEnum, 'created_at' | 'updated_at'> & {
  created_at: Date;
  updated_at: Date;
};

export type UpdateEnumInput = {
  name: string;
  options: Array<{ value: string; label: string }>;
  sort_order: number;
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
  owner: string | null;
  status: Project['status'];
  color: string | null;
  updated_at: Date;
};

export type UpsertProjectFileInput = {
  workspace: string;
  project_id: string;
  path: string;
  name: string;
  size_bytes: number;
  comment_count: number;
  unresolved_comment_count: number;
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
  color?: string | null;
  updated_at: Date;
};

export type CreateEntityGrantInput = Omit<EntityGrant, 'id'> & {
  id: string;
};

export type CreateSavedViewInput = Omit<SavedView, 'created_at' | 'updated_at'> & {
  created_at: Date;
  updated_at: Date;
};

export type UpdateSavedViewInput = Partial<
  Omit<SavedView, 'id' | 'workspace' | 'created_at' | 'updated_at'>
> & {
  updated_at: Date;
};

export type CoreDatabase = {
  driver: DbDriver;
  close(): Promise<void>;
  reset(): Promise<void>;
};

export type WorkspaceAdminDatabase = {
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

export type CatalogDatabase = {
  resolveWorkspaceSlug(slug: string): Promise<string | null>;

  listSchemas(ws: string): Promise<EntitySchema[]>;
  getSchema(ws: string, id: string): Promise<EntitySchema | null>;
  createSchema(input: CreateSchemaInput): Promise<EntitySchema>;
  updateSchema(ws: string, id: string, input: UpdateSchemaInput): Promise<EntitySchema | null>;
  deleteSchema(ws: string, id: string): Promise<EntitySchema | null>;

  listEnums(ws: string): Promise<WorkspaceEnum[]>;
  getEnum(ws: string, id: string): Promise<WorkspaceEnum | null>;
  createEnum(input: CreateEnumInput): Promise<WorkspaceEnum>;
  updateEnum(ws: string, id: string, input: UpdateEnumInput): Promise<WorkspaceEnum | null>;
  deleteEnum(ws: string, id: string): Promise<WorkspaceEnum | null>;

  listEntities(ws: string): Promise<Entity[]>;
  getEntity(ws: string, id: string): Promise<Entity | null>;
  createEntity(input: CreateEntityInput): Promise<Entity>;
  updateEntity(ws: string, id: string, input: UpdateEntityInput): Promise<Entity | null>;
  deleteEntity(ws: string, id: string): Promise<Entity | null>;
  listEntityGrants(ws: string): Promise<EntityGrant[]>;
  getEntityGrants(ws: string, entityId: string): Promise<EntityGrant[]>;
  replaceEntityGrants(
    ws: string,
    entityId: string,
    grants: CreateEntityGrantInput[]
  ): Promise<EntityGrant[]>;
};

export type ViewDatabase = {
  listSavedViews(ws: string): Promise<SavedView[]>;
  getSavedView(ws: string, id: string): Promise<SavedView | null>;
  createSavedView(input: CreateSavedViewInput): Promise<SavedView>;
  updateSavedView(ws: string, id: string, input: UpdateSavedViewInput): Promise<SavedView | null>;
  deleteSavedView(ws: string, id: string): Promise<SavedView | null>;
};

export type ProjectsFilesDatabase = {
  listProjects(ws: string): Promise<Project[]>;
  getProject(ws: string, id: string): Promise<Project | null>;
  createProject(input: CreateProjectInput): Promise<Project>;
  updateProject(ws: string, id: string, input: UpdateProjectInput): Promise<Project | null>;
  deleteProject(ws: string, id: string): Promise<Project | null>;

  listProjectFiles(ws: string, projectId: string): Promise<ProjectFile[]>;
  getProjectFileByPath(ws: string, projectId: string, path: string): Promise<ProjectFile | null>;
  updateProjectFileSizeById(
    ws: string,
    projectId: string,
    fileId: string,
    sizeBytes: number,
    updated_at: Date
  ): Promise<void>;
  updateProjectFilePreview(
    ws: string,
    projectId: string,
    fileId: string,
    previewSvg: string | null
  ): Promise<void>;
  updateProjectFileDerivedData(
    ws: string,
    projectId: string,
    fileId: string,
    sizeBytes: number,
    commentCount: number,
    unresolvedCommentCount: number,
    previewSvg: string | null,
    updated_at: Date
  ): Promise<void>;
  updateProjectFileTemplateStatus(
    ws: string,
    projectId: string,
    fileId: string,
    isTemplate: boolean,
    isWorkspaceTemplate: boolean,
    updated_at: Date
  ): Promise<void>;
  upsertProjectFile(input: UpsertProjectFileInput): Promise<ProjectFile>;
  createProjectFileIfAbsent(
    input: Omit<UpsertProjectFileInput, 'updated_at'> & { updated_at: Date }
  ): Promise<ProjectFile | null>;
  deleteProjectFileByPath(ws: string, projectId: string, path: string): Promise<ProjectFile | null>;
  renameProjectFileFolder(
    ws: string,
    projectId: string,
    oldPath: string,
    newPath: string,
    updated_at: Date
  ): Promise<string[]>;
  deleteProjectFileFolder(
    ws: string,
    projectId: string,
    folderPath: string
  ): Promise<ProjectFile[]>;
};

export type AuditDatabase = {
  listAuditLogs(ws: string): Promise<AuditLogEntry[]>;
  createAuditLog(input: CreateAuditLogInput): Promise<AuditLogEntry>;
};

export type IdentityAuthDatabase = {
  getUser(id: string): Promise<User | null>;
  getUserByEmail(email: string): Promise<User | null>;
  getUserByOidc(issuer: string, subject: string): Promise<User | null>;
  createUser(input: CreateUserInput): Promise<User>;
  updateUser(id: string, input: UpdateUserInput): Promise<User | null>;
  updateUserLastLogin(id: string, timestamp: Date): Promise<void>;
  listUsers(): Promise<User[]>;
  listGlobalRoleAssignments(userId?: string): Promise<GlobalRoleAssignment[]>;
  replaceGlobalRoleAssignments(
    userId: string,
    roles: GlobalRole[],
    createdAt: Date
  ): Promise<GlobalRoleAssignment[]>;

  storeOidcAuthState(
    state: string,
    nonce: string,
    codeVerifier: string,
    expiresAt: Date
  ): Promise<void>;
  getOidcAuthState(state: string): Promise<{ nonce: string; code_verifier: string } | null>;
  deleteOidcAuthState(state: string): Promise<void>;
  cleanupExpiredOidcAuthStates(): Promise<void>;
};

export type UpsertAiConfigInput = {
  provider?: string;
  api_key_enc?: string | null;
  base_url?: string | null;
  model?: string | null;
  temperature?: number | null;
  system_prompt?: string | null;
  enabled?: boolean;
};

export type CreateConversationInput = {
  id: string;
  workspace: string;
  user_id: string;
  title: string;
  created_at: Date;
  updated_at: Date;
};

export type CreateMessageInput = {
  id: string;
  conversation_id: string;
  role: 'system' | 'user' | 'assistant';
  content: string;
  metadata: Record<string, unknown>;
  created_at: Date;
};

export type AiDatabase = {
  getAiConfig(ws: string): Promise<WorkspaceAiConfig | null>;
  upsertAiConfig(ws: string, input: UpsertAiConfigInput): Promise<WorkspaceAiConfig>;

  listConversations(ws: string, userId: string): Promise<AiConversation[]>;
  getConversation(ws: string, id: string): Promise<AiConversation | null>;
  createConversation(input: CreateConversationInput): Promise<AiConversation>;
  updateConversationTitle(ws: string, id: string, title: string): Promise<AiConversation | null>;
  initConversationTitle(ws: string, id: string, title: string): Promise<void>;
  deleteConversation(ws: string, id: string): Promise<AiConversation | null>;

  listMessages(conversationId: string): Promise<AiMessage[]>;
  createMessage(input: CreateMessageInput): Promise<AiMessage>;
};

export type DatabaseAdapter = {
  core: CoreDatabase;
  workspaceAdmin: WorkspaceAdminDatabase;
  catalog: CatalogDatabase;
  view: ViewDatabase;
  projectsFiles: ProjectsFilesDatabase;
  audit: AuditDatabase;
  identityAuth: IdentityAuthDatabase;
  ai: AiDatabase;
};
