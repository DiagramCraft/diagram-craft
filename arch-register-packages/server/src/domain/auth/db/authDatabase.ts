import type { AuthProvider } from '../../../types';
import {
  databaseDate,
  databaseBoolean,
  parseDatabaseJson,
  type DatabaseRow
} from '../../../db/rowMappers';

// -- Global Role Assignment

export type GlobalRoleAssignmentDbResult = {
  user_id: string;
  role: GlobalRole;
  created_at: Date;
};

export type GlobalRole = 'global_admin' | 'workspace_admin';

// -- User

export type UserDbResult = {
  id: string;
  user_id: string;
  email: string | null;
  display_name: string;
  auth_provider: AuthProvider;
  password_hash: string | null;
  oidc_issuer: string | null;
  oidc_subject: string | null;
  is_active: boolean;
  is_system_actor: boolean;
  color: string | null;
  created_at: Date;
  updated_at: Date;
  last_login_at: Date | null;
};

export type UserDbCreate = Omit<
  UserDbResult,
  'user_id' | 'created_at' | 'updated_at' | 'last_login_at' | 'is_system_actor'
> & {
  user_id?: string;
  is_system_actor?: boolean;
  created_at: Date;
  updated_at: Date;
  last_login_at: Date | null;
};

export type UserDbUpdate = {
  email?: string | null;
  display_name?: string;
  password_hash?: string | null;
  is_active?: boolean;
  color?: string | null;
  updated_at: Date;
};

export type UserListOptions = {
  q?: string;
  limit?: number;
};

export type ApiTokenDbResult = {
  id: string;
  workspace: string;
  name: string;
  token_hash: string;
  capabilities: string[];
  created_by: string;
  created_at: Date;
  last_used_at: Date | null;
  expires_at: Date | null;
};

export type ApiTokenDbCreate = Omit<ApiTokenDbResult, 'last_used_at'> & {
  last_used_at?: Date | null;
};

export type ApiTokenAuditEvent = 'created' | 'revoked' | 'used';

export type ApiTokenAuditDbResult = {
  id: string;
  workspace: string;
  token_id: string;
  user_id: string | null;
  event: ApiTokenAuditEvent;
  created_at: Date;
  metadata: Record<string, unknown>;
};

export const authMappers = {
  user: (row: DatabaseRow): UserDbResult => ({
    id: String(row['id']),
    user_id: String(row['user_id']),
    email: row['email'] == null ? null : String(row['email']),
    display_name: String(row['display_name']),
    auth_provider: String(row['auth_provider']) as UserDbResult['auth_provider'],
    password_hash: row['password_hash'] == null ? null : String(row['password_hash']),
    oidc_issuer: row['oidc_issuer'] == null ? null : String(row['oidc_issuer']),
    oidc_subject: row['oidc_subject'] == null ? null : String(row['oidc_subject']),
    is_active: databaseBoolean(row['is_active']),
    is_system_actor: databaseBoolean(row['is_system_actor']),
    color: row['color'] == null ? null : String(row['color']),
    created_at: databaseDate(row['created_at']),
    updated_at: databaseDate(row['updated_at']),
    last_login_at: row['last_login_at'] == null ? null : databaseDate(row['last_login_at'])
  }),
  globalRoleAssignment: (row: DatabaseRow): GlobalRoleAssignmentDbResult => ({
    user_id: String(row['user_id']),
    role: String(row['role']) as GlobalRoleAssignmentDbResult['role'],
    created_at: databaseDate(row['created_at'])
  }),
  apiToken: (row: DatabaseRow): ApiTokenDbResult => ({
    id: String(row['id']),
    workspace: String(row['workspace']),
    name: String(row['name']),
    token_hash: String(row['token_hash']),
    capabilities: parseDatabaseJson<string[]>(row['capabilities'], [], 'api_token.capabilities'),
    created_by: String(row['created_by']),
    created_at: databaseDate(row['created_at']),
    last_used_at: row['last_used_at'] == null ? null : databaseDate(row['last_used_at']),
    expires_at: row['expires_at'] == null ? null : databaseDate(row['expires_at'])
  }),
  apiTokenAudit: (row: DatabaseRow): ApiTokenAuditDbResult => ({
    id: String(row['id']),
    workspace: String(row['workspace']),
    token_id: String(row['token_id']),
    user_id: row['user_id'] == null ? null : String(row['user_id']),
    event: row['event'] as ApiTokenAuditEvent,
    created_at: databaseDate(row['created_at']),
    metadata: parseDatabaseJson(row['metadata'], {}, 'api_token_audit.metadata')
  })
};

export type AuthDatabase = {
  getUser(id: string): Promise<UserDbResult | null>;
  getUserByUserId(userId: string): Promise<UserDbResult | null>;
  getUserByEmail(email: string): Promise<UserDbResult | null>;
  getUserByOidc(issuer: string, subject: string): Promise<UserDbResult | null>;
  createUser(input: UserDbCreate): Promise<UserDbResult>;
  updateUser(id: string, input: UserDbUpdate): Promise<UserDbResult | null>;
  updateUserLastLogin(id: string, timestamp: Date): Promise<void>;
  listUsers(options?: UserListOptions): Promise<UserDbResult[]>;

  createApiToken(input: ApiTokenDbCreate): Promise<ApiTokenDbResult>;
  listApiTokens(workspace: string, createdBy?: string): Promise<ApiTokenDbResult[]>;
  countApiTokens(workspace: string, createdBy: string): Promise<number>;
  listApiTokensByCreator(createdBy: string): Promise<ApiTokenDbResult[]>;
  getApiTokenByHash(tokenHash: string): Promise<ApiTokenDbResult | null>;
  deleteApiToken(
    workspace: string,
    id: string,
    createdBy?: string
  ): Promise<ApiTokenDbResult | null>;
  deleteApiTokenByCreator(createdBy: string, id: string): Promise<ApiTokenDbResult | null>;
  updateApiTokenLastUsed(id: string, timestamp: Date): Promise<void>;
  createApiTokenAudit(input: ApiTokenAuditDbResult): Promise<ApiTokenAuditDbResult>;
  listApiTokenAudit(workspace: string): Promise<ApiTokenAuditDbResult[]>;

  listGlobalRoleAssignments(userId?: string): Promise<GlobalRoleAssignmentDbResult[]>;
  replaceGlobalRoleAssignments(
    userId: string,
    roles: GlobalRole[],
    createdAt: Date
  ): Promise<GlobalRoleAssignmentDbResult[]>;

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
