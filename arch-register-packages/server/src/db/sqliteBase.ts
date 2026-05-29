import type { Database as DatabaseType } from 'better-sqlite3';
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
  WorkspaceOwner
} from '../types.js';
import { SQLITE_ERROR_PATTERNS } from '../constants.js';
import { DatabaseError } from './database.js';

const parseJson = <T>(value: unknown, fallback: T): T => {
  if (typeof value !== 'string' || value === '') return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

const toDate = (value: unknown) => new Date(String(value));

export const normalizeSqliteError = (error: unknown): never => {
  if (error != null && typeof error === 'object' && 'code' in error) {
    const code = String((error as { code: unknown }).code);
    if (code.includes(SQLITE_ERROR_PATTERNS.UNIQUE))
      throw new DatabaseError('unique', 'Unique constraint violation', error);
    if (code.includes(SQLITE_ERROR_PATTERNS.FOREIGN_KEY))
      throw new DatabaseError('foreign', 'Foreign key constraint violation', error);
    if (code.includes(SQLITE_ERROR_PATTERNS.CHECK))
      throw new DatabaseError('check', 'Check constraint violation', error);
    if (code.includes(SQLITE_ERROR_PATTERNS.NOT_NULL))
      throw new DatabaseError('notnull', 'Not null constraint violation', error);
  }
  throw new DatabaseError('unknown', 'Database operation failed', error);
};

export const sqliteMappers = {
  workspace: (row: Record<string, unknown>): Workspace => ({
    id: String(row['id']),
    name: String(row['name']),
    url_slug: String(row['url_slug']),
    short_code: String(row['short_code']),
    description: String(row['description']),
    created_at: toDate(row['created_at']),
    updated_at: toDate(row['updated_at'])
  }),
  lifecycleState: (row: Record<string, unknown>): WorkspaceLifecycleState => ({
    id: String(row['id']),
    workspace: String(row['workspace']),
    label: String(row['label']),
    color: String(row['color']),
    sort_order: Number(row['sort_order']),
    created_at: toDate(row['created_at'])
  }),
  owner: (row: Record<string, unknown>): WorkspaceOwner => ({
    id: String(row['id']),
    workspace: String(row['workspace']),
    sort_order: Number(row['sort_order']),
    created_at: toDate(row['created_at'])
  }),
  schema: (row: Record<string, unknown>): EntitySchema => ({
    id: String(row['id']),
    workspace: String(row['workspace']),
    name: String(row['name']),
    fields: parseJson(row['fields'], []),
    color: row['color'] == null ? null : String(row['color']),
    icon: row['icon'] == null ? null : String(row['icon']),
    default_owner: row['default_owner'] == null ? null : String(row['default_owner']),
    created_at: toDate(row['created_at']),
    updated_at: toDate(row['updated_at'])
  }),
  entity: (row: Record<string, unknown>): Entity => ({
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
    visibility_mode:
      row['visibility_mode'] == null
        ? null
        : (String(row['visibility_mode']) as Entity['visibility_mode']),
    created_at: toDate(row['created_at']),
    updated_at: toDate(row['updated_at'])
  }),
  project: (row: Record<string, unknown>): Project => ({
    id: String(row['id']),
    workspace: String(row['workspace']),
    name: String(row['name']),
    description: String(row['description']),
    owner: row['owner'] == null ? null : String(row['owner']),
    status: String(row['status']) as Project['status'],
    created_at: toDate(row['created_at']),
    updated_at: toDate(row['updated_at'])
  }),
  projectFile: (row: Record<string, unknown>): ProjectFile => ({
    id: String(row['id']),
    workspace: String(row['workspace']),
    project_id: String(row['project_id']),
    path: String(row['path']),
    name: String(row['name']),
    size_bytes: Number(row['size_bytes']),
    created_at: toDate(row['created_at']),
    updated_at: toDate(row['updated_at'])
  }),
  auditLog: (row: Record<string, unknown>): AuditLogEntry => ({
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
    metadata: parseJson(row['metadata'], {})
  }),
  user: (row: Record<string, unknown>): User => ({
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
    last_login_at: row['last_login_at'] == null ? null : toDate(row['last_login_at'])
  }),
  teamMembership: (row: Record<string, unknown>): TeamMembership => ({
    workspace: String(row['workspace']),
    team_id: String(row['team_id']),
    user_id: String(row['user_id']),
    created_at: toDate(row['created_at'])
  }),
  globalRoleAssignment: (row: Record<string, unknown>): GlobalRoleAssignment => ({
    user_id: String(row['user_id']),
    role: String(row['role']) as GlobalRoleAssignment['role'],
    created_at: toDate(row['created_at'])
  }),
  entityGrant: (row: Record<string, unknown>): EntityGrant => ({
    id: String(row['id']),
    workspace: String(row['workspace']),
    entity_id: String(row['entity_id']),
    principal_type: String(row['principal_type']) as EntityGrant['principal_type'],
    principal_id: String(row['principal_id']),
    role: String(row['role']) as EntityGrant['role'],
    applies_to: String(row['applies_to']) as EntityGrant['applies_to'],
    created_at: toDate(row['created_at'])
  })
};

export class SqliteDatabaseBase {
  constructor(protected db: DatabaseType) {}

  protected all<T>(
    sql: string,
    params: unknown[] = [],
    map?: (row: Record<string, unknown>) => T
  ): T[] {
    try {
      const rows = this.db.prepare(sql).all(...params) as Record<string, unknown>[];
      return map ? rows.map(map) : (rows as T[]);
    } catch (error) {
      return normalizeSqliteError(error);
    }
  }

  protected get<T>(
    sql: string,
    params: unknown[] = [],
    map?: (row: Record<string, unknown>) => T
  ): T | null {
    try {
      const row = this.db.prepare(sql).get(...params) as Record<string, unknown> | undefined;
      if (!row) return null;
      return map ? map(row) : (row as T);
    } catch (error) {
      return normalizeSqliteError(error);
    }
  }

  protected run(sql: string, params: unknown[] = []) {
    try {
      return this.db.prepare(sql).run(...params);
    } catch (error) {
      return normalizeSqliteError(error);
    }
  }
}