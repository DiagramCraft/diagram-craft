import type { AuthProvider } from '../../../types';
import { databaseDate, databaseBoolean, type DatabaseRow } from '../../../db/rowMappers';

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
  color: string | null;
  created_at: Date;
  updated_at: Date;
  last_login_at: Date | null;
};

export type UserDbCreate = Omit<
  UserDbResult,
  'user_id' | 'created_at' | 'updated_at' | 'last_login_at'
> & {
  user_id?: string;
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
    color: row['color'] == null ? null : String(row['color']),
    created_at: databaseDate(row['created_at']),
    updated_at: databaseDate(row['updated_at']),
    last_login_at: row['last_login_at'] == null ? null : databaseDate(row['last_login_at'])
  }),
  globalRoleAssignment: (row: DatabaseRow): GlobalRoleAssignmentDbResult => ({
    user_id: String(row['user_id']),
    role: String(row['role']) as GlobalRoleAssignmentDbResult['role'],
    created_at: databaseDate(row['created_at'])
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
  listUsers(): Promise<UserDbResult[]>;

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
