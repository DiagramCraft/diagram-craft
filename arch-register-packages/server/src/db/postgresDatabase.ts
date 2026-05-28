import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';
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
import { DB_ERROR_CODES, SERVER_DEFAULTS } from '../constants.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const schemaPath = join(__dirname, 'schema.postgres.sql');

const normalizeError = (error: unknown): never => {
  if (error != null && typeof error === 'object' && 'code' in error) {
    const code = String((error as { code: unknown }).code);
    if (code === DB_ERROR_CODES.UNIQUE) throw new DatabaseError('unique', 'Unique constraint violation', error);
    if (code === DB_ERROR_CODES.FOREIGN_KEY) throw new DatabaseError('foreign', 'Foreign key constraint violation', error);
    if (code === DB_ERROR_CODES.CHECK) throw new DatabaseError('check', 'Check constraint violation', error);
    if (code === DB_ERROR_CODES.NOT_NULL) throw new DatabaseError('notnull', 'Not null constraint violation', error);
  }
  throw new DatabaseError('unknown', 'Database operation failed', error);
};

export class PostgresDatabase implements DatabaseAdapter {
  readonly driver = 'postgres' as const;
  private readonly sql;

  constructor(connectionString: string) {
    this.sql = postgres(connectionString, {
      max: SERVER_DEFAULTS.MAX_DB_CONNECTIONS,
      idle_timeout: SERVER_DEFAULTS.DB_IDLE_TIMEOUT,
      connect_timeout: SERVER_DEFAULTS.DB_CONNECT_TIMEOUT,
    });
  }

