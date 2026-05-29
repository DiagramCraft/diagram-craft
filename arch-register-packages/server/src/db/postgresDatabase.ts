import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';
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
import { normalizePostgresError, type PostgresSqlClient } from './postgresBase.js';
import { PostgresAuditDatabase } from './postgresAudit.js';
import { PostgresCatalogDatabase } from './postgresCatalog.js';
import { PostgresIdentityAuthDatabase } from './postgresIdentityAuth.js';
import { PostgresProjectsFilesDatabase } from './postgresProjectsFiles.js';
import { PostgresWorkspaceAdminDatabase } from './postgresWorkspaceAdmin.js';
import { SERVER_DEFAULTS } from '../constants.js';
import type { GlobalRole, TeamMembership, WorkspaceLifecycleState, WorkspaceOwner } from '../types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const schemaPath = join(__dirname, 'schema.postgres.sql');

export class PostgresDatabase implements DatabaseAdapter {
  readonly driver = 'postgres' as const;
  private readonly sql: PostgresSqlClient;

  private readonly workspaceAdmin: PostgresWorkspaceAdminDatabase;
  private readonly catalog: PostgresCatalogDatabase;
  private readonly projectsFiles: PostgresProjectsFilesDatabase;
  private readonly audit: PostgresAuditDatabase;
  private readonly identityAuth: PostgresIdentityAuthDatabase;

  constructor(connectionString: string) {
    this.sql = postgres(connectionString, {
      max: SERVER_DEFAULTS.MAX_DB_CONNECTIONS,
      idle_timeout: SERVER_DEFAULTS.DB_IDLE_TIMEOUT,
      connect_timeout: SERVER_DEFAULTS.DB_CONNECT_TIMEOUT
    });

    this.workspaceAdmin = new PostgresWorkspaceAdminDatabase(this.sql);
    this.catalog = new PostgresCatalogDatabase(this.sql);
    this.projectsFiles = new PostgresProjectsFilesDatabase(this.sql);
    this.audit = new PostgresAuditDatabase(this.sql);
    this.identityAuth = new PostgresIdentityAuthDatabase(this.sql);
  }

  async close() {
    await this.sql.end();
  }

  async reset() {
    try {
      await this.sql`DROP TABLE IF EXISTS global_role_assignment CASCADE`;
      await this.sql`DROP TABLE IF EXISTS team_membership CASCADE`;
      await this.sql`DROP TABLE IF EXISTS users CASCADE`;
      await this.sql`DROP TABLE IF EXISTS audit_log CASCADE`;
      await this.sql`DROP TABLE IF EXISTS project_file CASCADE`;
      await this.sql`DROP TABLE IF EXISTS project CASCADE`;
      await this.sql`DROP TABLE IF EXISTS entity_grant CASCADE`;
      await this.sql`DROP TABLE IF EXISTS entity CASCADE`;
      await this.sql`DROP TABLE IF EXISTS entity_schema CASCADE`;
      await this.sql`DROP TABLE IF EXISTS workspace_lifecycle_state CASCADE`;
      await this.sql`DROP TABLE IF EXISTS workspace_owner CASCADE`;
      await this.sql`DROP TABLE IF EXISTS workspace CASCADE`;
      const schemaSql = await readFile(schemaPath, 'utf8');
      await this.sql.unsafe(schemaSql);
    } catch (error) {
      return normalizePostgresError(error);
    }
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

  createWorkspace(input: Parameters<PostgresWorkspaceAdminDatabase['createWorkspace']>[0]) {
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