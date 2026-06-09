import type { AuthProvider, GlobalRole } from '../../../types';

// -- Global Role Assignment

export type GlobalRoleAssignmentRow = {
  user_id: string;
  role: GlobalRole;
  created_at: Date;
};

// -- User

export type UserRow = {
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

export type CreateUserInput = Omit<
  UserRow,
  'user_id' | 'created_at' | 'updated_at' | 'last_login_at'
> & {
  user_id?: string;
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

export type AuthDatabase = {
  getUser(id: string): Promise<UserRow | null>;
  getUserByUserId(userId: string): Promise<UserRow | null>;
  getUserByEmail(email: string): Promise<UserRow | null>;
  getUserByOidc(issuer: string, subject: string): Promise<UserRow | null>;
  createUser(input: CreateUserInput): Promise<UserRow>;
  updateUser(id: string, input: UpdateUserInput): Promise<UserRow | null>;
  updateUserLastLogin(id: string, timestamp: Date): Promise<void>;
  listUsers(): Promise<UserRow[]>;

  listGlobalRoleAssignments(userId?: string): Promise<GlobalRoleAssignmentRow[]>;
  replaceGlobalRoleAssignments(
    userId: string,
    roles: GlobalRole[],
    createdAt: Date
  ): Promise<GlobalRoleAssignmentRow[]>;

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