  private json(value: unknown) {
    return this.sql.json(value as Parameters<typeof this.sql.json>[0]);
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
      return normalizeError(error);
    }
  }

  async resolveWorkspaceSlug(slug: string) {
    const [row] = await this.sql<{ id: string }[]>`SELECT id FROM workspace WHERE url_slug = ${slug}`;
    return row?.id ?? null;
  }

  async listWorkspaces() {
    return await this.sql<Workspace[]>`SELECT * FROM workspace ORDER BY name`;
  }

  async getWorkspace(id: string) {
    const [row] = await this.sql<Workspace[]>`SELECT * FROM workspace WHERE id = ${id}`;
    return row ?? null;
  }

  async createWorkspace(input: CreateWorkspaceInput) {
    try {
      const [row] = await this.sql<Workspace[]>`
        INSERT INTO workspace (id, name, url_slug, short_code, description, created_at, updated_at)
        VALUES (${input.id}, ${input.name}, ${input.url_slug}, ${input.short_code}, ${input.description}, ${input.created_at}, ${input.updated_at})
        RETURNING *
      `;
      return row!;
    } catch (error) {
      return normalizeError(error);
    }
  }

  async updateWorkspace(id: string, input: UpdateWorkspaceInput) {
    try {
      const [row] = await this.sql<Workspace[]>`
        UPDATE workspace
        SET name = ${input.name},
            url_slug = ${input.url_slug},
            short_code = ${input.short_code},
            description = ${input.description},
            updated_at = ${input.updated_at}
        WHERE id = ${id}
        RETURNING *
      `;
      return row ?? null;
    } catch (error) {
      return normalizeError(error);
    }
  }

  async deleteWorkspace(id: string) {
    try {
      const [workspace] = await this.sql<Workspace[]>`SELECT * FROM workspace WHERE id = ${id}`;
      if (!workspace) return { workspace: null, projectIds: [] };
      const projects = await this.sql<{ id: string }[]>`SELECT id FROM project WHERE workspace = ${id}`;
      await this.sql.begin(async tx => {
        await tx`DELETE FROM project_file WHERE workspace = ${id}`;
        await tx`DELETE FROM project WHERE workspace = ${id}`;
        await tx`DELETE FROM entity_grant WHERE workspace = ${id}`;
        await tx`DELETE FROM entity WHERE workspace = ${id}`;
        await tx`DELETE FROM entity_schema WHERE workspace = ${id}`;
        await tx`DELETE FROM team_membership WHERE workspace = ${id}`;
        await tx`DELETE FROM workspace_lifecycle_state WHERE workspace = ${id}`;
        await tx`DELETE FROM workspace_owner WHERE workspace = ${id}`;
        await tx`DELETE FROM audit_log WHERE workspace = ${id}`;
        await tx`DELETE FROM workspace WHERE id = ${id}`;
      });
      return { workspace, projectIds: projects.map(project => project.id) };
    } catch (error) {
      return normalizeError(error);
    }
  }

  async listLifecycleStates(workspace: string) {
    return await this.sql<WorkspaceLifecycleState[]>`
      SELECT id, workspace, label, color, sort_order, created_at
      FROM workspace_lifecycle_state
      WHERE workspace = ${workspace}
      ORDER BY sort_order, id
    `;
  }

  async replaceLifecycleStates(workspace: string, states: WorkspaceLifecycleState[]) {
    try {
      await this.sql.begin(async tx => {
        await tx`DELETE FROM workspace_lifecycle_state WHERE workspace = ${workspace}`;
        for (const state of states) {
          await tx`
            INSERT INTO workspace_lifecycle_state (id, workspace, label, color, sort_order, created_at)
            VALUES (${state.id}, ${workspace}, ${state.label}, ${state.color}, ${state.sort_order}, ${state.created_at})
          `;
        }
      });
      return await this.listLifecycleStates(workspace);
    } catch (error) {
      return normalizeError(error);
    }
  }

  async listOwners(workspace: string) {
    return await this.sql<WorkspaceOwner[]>`
      SELECT id, workspace, sort_order, created_at
      FROM workspace_owner
      WHERE workspace = ${workspace}
      ORDER BY sort_order, id
    `;
  }

  async replaceOwners(workspace: string, owners: WorkspaceOwner[]) {
    try {
      await this.sql.begin(async tx => {
        await tx`DELETE FROM team_membership WHERE workspace = ${workspace}`;
        await tx`DELETE FROM workspace_owner WHERE workspace = ${workspace}`;
        for (const owner of owners) {
          await tx`
            INSERT INTO workspace_owner (id, workspace, sort_order, created_at)
            VALUES (${owner.id}, ${workspace}, ${owner.sort_order}, ${owner.created_at})
          `;
        }
      });
      return await this.listOwners(workspace);
    } catch (error) {
      return normalizeError(error);
    }
  }

  async listTeamMemberships(workspace: string) {
    return await this.sql<TeamMembership[]>`
      SELECT workspace, team_id, user_id, created_at
      FROM team_membership
      WHERE workspace = ${workspace}
      ORDER BY team_id, user_id
    `;
  }

  async replaceTeamMemberships(workspace: string, memberships: TeamMembership[]) {
    try {
      await this.sql.begin(async tx => {
        await tx`DELETE FROM team_membership WHERE workspace = ${workspace}`;
        for (const membership of memberships) {
          await tx`
            INSERT INTO team_membership (workspace, team_id, user_id, created_at)
            VALUES (${workspace}, ${membership.team_id}, ${membership.user_id}, ${membership.created_at})
          `;
        }
      });
      return await this.listTeamMemberships(workspace);
    } catch (error) {
      return normalizeError(error);
    }
  }

  async listSchemas(workspace: string) {
    return await this.sql<EntitySchema[]>`SELECT * FROM entity_schema WHERE workspace = ${workspace} ORDER BY name`;
  }

  async getSchema(workspace: string, id: string) {
    const [row] = await this.sql<EntitySchema[]>`SELECT * FROM entity_schema WHERE workspace = ${workspace} AND id = ${id}`;
    return row ?? null;
  }

  async createSchema(input: CreateSchemaInput) {
    try {
      const [row] = await this.sql<EntitySchema[]>`
        INSERT INTO entity_schema (id, workspace, name, fields, color, icon, default_owner, created_at, updated_at)
        VALUES (${input.id}, ${input.workspace}, ${input.name}, ${this.json(input.fields)}, ${input.color}, ${input.icon}, ${input.default_owner}, ${input.created_at}, ${input.updated_at})
        RETURNING *
      `;
      if (!row) throw new DatabaseError('unknown', 'Failed to create schema');
      return row;
    } catch (error) {
      return normalizeError(error);
    }
  }

  async updateSchema(workspace: string, id: string, input: UpdateSchemaInput) {
    try {
      const [row] = await this.sql<EntitySchema[]>`
        UPDATE entity_schema
        SET name = ${input.name},
            fields = ${this.json(input.fields)},
            color = ${input.color},
            icon = ${input.icon},
            default_owner = ${input.default_owner},
            updated_at = ${input.updated_at}
        WHERE workspace = ${workspace} AND id = ${id}
        RETURNING *
      `;
      return row ?? null;
    } catch (error) {
      return normalizeError(error);
    }
  }

  async deleteSchema(workspace: string, id: string) {
    try {
      const [row] = await this.sql<EntitySchema[]>`
        DELETE FROM entity_schema
        WHERE workspace = ${workspace} AND id = ${id}
        RETURNING *
      `;
      return row ?? null;
    } catch (error) {
      return normalizeError(error);
    }
  }

  async listEntities(workspace: string) {
    return await this.sql<Entity[]>`SELECT * FROM entity WHERE workspace = ${workspace} ORDER BY name`;
  }

  async getEntity(workspace: string, id: string) {
    const [row] = await this.sql<Entity[]>`SELECT * FROM entity WHERE workspace = ${workspace} AND id = ${id}`;
    return row ?? null;
  }

  async createEntity(input: CreateEntityInput) {
    try {
      const [row] = await this.sql<Entity[]>`
        INSERT INTO entity (id, workspace, slug, namespace, name, description, owner, lifecycle, tags, links, schema_id, data, visibility_mode, created_at, updated_at)
        VALUES (
          ${input.id},
          ${input.workspace},
          ${input.slug},
          ${input.namespace},
          ${input.name},
          ${input.description},
          ${input.owner},
          ${input.lifecycle},
          ${this.json(input.tags)},
          ${this.json(input.links)},
          ${input.schema_id},
          ${this.json(input.data)},
          ${input.visibility_mode},
          ${input.created_at},
          ${input.updated_at}
        )
        RETURNING *
      `;
      if (!row) throw new DatabaseError('unknown', 'Failed to create entity');
      return row;
    } catch (error) {
      return normalizeError(error);
    }
  }

  async updateEntity(workspace: string, id: string, input: UpdateEntityInput) {
    try {
      const [row] = await this.sql<Entity[]>`
        UPDATE entity
        SET slug = ${input.slug},
            namespace = ${input.namespace},
            name = ${input.name},
            description = ${input.description},
            owner = ${input.owner},
            lifecycle = ${input.lifecycle},
            tags = ${this.json(input.tags)},
            links = ${this.json(input.links)},
            schema_id = ${input.schema_id},
            data = ${this.json(input.data)},
            visibility_mode = ${input.visibility_mode},
            updated_at = ${input.updated_at}
        WHERE workspace = ${workspace} AND id = ${id}
        RETURNING *
      `;
      return row ?? null;
    } catch (error) {
      return normalizeError(error);
    }
  }

  async deleteEntity(workspace: string, id: string) {
    try {
      const [row] = await this.sql<Entity[]>`
        DELETE FROM entity
        WHERE workspace = ${workspace} AND id = ${id}
        RETURNING *
      `;
      return row ?? null;
    } catch (error) {
      return normalizeError(error);
    }
  }

  async listEntityGrants(workspace: string) {
    return await this.sql<EntityGrant[]>`
      SELECT * FROM entity_grant
      WHERE workspace = ${workspace}
      ORDER BY entity_id, principal_type, principal_id
    `;
  }

  async getEntityGrants(workspace: string, entityId: string) {
    return await this.sql<EntityGrant[]>`
      SELECT * FROM entity_grant
      WHERE workspace = ${workspace} AND entity_id = ${entityId}
      ORDER BY principal_type, principal_id
    `;
  }

  async replaceEntityGrants(workspace: string, entityId: string, grants: CreateEntityGrantInput[]) {
    try {
      await this.sql.begin(async tx => {
        await tx`DELETE FROM entity_grant WHERE workspace = ${workspace} AND entity_id = ${entityId}`;
        for (const grant of grants) {
          await tx`
            INSERT INTO entity_grant (id, workspace, entity_id, principal_type, principal_id, role, applies_to, created_at)
            VALUES (${grant.id}, ${workspace}, ${entityId}, ${grant.principal_type}, ${grant.principal_id}, ${grant.role}, ${grant.applies_to}, ${grant.created_at})
          `;
        }
      });
      return await this.getEntityGrants(workspace, entityId);
    } catch (error) {
      return normalizeError(error);
    }
  }

  async listProjects(workspace: string) {
    return await this.sql<Project[]>`SELECT * FROM project WHERE workspace = ${workspace} ORDER BY name`;
  }

  async getProject(workspace: string, id: string) {
    const [row] = await this.sql<Project[]>`SELECT * FROM project WHERE workspace = ${workspace} AND id = ${id}`;
    return row ?? null;
  }

  async createProject(input: CreateProjectInput) {
    try {
      const [row] = await this.sql<Project[]>`
        INSERT INTO project (id, workspace, name, description, status, created_at, updated_at)
        VALUES (${input.id}, ${input.workspace}, ${input.name}, ${input.description}, ${input.status}, ${input.created_at}, ${input.updated_at})
        RETURNING *
      `;
      if (!row) throw new DatabaseError('unknown', 'Failed to create project');
      return row;
    } catch (error) {
      return normalizeError(error);
    }
  }

  async updateProject(workspace: string, id: string, input: UpdateProjectInput) {
    try {
      const [row] = await this.sql<Project[]>`
        UPDATE project
        SET name = ${input.name},
            description = ${input.description},
            status = ${input.status},
            updated_at = ${input.updated_at}
        WHERE workspace = ${workspace} AND id = ${id}
        RETURNING *
      `;
      return row ?? null;
    } catch (error) {
      return normalizeError(error);
    }
  }

  async deleteProject(workspace: string, id: string) {
    try {
      const [row] = await this.sql<Project[]>`
        DELETE FROM project
        WHERE workspace = ${workspace} AND id = ${id}
        RETURNING *
      `;
      return row ?? null;
    } catch (error) {
      return normalizeError(error);
    }
  }

  async listProjectFiles(workspace: string, projectId: string) {
    return await this.sql<ProjectFile[]>`
      SELECT *
      FROM project_file
      WHERE workspace = ${workspace} AND project_id = ${projectId}
      ORDER BY path
    `;
  }

  async getProjectFileByPath(workspace: string, projectId: string, path: string) {
    const [row] = await this.sql<ProjectFile[]>`
      SELECT * FROM project_file
      WHERE workspace = ${workspace} AND project_id = ${projectId} AND path = ${path}
    `;
    return row ?? null;
  }

  async updateProjectFileSizeById(workspace: string, projectId: string, fileId: string, sizeBytes: number, updated_at: Date) {
    try {
      await this.sql`
        UPDATE project_file
        SET size_bytes = ${sizeBytes}, updated_at = ${updated_at}
        WHERE workspace = ${workspace} AND project_id = ${projectId} AND id = ${fileId}
      `;
    } catch (error) {
      return normalizeError(error);
    }
  }

  async upsertProjectFile(input: UpsertProjectFileInput) {
    try {
      const [row] = await this.sql<ProjectFile[]>`
        INSERT INTO project_file (id, workspace, project_id, path, name, size_bytes, created_at, updated_at)
        VALUES (${crypto.randomUUID()}, ${input.workspace}, ${input.project_id}, ${input.path}, ${input.name}, ${input.size_bytes}, ${input.created_atIfNew}, ${input.updated_at})
        ON CONFLICT (workspace, project_id, path)
        DO UPDATE SET
          name = EXCLUDED.name,
          size_bytes = EXCLUDED.size_bytes,
          updated_at = EXCLUDED.updated_at
        RETURNING *
      `;
      if (!row) throw new DatabaseError('unknown', 'Failed to upsert project file');
      return row;
    } catch (error) {
      return normalizeError(error);
    }
  }

  async createProjectFileIfAbsent(input: Omit<UpsertProjectFileInput, 'updated_at'> & { updated_at: Date }) {
    try {
      const [row] = await this.sql<ProjectFile[]>`
        INSERT INTO project_file (id, workspace, project_id, path, name, size_bytes, created_at, updated_at)
        VALUES (${crypto.randomUUID()}, ${input.workspace}, ${input.project_id}, ${input.path}, ${input.name}, ${input.size_bytes}, ${input.created_atIfNew}, ${input.updated_at})
        ON CONFLICT (workspace, project_id, path) DO NOTHING
        RETURNING *
      `;
      return row ?? null;
    } catch (error) {
      return normalizeError(error);
    }
  }

  async deleteProjectFileByPath(workspace: string, projectId: string, path: string) {
    try {
      const [row] = await this.sql<ProjectFile[]>`
        DELETE FROM project_file
        WHERE workspace = ${workspace} AND project_id = ${projectId} AND path = ${path}
        RETURNING *
      `;
      return row ?? null;
    } catch (error) {
      return normalizeError(error);
    }
  }

  async renameProjectFileFolder(workspace: string, projectId: string, oldPath: string, newPath: string, updated_at: Date) {
    try {
      const rows = await this.sql<{ id: string }[]>`
        UPDATE project_file
        SET path = ${newPath} || substring(path from ${oldPath.length + 1}),
            updated_at = ${updated_at}
        WHERE workspace = ${workspace} AND project_id = ${projectId} AND path LIKE ${`${oldPath}/%`}
        RETURNING id
      `;
      return rows.map(row => row.id);
    } catch (error) {
      return normalizeError(error);
    }
  }

  async deleteProjectFileFolder(workspace: string, projectId: string, folderPath: string) {
    try {
      return await this.sql<ProjectFile[]>`
        DELETE FROM project_file
        WHERE workspace = ${workspace} AND project_id = ${projectId} AND path LIKE ${`${folderPath}/%`}
        RETURNING *
      `;
    } catch (error) {
      return normalizeError(error);
    }
  }

  async listAuditLogs(workspace: string) {
    return await this.sql<AuditLogEntry[]>`
      SELECT *
      FROM audit_log
      WHERE workspace = ${workspace}
      ORDER BY timestamp DESC
    `;
  }

  async createAuditLog(input: CreateAuditLogInput) {
    try {
      const [row] = await this.sql<AuditLogEntry[]>`
        INSERT INTO audit_log (id, workspace, timestamp, user_id, operation, entity_type, entity_id, entity_name, entity_slug, schema_id, changes, metadata)
        VALUES (
          ${crypto.randomUUID()},
          ${input.workspace},
          ${input.timestamp},
          ${input.user_id},
          ${input.operation},
          ${input.entity_type},
          ${input.entity_id},
          ${input.entity_name},
          ${input.entity_slug},
          ${input.schema_id},
          ${this.json(input.changes)},
          ${this.json(input.metadata)}
        )
        RETURNING *
      `;
      if (!row) throw new DatabaseError('unknown', 'Failed to create audit log');
      return row;
    } catch (error) {
      return normalizeError(error);
    }
  }

  async getUser(id: string) {
    const [row] = await this.sql<User[]>`SELECT * FROM users WHERE id = ${id}`;
    return row ?? null;
  }

  async getUserByEmail(email: string) {
    const [row] = await this.sql<User[]>`SELECT * FROM users WHERE email = ${email}`;
    return row ?? null;
  }

  async getUserByOidc(issuer: string, subject: string) {
    const [row] = await this.sql<User[]>`
      SELECT * FROM users
      WHERE oidc_issuer = ${issuer} AND oidc_subject = ${subject}
    `;
    return row ?? null;
  }

  async createUser(input: CreateUserInput) {
    try {
      const [row] = await this.sql<User[]>`
        INSERT INTO users (id, email, display_name, auth_provider, password_hash, oidc_issuer, oidc_subject, is_active, created_at, updated_at, last_login_at)
        VALUES (
          ${input.id},
          ${input.email},
          ${input.display_name},
          ${input.auth_provider},
          ${input.password_hash},
          ${input.oidc_issuer},
          ${input.oidc_subject},
          ${input.is_active},
          ${input.created_at},
          ${input.updated_at},
          ${input.last_login_at}
        )
        RETURNING *
      `;
      if (!row) throw new DatabaseError('unknown', 'Failed to create user');
      return row;
    } catch (error) {
      return normalizeError(error);
    }
  }

  async updateUser(id: string, input: UpdateUserInput) {
    try {
      const sets: Record<string, unknown> = { updated_at: input.updated_at };
      
      if (input.email !== undefined) sets.email = input.email;
      if (input.display_name !== undefined) sets.display_name = input.display_name;
      if (input.password_hash !== undefined) sets.password_hash = input.password_hash;
      if (input.is_active !== undefined) sets.is_active = input.is_active;
      
      const [row] = await this.sql<User[]>`
        UPDATE users
        SET ${this.sql(sets)}
        WHERE id = ${id}
        RETURNING *
      `;
      return row ?? null;
    } catch (error) {
      return normalizeError(error);
    }
  }

  async updateUserLastLogin(id: string, timestamp: Date) {
    try {
      await this.sql`
        UPDATE users
        SET last_login_at = ${timestamp}
        WHERE id = ${id}
      `;
    } catch (error) {
      return normalizeError(error);
    }
  }

  async listUsers() {
    return await this.sql<User[]>`SELECT * FROM users ORDER BY display_name`;
  }

  async listGlobalRoleAssignments(userId?: string) {
    if (userId) {
      return await this.sql<GlobalRoleAssignment[]>`
        SELECT user_id, role, created_at
        FROM global_role_assignment
        WHERE user_id = ${userId}
        ORDER BY role
      `;
    }
    return await this.sql<GlobalRoleAssignment[]>`
      SELECT user_id, role, created_at
      FROM global_role_assignment
      ORDER BY user_id, role
    `;
  }

  async replaceGlobalRoleAssignments(userId: string, roles: GlobalRoleAssignment['role'][], createdAt: Date) {
    try {
      await this.sql.begin(async tx => {
        await tx`DELETE FROM global_role_assignment WHERE user_id = ${userId}`;
        for (const role of roles) {
          await tx`
            INSERT INTO global_role_assignment (user_id, role, created_at)
            VALUES (${userId}, ${role}, ${createdAt})
          `;
        }
      });
      return await this.listGlobalRoleAssignments(userId);
    } catch (error) {
      return normalizeError(error);
    }
  }
}
