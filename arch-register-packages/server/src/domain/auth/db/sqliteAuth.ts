import type {
  ApiTokenDbCreate,
  AuthDatabase,
  GlobalRole,
  UserDbCreate,
  UserDbUpdate
} from './authDatabase';
import { authMappers } from './authDatabase';
import { SqliteDatabaseBase } from '../../../db/sqliteBase';

export class SqliteAuthDatabase extends SqliteDatabaseBase implements AuthDatabase {
  async getUser(id: string) {
    return this.get('SELECT * FROM users WHERE id = ?', [id], authMappers.user);
  }

  async getUserByUserId(userId: string) {
    return this.get('SELECT * FROM users WHERE user_id = ?', [userId], authMappers.user);
  }

  async getUserByEmail(email: string) {
    return this.get('SELECT * FROM users WHERE email = ?', [email], authMappers.user);
  }

  async getUserByOidc(issuer: string, subject: string) {
    return this.get(
      'SELECT * FROM users WHERE oidc_issuer = ? AND oidc_subject = ?',
      [issuer, subject],
      authMappers.user
    );
  }

  async createUser(input: UserDbCreate) {
    this.run(
      'INSERT INTO users (id, user_id, email, display_name, auth_provider, password_hash, oidc_issuer, oidc_subject, is_active, color, created_at, updated_at, last_login_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        input.id,
        input.user_id ?? input.id,
        input.email,
        input.display_name,
        input.auth_provider,
        input.password_hash,
        input.oidc_issuer,
        input.oidc_subject,
        input.is_active ? 1 : 0,
        input.color,
        input.created_at.toISOString(),
        input.updated_at.toISOString(),
        input.last_login_at?.toISOString() ?? null
      ]
    );
    return (await this.getUser(input.id))!;
  }

  async updateUser(id: string, input: UserDbUpdate) {
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
    if (input.color !== undefined) {
      sets.push('color = ?');
      values.push(input.color);
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
    return this.all('SELECT * FROM users ORDER BY display_name', [], authMappers.user);
  }

  async createApiToken(input: ApiTokenDbCreate) {
    this.run(
      'INSERT INTO api_token (id, workspace, name, token_hash, capabilities, created_by, created_at, last_used_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        input.id,
        input.workspace,
        input.name,
        input.token_hash,
        JSON.stringify(input.capabilities),
        input.created_by,
        input.created_at.toISOString(),
        input.last_used_at?.toISOString() ?? null,
        input.expires_at?.toISOString() ?? null
      ]
    );
    return (await this.get(
      'SELECT * FROM api_token WHERE id = ?',
      [input.id],
      authMappers.apiToken
    ))!;
  }

  async listApiTokens(workspace: string) {
    return this.all(
      'SELECT * FROM api_token WHERE workspace = ? ORDER BY created_at DESC, id DESC',
      [workspace],
      authMappers.apiToken
    );
  }

  async countApiTokens(workspace: string, createdBy: string) {
    const row = this.get<{ count: number }>(
      'SELECT COUNT(*) AS count FROM api_token WHERE workspace = ? AND created_by = ?',
      [workspace, createdBy]
    );
    return Number(row?.count ?? 0);
  }

  async listApiTokensByCreator(createdBy: string) {
    return this.all(
      'SELECT * FROM api_token WHERE created_by = ? ORDER BY workspace, created_at DESC, id DESC',
      [createdBy],
      authMappers.apiToken
    );
  }

  async getApiTokenByHash(tokenHash: string) {
    return this.get(
      'SELECT * FROM api_token WHERE token_hash = ?',
      [tokenHash],
      authMappers.apiToken
    );
  }

  async deleteApiToken(workspace: string, id: string) {
    const existing = this.get(
      'SELECT * FROM api_token WHERE workspace = ? AND id = ?',
      [workspace, id],
      authMappers.apiToken
    );
    if (!existing) return null;
    this.run('DELETE FROM api_token WHERE workspace = ? AND id = ?', [workspace, id]);
    return existing;
  }

  async deleteApiTokenByCreator(createdBy: string, id: string) {
    const existing = this.get(
      'SELECT * FROM api_token WHERE created_by = ? AND id = ?',
      [createdBy, id],
      authMappers.apiToken
    );
    if (!existing) return null;
    this.run('DELETE FROM api_token WHERE created_by = ? AND id = ?', [createdBy, id]);
    return existing;
  }

  async updateApiTokenLastUsed(id: string, timestamp: Date) {
    this.run('UPDATE api_token SET last_used_at = ? WHERE id = ?', [timestamp.toISOString(), id]);
  }

  async createApiTokenAudit(input: Parameters<AuthDatabase['createApiTokenAudit']>[0]) {
    this.run(
      'INSERT INTO api_token_audit (id, workspace, token_id, user_id, event, created_at, metadata) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [
        input.id,
        input.workspace,
        input.token_id,
        input.user_id,
        input.event,
        input.created_at.toISOString(),
        JSON.stringify(input.metadata)
      ]
    );
    return (await this.get(
      'SELECT * FROM api_token_audit WHERE id = ?',
      [input.id],
      authMappers.apiTokenAudit
    ))!;
  }

  async listApiTokenAudit(workspace: string) {
    return this.all(
      'SELECT * FROM api_token_audit WHERE workspace = ? ORDER BY created_at DESC, id DESC',
      [workspace],
      authMappers.apiTokenAudit
    );
  }

  async listGlobalRoleAssignments(userId?: string) {
    if (userId) {
      return this.all(
        'SELECT user_id, role, created_at FROM global_role_assignment WHERE user_id = ? ORDER BY role',
        [userId],
        authMappers.globalRoleAssignment
      );
    }

    return this.all(
      'SELECT user_id, role, created_at FROM global_role_assignment ORDER BY user_id, role',
      [],
      authMappers.globalRoleAssignment
    );
  }

  async replaceGlobalRoleAssignments(userId: string, roles: GlobalRole[], createdAt: Date) {
    const tx = this.db.transaction(() => {
      this.run('DELETE FROM global_role_assignment WHERE user_id = ?', [userId]);
      for (const role of roles) {
        this.run(
          'INSERT INTO global_role_assignment (user_id, role, created_at) VALUES (?, ?, ?)',
          [userId, role, createdAt.toISOString()]
        );
      }
    });

    tx();
    return await this.listGlobalRoleAssignments(userId);
  }

  async storeOidcAuthState(state: string, nonce: string, codeVerifier: string, expiresAt: Date) {
    this.run(
      'INSERT INTO oidc_auth_state (state, nonce, code_verifier, expires_at) VALUES (?, ?, ?, ?)',
      [state, nonce, codeVerifier, expiresAt.toISOString()]
    );
  }

  async getOidcAuthState(state: string) {
    const row = this.get(
      'SELECT nonce, code_verifier FROM oidc_auth_state WHERE state = ?',
      [state],
      (row: Record<string, unknown>) => ({
        nonce: row.nonce as string,
        code_verifier: row.code_verifier as string
      })
    );
    return row;
  }

  async deleteOidcAuthState(state: string) {
    this.run('DELETE FROM oidc_auth_state WHERE state = ?', [state]);
  }

  async cleanupExpiredOidcAuthStates() {
    this.run('DELETE FROM oidc_auth_state WHERE expires_at < ?', [new Date().toISOString()]);
  }
}
