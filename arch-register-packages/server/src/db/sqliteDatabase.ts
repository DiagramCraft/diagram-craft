import { mkdir, readFile, rm } from 'node:fs/promises';
import { dirname } from 'node:path';
import Database, { type Database as DatabaseType } from 'better-sqlite3';
import type {
  CreateAuditLogInput,
  CreateEntityGrantInput,
  CreateEntityInput,
  CreateProjectInput,
  CreateSchemaInput,
  CreateUserInput,
  DatabaseAdapter,
  UpdateEntityInput,
  UpdateProjectInput,
  UpdateSchemaInput,
  UpdateUserInput,
  UpdateWorkspaceInput,
  UpsertProjectFileInput
} from './database.js';
import { SqliteAuditDatabase } from './sqliteAudit.js';
import { SqliteCatalogDatabase } from './sqliteCatalog.js';
import { SqliteIdentityAuthDatabase } from './sqliteIdentityAuth.js';
import { SqliteProjectsFilesDatabase } from './sqliteProjectsFiles.js';
import { SqliteWorkspaceAdminDatabase } from './sqliteWorkspaceAdmin.js';
import type { GlobalRole, TeamMembership, WorkspaceLifecycleState, WorkspaceOwner } from '../types.js';

export class SqliteDatabase implements DatabaseAdapter {
  readonly driver = 'sqlite' as const;
  private db: DatabaseType;
  private readonly filePath: string;

  private workspaceAdmin: SqliteWorkspaceAdminDatabase;
  private catalog: SqliteCatalogDatabase;
  private projectsFiles: SqliteProjectsFilesDatabase;
  private audit: SqliteAuditDatabase;
  private identityAuth: SqliteIdentityAuthDatabase;

  constructor(filePath: string) {
    this.filePath = filePath;
    this.db = new Database(filePath);
    this.configure();
    this.workspaceAdmin = new SqliteWorkspaceAdminDatabase(this.db);
    this.catalog = new SqliteCatalogDatabase(this.db);
    this.projectsFiles = new SqliteProjectsFilesDatabase(this.db);
    this.audit = new SqliteAuditDatabase(this.db);
    this.identityAuth = new SqliteIdentityAuthDatabase(this.db);
  }

  private configure() {
    this.db.pragma('foreign_keys = ON');
    this.db.pragma('journal_mode = WAL');
  }

  private rebuildModules() {
    this.workspaceAdmin = new SqliteWorkspaceAdminDatabase(this.db);
    this.catalog = new SqliteCatalogDatabase(this.db);
    this.projectsFiles = new SqliteProjectsFilesDatabase(this.db);
    this.audit = new SqliteAuditDatabase(this.db);
    this.identityAuth = new SqliteIdentityAuthDatabase(this.db);
  }

  async close() {
    this.db.close();
  }

  async reset() {
    this.db.close();
    await rm(this.filePath, { force: true });
    await mkdir(dirname(this.filePath), { recursive: true });
    this.db = new Database(this.filePath);
    this.configure();
    this.rebuildModules();
    const schemaSql = await readFile(new URL('./schema.sqlite.sql', import.meta.url), 'utf8');
    this.db.exec(schemaSql);
  }

  resolveWorkspaceSlug(slug: string) {
    return this.catalog.resolveWorkspaceSlug(slug);
  }

  listWorkspaces() {
    return this.workspaceAdmin.listWorkspaces();
  }

  getWorkspace(id: string) {
    return this.workspaceAdmin.getWorkspace(id);
  }

  createWorkspace(input: Parameters<SqliteWorkspaceAdminDatabase['createWorkspace']>[0]) {
    return this.workspaceAdmin.createWorkspace(input);
  }

  updateWorkspace(id: string, input: UpdateWorkspaceInput) {
    return this.workspaceAdmin.updateWorkspace(id, input);
  }

  deleteWorkspace(id: string) {
    return this.workspaceAdmin.deleteWorkspace(id);
  }

  listLifecycleStates(workspace: string) {
    return this.workspaceAdmin.listLifecycleStates(workspace);
  }

  replaceLifecycleStates(workspace: string, states: WorkspaceLifecycleState[]) {
    return this.workspaceAdmin.replaceLifecycleStates(workspace, states);
  }

  listOwners(workspace: string) {
    return this.workspaceAdmin.listOwners(workspace);
  }

  replaceOwners(workspace: string, owners: WorkspaceOwner[]) {
    return this.workspaceAdmin.replaceOwners(workspace, owners);
  }

  listTeamMemberships(workspace: string) {
    return this.workspaceAdmin.listTeamMemberships(workspace);
  }

  replaceTeamMemberships(workspace: string, memberships: TeamMembership[]) {
    return this.workspaceAdmin.replaceTeamMemberships(workspace, memberships);
  }

  listSchemas(workspace: string) {
    return this.catalog.listSchemas(workspace);
  }

