import type { Database as DatabaseType } from 'better-sqlite3';
import type {
  AiConversation,
  AiMessage,
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
  UserNotification,
  UserPinnedEntity,
  UserWatch,
  Workspace,
  WorkspaceAiConfig,
  WorkspaceEnum,
  WorkspaceLifecycleState,
  WorkspaceRoleDefinition,
  WorkspaceOwner,
  SavedView
} from '../types';
import { SQLITE_ERROR_PATTERNS } from '../constants';
import { DatabaseError } from './database';

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
    color: String(row['color'] ?? ''),
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
    name: String(row['name']),
    sort_order: Number(row['sort_order']),
    color: row['color'] == null ? null : String(row['color']),
    description: String(row['description']),
    created_at: toDate(row['created_at'])
  }),
  schema: (row: Record<string, unknown>): EntitySchema => ({
    id: String(row['id']),
    workspace: String(row['workspace']),
    name: String(row['name']),
    description: String(row['description'] ?? ''),
    fields: parseJson(row['fields'], []),
    color: row['color'] == null ? null : String(row['color']),
    icon: row['icon'] == null ? null : String(row['icon']),
    default_owner: row['default_owner'] == null ? null : String(row['default_owner']),
    created_at: toDate(row['created_at']),
    updated_at: toDate(row['updated_at'])
  }),
  workspaceEnum: (row: Record<string, unknown>): WorkspaceEnum => ({
    id: String(row['id']),
    workspace: String(row['workspace']),
    name: String(row['name']),
    options: parseJson(row['options'], []),
    sort_order: Number(row['sort_order'] ?? 0),
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
    target_lifecycle: row['target_lifecycle'] == null ? null : String(row['target_lifecycle']),
    target_lifecycle_date: row['target_lifecycle_date'] == null ? null : String(row['target_lifecycle_date']),
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
    color: row['color'] == null ? null : String(row['color']),
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
    comment_count: Number(row['comment_count'] ?? 0),
    unresolved_comment_count: Number(row['unresolved_comment_count'] ?? 0),
    is_template: Boolean(row['is_template']),
    is_workspace_template: Boolean(row['is_workspace_template']),
    preview_svg: row['preview_svg'] == null ? null : String(row['preview_svg']),
    created_at: toDate(row['created_at']),
    updated_at: toDate(row['updated_at'])
  }),
  auditLog: (row: Record<string, unknown>): AuditLogEntry => ({
    id: String(row['id']),
    workspace: String(row['workspace']),
    timestamp: toDate(row['timestamp']),
    user_id: row['user_id'] == null ? null : String(row['user_id']),
    operation: row['operation'] as AuditLogEntry['operation'],
    entity_type: row['entity_type'] as AuditLogEntry['entity_type'],
    entity_id: String(row['entity_id']),
    entity_name: String(row['entity_name']),
    entity_slug: row['entity_slug'] == null ? null : String(row['entity_slug']),
    schema_id: row['schema_id'] == null ? null : String(row['schema_id']),
    changes: parseJson(row['changes'], {}),
    metadata: parseJson(row['metadata'], {})
  }),
  userWatch: (row: Record<string, unknown>): UserWatch => ({
    user_id: String(row['user_id']),
    workspace: String(row['workspace']),
    entity_id: String(row['entity_id']),
    created_at: toDate(row['created_at'])
  }),
  userPinnedEntity: (row: Record<string, unknown>): UserPinnedEntity => ({
    user_id: String(row['user_id']),
    workspace: String(row['workspace']),
    entity_id: String(row['entity_id']),
    created_at: toDate(row['created_at'])
  }),
  userNotification: (row: Record<string, unknown>): UserNotification => ({
    id: String(row['id']),
    user_id: String(row['user_id']),
    workspace: String(row['workspace']),
    entity_id: String(row['entity_id']),
    audit_log_id: String(row['audit_log_id']),
    operation: row['operation'] as UserNotification['operation'],
    entity_name: String(row['entity_name']),
    entity_slug: String(row['entity_slug']),
    schema_id: row['schema_id'] == null ? null : String(row['schema_id']),
    changed_by_user_id: String(row['changed_by_user_id']),
    changed_by_display_name: String(row['changed_by_display_name']),
    timestamp: toDate(row['timestamp']),
    created_at: toDate(row['created_at'])
  }),
  user: (row: Record<string, unknown>): User => ({
    id: String(row['id']),
    user_id: String(row['user_id']),
    email: row['email'] == null ? null : String(row['email']),
    display_name: String(row['display_name']),
    auth_provider: String(row['auth_provider']) as User['auth_provider'],
    password_hash: row['password_hash'] == null ? null : String(row['password_hash']),
    oidc_issuer: row['oidc_issuer'] == null ? null : String(row['oidc_issuer']),
    oidc_subject: row['oidc_subject'] == null ? null : String(row['oidc_subject']),
    is_active: Boolean(row['is_active']),
    color: row['color'] == null ? null : String(row['color']),
    created_at: toDate(row['created_at']),
    updated_at: toDate(row['updated_at']),
    last_login_at: row['last_login_at'] == null ? null : toDate(row['last_login_at'])
  }),
  teamMembership: (row: Record<string, unknown>): TeamMembership => ({
    workspace: String(row['workspace']),
    team_id: String(row['team_id']),
    user_id: String(row['user_id']),
    role: String(row['role']) as TeamMembership['role'],
    created_at: toDate(row['created_at'])
  }),
  globalRoleAssignment: (row: Record<string, unknown>): GlobalRoleAssignment => ({
    user_id: String(row['user_id']),
    role: String(row['role']) as GlobalRoleAssignment['role'],
    created_at: toDate(row['created_at'])
  }),
  workspaceRoleDefinition: (row: Record<string, unknown>): WorkspaceRoleDefinition => ({
    id: String(row['id']),
    workspace: String(row['workspace']),
    name: String(row['name']),
    description: String(row['description']),
    tone: String(row['tone']),
    builtin: Boolean(row['builtin']),
    capabilities: parseJson<WorkspaceRoleDefinition['capabilities']>(row['capabilities'], []),
    created_at: toDate(row['created_at']),
    updated_at: toDate(row['updated_at'])
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
  }),
  savedView: (row: Record<string, unknown>): SavedView => ({
    id: String(row['id']),
    workspace: String(row['workspace']),
    name: String(row['name']),
    description: row['description'] == null ? null : String(row['description']),
    view_mode: String(row['view_mode']) as SavedView['view_mode'],
    filters: parseJson(row['filters'], {}),
    config: parseJson(row['config'], null),
    created_at: toDate(row['created_at']),
    updated_at: toDate(row['updated_at'])
  }),
  aiConfig: (row: Record<string, unknown>): WorkspaceAiConfig => ({
    workspace: String(row['workspace']),
    provider: String(row['provider']) as WorkspaceAiConfig['provider'],
    api_key_enc: row['api_key_enc'] == null ? null : String(row['api_key_enc']),
    base_url: row['base_url'] == null ? null : String(row['base_url']),
    model: row['model'] == null ? null : String(row['model']),
    temperature: row['temperature'] == null ? null : Number(row['temperature']),
    system_prompt: row['system_prompt'] == null ? null : String(row['system_prompt']),
    enabled: Boolean(row['enabled']),
    created_at: toDate(row['created_at']),
    updated_at: toDate(row['updated_at'])
  }),
  aiConversation: (row: Record<string, unknown>): AiConversation => ({
    id: String(row['id']),
    workspace: String(row['workspace']),
    user_id: String(row['user_id']),
    title: String(row['title']),
    created_at: toDate(row['created_at']),
    updated_at: toDate(row['updated_at'])
  }),
  aiMessage: (row: Record<string, unknown>): AiMessage => ({
    id: String(row['id']),
    conversation_id: String(row['conversation_id']),
    role: String(row['role']) as AiMessage['role'],
    content: String(row['content']),
    metadata: parseJson(row['metadata'], {}),
    created_at: toDate(row['created_at'])
  })
};

export class SqliteDatabaseBase {
  constructor(private readonly getDb: () => DatabaseType) {}

  protected get db() {
    return this.getDb();
  }

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
