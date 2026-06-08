import type {
  GlobalRole,
  GlobalRoleAssignment,
  User
} from '../../../types';

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

export type AuthDatabase = {
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
