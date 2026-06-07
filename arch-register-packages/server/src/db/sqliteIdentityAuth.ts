import type { CreateUserInput, IdentityAuthDatabase, UpdateUserInput } from './database';
import { SqliteDatabaseBase, sqliteMappers } from './sqliteBase';
import type { GlobalRole } from '../types';

export class SqliteIdentityAuthDatabase extends SqliteDatabaseBase implements IdentityAuthDatabase {
  async getUser(id: string) {
    return this.get('SELECT * FROM users WHERE id = ?', [id], sqliteMappers.user);
  }

  async getUserByEmail(email: string) {
    return this.get('SELECT * FROM users WHERE email = ?', [email], sqliteMappers.user);
  }

  async getUserByOidc(issuer: string, subject: string) {
    return this.get(
      'SELECT * FROM users WHERE oidc_issuer = ? AND oidc_subject = ?',
      [issuer, subject],
      sqliteMappers.user
    );
  }

  async createUser(input: CreateUserInput) {
    this.run(
      'INSERT INTO users (id, email, display_name, auth_provider, password_hash, oidc_issuer, oidc_subject, is_active, color, created_at, updated_at, last_login_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        input.id,
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
    return this.all('SELECT * FROM users ORDER BY display_name', [], sqliteMappers.user);
  }

  async listGlobalRoleAssignments(userId?: string) {
    if (userId) {
      return this.all(
        'SELECT user_id, role, created_at FROM global_role_assignment WHERE user_id = ? ORDER BY role',
        [userId],
        sqliteMappers.globalRoleAssignment
      );
    }

    return this.all(
      'SELECT user_id, role, created_at FROM global_role_assignment ORDER BY user_id, role',
      [],
      sqliteMappers.globalRoleAssignment
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
