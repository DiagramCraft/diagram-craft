import { mkdir, readFile, rm } from 'node:fs/promises';
import { dirname } from 'node:path';
import Database, { type Database as DatabaseType } from 'better-sqlite3';
import type {
  CreateAuditLogInput,
  CreateEntityInput,
  CreateEntityGrantInput,
  CreateProjectInput,
  CreateSchemaInput,
  CreateUserInput,
  CreateWorkspaceInput,
  DatabaseAdapter,
  UpdateEntityInput,
  UpdateProjectInput,
  UpdateSchemaInput,
  UpdateUserInput,
  UpdateWorkspaceInput,
  UpsertProjectFileInput,
} from './database.js';
import { DatabaseError } from './database.js';
import type {
  AuditLogEntry,
  Entity,
  EntityGrant,
  EntityLink,
  EntitySchema,
  GlobalRoleAssignment,
  Project,
  ProjectFile,
  TeamMembership,
  User,
  Workspace,
  WorkspaceLifecycleState,
  WorkspaceOwner,
} from '../types.js';
import { SQLITE_ERROR_PATTERNS } from '../constants.js';

const parseJson = <T>(value: unknown, fallback: T): T => {
  if (typeof value !== 'string' || value === '') return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

const toDate = (value: unknown) => new Date(String(value));

const normalizeError = (error: unknown): never => {
  if (error != null && typeof error === 'object' && 'code' in error) {
    const code = String((error as { code: unknown }).code);
    if (code.includes(SQLITE_ERROR_PATTERNS.UNIQUE)) throw new DatabaseError('unique', 'Unique constraint violation', error);
    if (code.includes(SQLITE_ERROR_PATTERNS.FOREIGN_KEY)) throw new DatabaseError('foreign', 'Foreign key constraint violation', error);
    if (code.includes(SQLITE_ERROR_PATTERNS.CHECK)) throw new DatabaseError('check', 'Check constraint violation', error);
    if (code.includes(SQLITE_ERROR_PATTERNS.NOT_NULL)) throw new DatabaseError('notnull', 'Not null constraint violation', error);
  }
  throw new DatabaseError('unknown', 'Database operation failed', error);
};

const toWorkspace = (row: Record<string, unknown>): Workspace => ({
  id: String(row['id']),
  name: String(row['name']),
  url_slug: String(row['url_slug']),
  short_code: String(row['short_code']),
  description: String(row['description']),
  created_at: toDate(row['created_at']),
  updated_at: toDate(row['updated_at']),
});

const toLifecycleState = (row: Record<string, unknown>): WorkspaceLifecycleState => ({
  id: String(row['id']),
  workspace: String(row['workspace']),
  label: String(row['label']),
  color: String(row['color']),
  sort_order: Number(row['sort_order']),
  created_at: toDate(row['created_at']),
});

const toOwner = (row: Record<string, unknown>): WorkspaceOwner => ({
  id: String(row['id']),
  workspace: String(row['workspace']),
  sort_order: Number(row['sort_order']),
  created_at: toDate(row['created_at']),
});

const toSchema = (row: Record<string, unknown>): EntitySchema => ({
  id: String(row['id']),
  workspace: String(row['workspace']),
  name: String(row['name']),
  fields: parseJson(row['fields'], []),
  color: row['color'] == null ? null : String(row['color']),
  icon: row['icon'] == null ? null : String(row['icon']),
  default_owner: row['default_owner'] == null ? null : String(row['default_owner']),
  created_at: toDate(row['created_at']),
  updated_at: toDate(row['updated_at']),
});

const toEntity = (row: Record<string, unknown>): Entity => ({
  id: String(row['id']),
  workspace: String(row['workspace']),
  slug: String(row['slug']),
  namespace: String(row['namespace']),
  name: String(row['name']),
  description: String(row['description']),
  owner: row['owner'] == null ? null : String(row['owner']),
  lifecycle: row['lifecycle'] == null ? null : String(row['lifecycle']),
  tags: parseJson<string[]>(row['tags'], []),
  links: parseJson<EntityLink[]>(row['links'], []),
  schema_id: String(row['schema_id']),
  data: parseJson<Record<string, unknown>>(row['data'], {}),
  visibility_mode: row['visibility_mode'] == null ? null : String(row['visibility_mode']) as Entity['visibility_mode'],
  created_at: toDate(row['created_at']),
  updated_at: toDate(row['updated_at']),
});

const toProject = (row: Record<string, unknown>): Project => ({
  id: String(row['id']),
  workspace: String(row['workspace']),
  name: String(row['name']),
  description: String(row['description']),
  status: String(row['status']) as Project['status'],
  created_at: toDate(row['created_at']),
  updated_at: toDate(row['updated_at']),
});

const toProjectFile = (row: Record<string, unknown>): ProjectFile => ({
  id: String(row['id']),
  workspace: String(row['workspace']),
  project_id: String(row['project_id']),
  path: String(row['path']),
  name: String(row['name']),
  size_bytes: Number(row['size_bytes']),
  created_at: toDate(row['created_at']),
  updated_at: toDate(row['updated_at']),
});

const toAuditLog = (row: Record<string, unknown>): AuditLogEntry => ({
  id: String(row['id']),
  workspace: String(row['workspace']),
  timestamp: toDate(row['timestamp']),
  user_id: String(row['user_id']),
  operation: row['operation'] as AuditLogEntry['operation'],
  entity_type: row['entity_type'] as AuditLogEntry['entity_type'],
  entity_id: String(row['entity_id']),
  entity_name: String(row['entity_name']),
  entity_slug: row['entity_slug'] == null ? null : String(row['entity_slug']),
  schema_id: row['schema_id'] == null ? null : String(row['schema_id']),
  changes: parseJson(row['changes'], {}),
  metadata: parseJson(row['metadata'], {}),
});

const toUser = (row: Record<string, unknown>): User => ({
  id: String(row['id']),
  email: row['email'] == null ? null : String(row['email']),
  display_name: String(row['display_name']),
  auth_provider: String(row['auth_provider']) as User['auth_provider'],
  password_hash: row['password_hash'] == null ? null : String(row['password_hash']),
  oidc_issuer: row['oidc_issuer'] == null ? null : String(row['oidc_issuer']),
  oidc_subject: row['oidc_subject'] == null ? null : String(row['oidc_subject']),
  is_active: Boolean(row['is_active']),
  created_at: toDate(row['created_at']),
  updated_at: toDate(row['updated_at']),
  last_login_at: row['last_login_at'] == null ? null : toDate(row['last_login_at']),
});

const toTeamMembership = (row: Record<string, unknown>): TeamMembership => ({
  workspace: String(row['workspace']),
  team_id: String(row['team_id']),
  user_id: String(row['user_id']),
  created_at: toDate(row['created_at']),
});

const toGlobalRoleAssignment = (row: Record<string, unknown>): GlobalRoleAssignment => ({
  user_id: String(row['user_id']),
  role: String(row['role']) as GlobalRoleAssignment['role'],
  created_at: toDate(row['created_at']),
});

const toEntityGrant = (row: Record<string, unknown>): EntityGrant => ({
  id: String(row['id']),
  workspace: String(row['workspace']),
  entity_id: String(row['entity_id']),
  principal_type: String(row['principal_type']) as EntityGrant['principal_type'],
  principal_id: String(row['principal_id']),
  role: String(row['role']) as EntityGrant['role'],
  applies_to: String(row['applies_to']) as EntityGrant['applies_to'],
  created_at: toDate(row['created_at']),
});

export class SqliteDatabase implements DatabaseAdapter {
  readonly driver = 'sqlite' as const;
  private db: DatabaseType;
  private readonly filePath: string;

  constructor(filePath: string) {
    this.filePath = filePath;
    this.db = new Database(filePath);
    this.configure();
  }

  private configure() {
    this.db.pragma('foreign_keys = ON');
    this.db.pragma('journal_mode = WAL');
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
    const schemaSql = await readFile(new URL('./schema.sqlite.sql', import.meta.url), 'utf8');
    this.db.exec(schemaSql);
  }

  private all<T>(sql: string, params: unknown[] = [], map?: (row: Record<string, unknown>) => T): T[] {
    try {
      const rows = this.db.prepare(sql).all(...params) as Record<string, unknown>[];
      return map ? rows.map(map) : (rows as T[]);
    } catch (error) {
      return normalizeError(error);
    }
  }

  private get<T>(sql: string, params: unknown[] = [], map?: (row: Record<string, unknown>) => T): T | null {
    try {
      const row = this.db.prepare(sql).get(...params) as Record<string, unknown> | undefined;
      if (!row) return null;
      return map ? map(row) : (row as T);
    } catch (error) {
      return normalizeError(error);
    }
  }

  private run(sql: string, params: unknown[] = []) {
    try {
      return this.db.prepare(sql).run(...params);
    } catch (error) {
      return normalizeError(error);
    }
  }

  async resolveWorkspaceSlug(slug: string) {
    const row = this.get<{ id: string }>('SELECT id FROM workspace WHERE url_slug = ?', [slug]);
    return row?.id ?? null;
  }

  async listWorkspaces() {
    return this.all('SELECT * FROM workspace ORDER BY name', [], toWorkspace);
  }

  async getWorkspace(id: string) {
    return this.get('SELECT * FROM workspace WHERE id = ?', [id], toWorkspace);
  }

  async createWorkspace(input: CreateWorkspaceInput) {
    this.run(
      'INSERT INTO workspace (id, name, url_slug, short_code, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [input.id, input.name, input.url_slug, input.short_code, input.description, input.created_at.toISOString(), input.updated_at.toISOString()],
    );
    return (await this.getWorkspace(input.id))!;
  }

  async updateWorkspace(id: string, input: UpdateWorkspaceInput) {
    this.run(
      'UPDATE workspace SET name = ?, url_slug = ?, short_code = ?, description = ?, updated_at = ? WHERE id = ?',
      [input.name, input.url_slug, input.short_code, input.description, input.updated_at.toISOString(), id],
    );
    return await this.getWorkspace(id);
  }

  async deleteWorkspace(id: string) {
    const workspace = await this.getWorkspace(id);
    if (!workspace) return { workspace: null, projectIds: [] };
    const projectIds = this.all<{ id: string }>('SELECT id FROM project WHERE workspace = ?', [id]).map(project => project.id);
    const tx = this.db.transaction((workspaceId: string) => {
      this.run('DELETE FROM project_file WHERE workspace = ?', [workspaceId]);
      this.run('DELETE FROM project WHERE workspace = ?', [workspaceId]);
      this.run('DELETE FROM entity_grant WHERE workspace = ?', [workspaceId]);
      this.run('DELETE FROM entity WHERE workspace = ?', [workspaceId]);
      this.run('DELETE FROM entity_schema WHERE workspace = ?', [workspaceId]);
      this.run('DELETE FROM team_membership WHERE workspace = ?', [workspaceId]);
      this.run('DELETE FROM workspace_lifecycle_state WHERE workspace = ?', [workspaceId]);
      this.run('DELETE FROM workspace_owner WHERE workspace = ?', [workspaceId]);
      this.run('DELETE FROM audit_log WHERE workspace = ?', [workspaceId]);
      this.run('DELETE FROM workspace WHERE id = ?', [workspaceId]);
    });
    tx(id);
    return { workspace, projectIds };
  }

  async listLifecycleStates(workspace: string) {
    return this.all(
      'SELECT id, workspace, label, color, sort_order, created_at FROM workspace_lifecycle_state WHERE workspace = ? ORDER BY sort_order, id',
      [workspace],
      toLifecycleState,
    );
  }

  async replaceLifecycleStates(workspace: string, states: WorkspaceLifecycleState[]) {
    const tx = this.db.transaction(() => {
      this.run('DELETE FROM workspace_lifecycle_state WHERE workspace = ?', [workspace]);
      for (const state of states) {
        this.run(
          'INSERT INTO workspace_lifecycle_state (id, workspace, label, color, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?)',
          [state.id, workspace, state.label, state.color, state.sort_order, state.created_at.toISOString()],
        );
      }
    });
    tx();
    return await this.listLifecycleStates(workspace);
  }

  async listOwners(workspace: string) {
    return this.all(
      'SELECT id, workspace, sort_order, created_at FROM workspace_owner WHERE workspace = ? ORDER BY sort_order, id',
      [workspace],
      toOwner,
    );
  }

  async replaceOwners(workspace: string, owners: WorkspaceOwner[]) {
    const tx = this.db.transaction(() => {
      this.run('DELETE FROM team_membership WHERE workspace = ?', [workspace]);
      this.run('DELETE FROM workspace_owner WHERE workspace = ?', [workspace]);
      for (const owner of owners) {
        this.run(
          'INSERT INTO workspace_owner (id, workspace, sort_order, created_at) VALUES (?, ?, ?, ?)',
          [owner.id, workspace, owner.sort_order, owner.created_at.toISOString()],
        );
      }
    });
    tx();
    return await this.listOwners(workspace);
  }

  async listTeamMemberships(workspace: string) {
    return this.all(
      'SELECT workspace, team_id, user_id, created_at FROM team_membership WHERE workspace = ? ORDER BY team_id, user_id',
      [workspace],
      toTeamMembership,
    );
  }

  async replaceTeamMemberships(workspace: string, memberships: TeamMembership[]) {
    const tx = this.db.transaction(() => {
      this.run('DELETE FROM team_membership WHERE workspace = ?', [workspace]);
      for (const membership of memberships) {
        this.run(
          'INSERT INTO team_membership (workspace, team_id, user_id, created_at) VALUES (?, ?, ?, ?)',
          [workspace, membership.team_id, membership.user_id, membership.created_at.toISOString()],
        );
      }
    });
    tx();
    return await this.listTeamMemberships(workspace);
  }

  async listSchemas(workspace: string) {
    return this.all('SELECT * FROM entity_schema WHERE workspace = ? ORDER BY name', [workspace], toSchema);
  }

  async getSchema(workspace: string, id: string) {
    return this.get('SELECT * FROM entity_schema WHERE workspace = ? AND id = ?', [workspace, id], toSchema);
  }

  async createSchema(input: CreateSchemaInput) {
    this.run(
      'INSERT INTO entity_schema (id, workspace, name, fields, color, icon, default_owner, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        input.id,
        input.workspace,
        input.name,
        JSON.stringify(input.fields),
        input.color,
        input.icon,
        input.default_owner,
        input.created_at.toISOString(),
        input.updated_at.toISOString(),
      ],
    );
    return (await this.getSchema(input.workspace, input.id))!;
  }

  async updateSchema(workspace: string, id: string, input: UpdateSchemaInput) {
    this.run(
      'UPDATE entity_schema SET name = ?, fields = ?, color = ?, icon = ?, default_owner = ?, updated_at = ? WHERE workspace = ? AND id = ?',
      [input.name, JSON.stringify(input.fields), input.color, input.icon, input.default_owner, input.updated_at.toISOString(), workspace, id],
    );
    return await this.getSchema(workspace, id);
  }

  async deleteSchema(workspace: string, id: string) {
    const row = await this.getSchema(workspace, id);
    if (!row) return null;
    this.run('DELETE FROM entity_schema WHERE workspace = ? AND id = ?', [workspace, id]);
    return row;
  }

  async listEntities(workspace: string) {
    return this.all('SELECT * FROM entity WHERE workspace = ? ORDER BY name', [workspace], toEntity);
  }

  async getEntity(workspace: string, id: string) {
    return this.get('SELECT * FROM entity WHERE workspace = ? AND id = ?', [workspace, id], toEntity);
  }

  async createEntity(input: CreateEntityInput) {
    this.run(
      'INSERT INTO entity (id, workspace, slug, namespace, name, description, owner, lifecycle, tags, links, schema_id, data, visibility_mode, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        input.id,
        input.workspace,
        input.slug,
        input.namespace,
        input.name,
        input.description,
        input.owner,
        input.lifecycle,
        JSON.stringify(input.tags),
        JSON.stringify(input.links),
        input.schema_id,
        JSON.stringify(input.data),
        input.visibility_mode,
        input.created_at.toISOString(),
        input.updated_at.toISOString(),
      ],
    );
    return (await this.getEntity(input.workspace, input.id))!;
  }

  async updateEntity(workspace: string, id: string, input: UpdateEntityInput) {
    this.run(
      'UPDATE entity SET slug = ?, namespace = ?, name = ?, description = ?, owner = ?, lifecycle = ?, tags = ?, links = ?, schema_id = ?, data = ?, visibility_mode = ?, updated_at = ? WHERE workspace = ? AND id = ?',
      [
        input.slug,
        input.namespace,
        input.name,
        input.description,
        input.owner,
        input.lifecycle,
        JSON.stringify(input.tags),
        JSON.stringify(input.links),
        input.schema_id,
        JSON.stringify(input.data),
        input.visibility_mode,
        input.updated_at.toISOString(),
        workspace,
        id,
      ],
    );
    return await this.getEntity(workspace, id);
  }

  async deleteEntity(workspace: string, id: string) {
    const row = await this.getEntity(workspace, id);
    if (!row) return null;
    this.run('DELETE FROM entity WHERE workspace = ? AND id = ?', [workspace, id]);
    return row;
  }

  async listEntityGrants(workspace: string) {
    return this.all(
      'SELECT * FROM entity_grant WHERE workspace = ? ORDER BY entity_id, principal_type, principal_id',
      [workspace],
      toEntityGrant,
    );
  }

  async getEntityGrants(workspace: string, entityId: string) {
    return this.all(
      'SELECT * FROM entity_grant WHERE workspace = ? AND entity_id = ? ORDER BY principal_type, principal_id',
      [workspace, entityId],
      toEntityGrant,
    );
  }

  async replaceEntityGrants(workspace: string, entityId: string, grants: CreateEntityGrantInput[]) {
    const tx = this.db.transaction(() => {
      this.run('DELETE FROM entity_grant WHERE workspace = ? AND entity_id = ?', [workspace, entityId]);
      for (const grant of grants) {
        this.run(
          'INSERT INTO entity_grant (id, workspace, entity_id, principal_type, principal_id, role, applies_to, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [
            grant.id,
            workspace,
            entityId,
            grant.principal_type,
            grant.principal_id,
            grant.role,
            grant.applies_to,
            grant.created_at.toISOString(),
          ],
        );
      }
    });
    tx();
    return await this.getEntityGrants(workspace, entityId);
  }

  async listProjects(workspace: string) {
    return this.all('SELECT * FROM project WHERE workspace = ? ORDER BY name', [workspace], toProject);
  }

  async getProject(workspace: string, id: string) {
    return this.get('SELECT * FROM project WHERE workspace = ? AND id = ?', [workspace, id], toProject);
  }

  async createProject(input: CreateProjectInput) {
    this.run(
      'INSERT INTO project (id, workspace, name, description, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [input.id, input.workspace, input.name, input.description, input.status, input.created_at.toISOString(), input.updated_at.toISOString()],
    );
    return (await this.getProject(input.workspace, input.id))!;
  }

  async updateProject(workspace: string, id: string, input: UpdateProjectInput) {
    this.run(
      'UPDATE project SET name = ?, description = ?, status = ?, updated_at = ? WHERE workspace = ? AND id = ?',
      [input.name, input.description, input.status, input.updated_at.toISOString(), workspace, id],
    );
    return await this.getProject(workspace, id);
  }

  async deleteProject(workspace: string, id: string) {
    const row = await this.getProject(workspace, id);
    if (!row) return null;
    this.run('DELETE FROM project WHERE workspace = ? AND id = ?', [workspace, id]);
    return row;
  }

  async listProjectFiles(workspace: string, projectId: string) {
    return this.all(
      'SELECT * FROM project_file WHERE workspace = ? AND project_id = ? ORDER BY path',
      [workspace, projectId],
      toProjectFile,
    );
  }

  async getProjectFileByPath(workspace: string, projectId: string, path: string) {
    return this.get(
      'SELECT * FROM project_file WHERE workspace = ? AND project_id = ? AND path = ?',
      [workspace, projectId, path],
      toProjectFile,
    );
  }

  async updateProjectFileSizeById(workspace: string, projectId: string, fileId: string, sizeBytes: number, updated_at: Date) {
    this.run(
      'UPDATE project_file SET size_bytes = ?, updated_at = ? WHERE workspace = ? AND project_id = ? AND id = ?',
      [sizeBytes, updated_at.toISOString(), workspace, projectId, fileId],
    );
  }

  async upsertProjectFile(input: UpsertProjectFileInput) {
    const id = crypto.randomUUID();
    const tx = this.db.transaction(() => {
      const existing = this.get<{ id: string; created_at: string }>(
        'SELECT id, created_at FROM project_file WHERE workspace = ? AND project_id = ? AND path = ?',
        [input.workspace, input.project_id, input.path]
      );
      
      if (existing) {
        this.run(
          'UPDATE project_file SET name = ?, size_bytes = ?, updated_at = ? WHERE id = ?',
          [input.name, input.size_bytes, input.updated_at.toISOString(), existing.id],
        );
      } else {
        this.run(
          'INSERT INTO project_file (id, workspace, project_id, path, name, size_bytes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [
            id,
            input.workspace,
            input.project_id,
            input.path,
            input.name,
            input.size_bytes,
            input.created_atIfNew.toISOString(),
            input.updated_at.toISOString(),
          ],
        );
      }
    });
    tx();
    return (await this.getProjectFileByPath(input.workspace, input.project_id, input.path))!;
  }

  async createProjectFileIfAbsent(input: Omit<UpsertProjectFileInput, 'updated_at'> & { updated_at: Date }) {
    const existing = await this.getProjectFileByPath(input.workspace, input.project_id, input.path);
    if (existing) return null;
    return await this.upsertProjectFile(input);
  }

  async deleteProjectFileByPath(workspace: string, projectId: string, path: string) {
    const row = await this.getProjectFileByPath(workspace, projectId, path);
    if (!row) return null;
    this.run('DELETE FROM project_file WHERE workspace = ? AND project_id = ? AND path = ?', [workspace, projectId, path]);
    return row;
  }

  async renameProjectFileFolder(workspace: string, projectId: string, oldPath: string, newPath: string, updated_at: Date) {
    const oldPathPrefix = `${oldPath}/`;
    const newPathPrefix = `${newPath}/`;
    const oldPathLength = oldPath.length;
    
    const matchingIds = this.all<{ id: string }>(
      'SELECT id FROM project_file WHERE workspace = ? AND project_id = ? AND path LIKE ?',
      [workspace, projectId, `${oldPathPrefix}%`]
    );
    
    const tx = this.db.transaction(() => {
      this.run(
        `UPDATE project_file 
         SET path = ? || substr(path, ?), 
             updated_at = ? 
         WHERE workspace = ? AND project_id = ? AND path LIKE ?`,
        [newPathPrefix, oldPathLength + 2, updated_at.toISOString(), workspace, projectId, `${oldPathPrefix}%`]
      );
    });
    tx();
    return matchingIds.map(row => row.id);
  }

  async deleteProjectFileFolder(workspace: string, projectId: string, folderPath: string) {
    const folderPathPrefix = `${folderPath}/`;
    const matching = this.all(
      'SELECT * FROM project_file WHERE workspace = ? AND project_id = ? AND path LIKE ?',
      [workspace, projectId, `${folderPathPrefix}%`],
      toProjectFile
    );
    
    if (matching.length === 0) return [];
    
    const tx = this.db.transaction(() => {
      this.run(
        'DELETE FROM project_file WHERE workspace = ? AND project_id = ? AND path LIKE ?',
        [workspace, projectId, `${folderPathPrefix}%`]
      );
    });
    tx();
    return matching;
  }

  async listAuditLogs(workspace: string) {
    return this.all('SELECT * FROM audit_log WHERE workspace = ? ORDER BY timestamp DESC', [workspace], toAuditLog);
  }

  async createAuditLog(input: CreateAuditLogInput) {
    const id = crypto.randomUUID();
    this.run(
      'INSERT INTO audit_log (id, workspace, timestamp, user_id, operation, entity_type, entity_id, entity_name, entity_slug, schema_id, changes, metadata) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        id,
        input.workspace,
        input.timestamp.toISOString(),
        input.user_id,
        input.operation,
        input.entity_type,
        input.entity_id,
        input.entity_name,
        input.entity_slug,
        input.schema_id,
        JSON.stringify(input.changes),
        JSON.stringify(input.metadata),
      ],
    );
    return (await this.get<AuditLogEntry>('SELECT * FROM audit_log WHERE id = ?', [id], toAuditLog))!;
  }

  async getUser(id: string) {
    return this.get('SELECT * FROM users WHERE id = ?', [id], toUser);
  }

  async getUserByEmail(email: string) {
    return this.get('SELECT * FROM users WHERE email = ?', [email], toUser);
  }

  async getUserByOidc(issuer: string, subject: string) {
    return this.get(
      'SELECT * FROM users WHERE oidc_issuer = ? AND oidc_subject = ?',
      [issuer, subject],
      toUser
    );
  }

  async createUser(input: CreateUserInput) {
    this.run(
      'INSERT INTO users (id, email, display_name, auth_provider, password_hash, oidc_issuer, oidc_subject, is_active, created_at, updated_at, last_login_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        input.id,
        input.email,
        input.display_name,
        input.auth_provider,
        input.password_hash,
        input.oidc_issuer,
        input.oidc_subject,
        input.is_active ? 1 : 0,
        input.created_at.toISOString(),
        input.updated_at.toISOString(),
        input.last_login_at?.toISOString() ?? null,
      ]
    );
    return (await this.getUser(input.id))!;
  }

  async updateUser(id: string, input: UpdateUserInput) {
    const sets: string[] = [];
    const values: unknown[] = [];

    if (input.email !== undefined) {
      sets.push('email = ?');
      values.push(input.email);
    }
    if (input.display_name !== undefined) {
      sets.push('display_name = ?');
      values.push(input.display_name);
    }
    if (input.password_hash !== undefined) {
      sets.push('password_hash = ?');
      values.push(input.password_hash);
    }
    if (input.is_active !== undefined) {
      sets.push('is_active = ?');
      values.push(input.is_active ? 1 : 0);
    }
    sets.push('updated_at = ?');
    values.push(input.updated_at.toISOString());

    values.push(id);

    this.run(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`, values);
    return await this.getUser(id);
  }

  async updateUserLastLogin(id: string, timestamp: Date) {
    this.run('UPDATE users SET last_login_at = ? WHERE id = ?', [timestamp.toISOString(), id]);
  }

  async listUsers() {
    return this.all('SELECT * FROM users ORDER BY display_name', [], toUser);
  }

  async listGlobalRoleAssignments(userId?: string) {
    if (userId) {
      return this.all(
        'SELECT user_id, role, created_at FROM global_role_assignment WHERE user_id = ? ORDER BY role',
        [userId],
        toGlobalRoleAssignment,
      );
    }
    return this.all('SELECT user_id, role, created_at FROM global_role_assignment ORDER BY user_id, role', [], toGlobalRoleAssignment);
  }

  async replaceGlobalRoleAssignments(userId: string, roles: GlobalRoleAssignment['role'][], createdAt: Date) {
    const tx = this.db.transaction(() => {
      this.run('DELETE FROM global_role_assignment WHERE user_id = ?', [userId]);
      for (const role of roles) {
        this.run(
          'INSERT INTO global_role_assignment (user_id, role, created_at) VALUES (?, ?, ?)',
          [userId, role, createdAt.toISOString()],
        );
      }
    });
    tx();
    return await this.listGlobalRoleAssignments(userId);
  }
}