  getSchema(workspace: string, id: string) {
    return this.catalog.getSchema(workspace, id);
  }

  createSchema(input: CreateSchemaInput) {
    return this.catalog.createSchema(input);
  }

  updateSchema(workspace: string, id: string, input: UpdateSchemaInput) {
    return this.catalog.updateSchema(workspace, id, input);
  }

  deleteSchema(workspace: string, id: string) {
    return this.catalog.deleteSchema(workspace, id);
  }

  listEntities(workspace: string) {
    return this.catalog.listEntities(workspace);
  }

  getEntity(workspace: string, id: string) {
    return this.catalog.getEntity(workspace, id);
  }

  createEntity(input: CreateEntityInput) {
    return this.catalog.createEntity(input);
  }

  updateEntity(workspace: string, id: string, input: UpdateEntityInput) {
    return this.catalog.updateEntity(workspace, id, input);
  }

  deleteEntity(workspace: string, id: string) {
    return this.catalog.deleteEntity(workspace, id);
  }

  listEntityGrants(workspace: string) {
    return this.catalog.listEntityGrants(workspace);
  }

  getEntityGrants(workspace: string, entityId: string) {
    return this.catalog.getEntityGrants(workspace, entityId);
  }

  replaceEntityGrants(workspace: string, entityId: string, grants: CreateEntityGrantInput[]) {
    return this.catalog.replaceEntityGrants(workspace, entityId, grants);
  }

  listProjects(workspace: string) {
    return this.projectsFiles.listProjects(workspace);
  }

  getProject(workspace: string, id: string) {
    return this.projectsFiles.getProject(workspace, id);
  }

  createProject(input: CreateProjectInput) {
    return this.projectsFiles.createProject(input);
  }

  updateProject(workspace: string, id: string, input: UpdateProjectInput) {
    return this.projectsFiles.updateProject(workspace, id, input);
  }

  deleteProject(workspace: string, id: string) {
    return this.projectsFiles.deleteProject(workspace, id);
  }

  listProjectFiles(workspace: string, projectId: string) {
    return this.projectsFiles.listProjectFiles(workspace, projectId);
  }

  getProjectFileByPath(workspace: string, projectId: string, path: string) {
    return this.projectsFiles.getProjectFileByPath(workspace, projectId, path);
  }

  updateProjectFileSizeById(
    workspace: string,
    projectId: string,
    fileId: string,
    sizeBytes: number,
    updated_at: Date
  ) {
    return this.projectsFiles.updateProjectFileSizeById(
      workspace,
      projectId,
      fileId,
      sizeBytes,
      updated_at
    );
  }

  upsertProjectFile(input: UpsertProjectFileInput) {
    return this.projectsFiles.upsertProjectFile(input);
  }

  createProjectFileIfAbsent(input: Omit<UpsertProjectFileInput, 'updated_at'> & { updated_at: Date }) {
    return this.projectsFiles.createProjectFileIfAbsent(input);
  }

  deleteProjectFileByPath(workspace: string, projectId: string, path: string) {
    return this.projectsFiles.deleteProjectFileByPath(workspace, projectId, path);
  }

  renameProjectFileFolder(
    workspace: string,
    projectId: string,
    oldPath: string,
    newPath: string,
    updated_at: Date
  ) {
    return this.projectsFiles.renameProjectFileFolder(
      workspace,
      projectId,
      oldPath,
      newPath,
      updated_at
    );
  }

  deleteProjectFileFolder(workspace: string, projectId: string, folderPath: string) {
    return this.projectsFiles.deleteProjectFileFolder(workspace, projectId, folderPath);
  }

  listAuditLogs(workspace: string) {
    return this.audit.listAuditLogs(workspace);
  }

  createAuditLog(input: CreateAuditLogInput) {
    return this.audit.createAuditLog(input);
  }

  getUser(id: string) {
    return this.identityAuth.getUser(id);
  }

  getUserByEmail(email: string) {
    return this.identityAuth.getUserByEmail(email);
  }

  getUserByOidc(issuer: string, subject: string) {
    return this.identityAuth.getUserByOidc(issuer, subject);
  }

  createUser(input: CreateUserInput) {
    return this.identityAuth.createUser(input);
  }

  updateUser(id: string, input: UpdateUserInput) {
    return this.identityAuth.updateUser(id, input);
  }

  updateUserLastLogin(id: string, timestamp: Date) {
    return this.identityAuth.updateUserLastLogin(id, timestamp);
  }

  listUsers() {
    return this.identityAuth.listUsers();
  }

  listGlobalRoleAssignments(userId?: string) {
    return this.identityAuth.listGlobalRoleAssignments(userId);
  }

  replaceGlobalRoleAssignments(userId: string, roles: GlobalRole[], createdAt: Date) {
    return this.identityAuth.replaceGlobalRoleAssignments(userId, roles, createdAt);
  }
}
