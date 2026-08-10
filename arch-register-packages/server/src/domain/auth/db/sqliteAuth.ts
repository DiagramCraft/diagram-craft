import type {
  ApiTokenDbCreate,
  AuthDatabase,
  GlobalRole,
  UserDbCreate,
  UserDbUpdate
} from './authDatabase';
import { authMappers } from './authDatabase';
import { SqliteDatabaseBase } from '../../../db/sqliteBase';
import { DatabaseError } from '../../../db/database';

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

  async listUsersByIds(ids: string[]) {
    if (ids.length === 0) return [];
    const placeholders = ids.map(() => '?').join(', ');
    return this.all(
      `SELECT * FROM users WHERE id IN (${placeholders}) ORDER BY id`,
      ids,
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
    const existing = await this.getUser(id);
    if (existing?.is_system_actor) {
      throw new DatabaseError('check', 'System users cannot be modified', undefined, { id });
    }
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
    if (input.password_hash !== undefined || input.is_active === false) {
      await this.revokeAllRefreshSessionsForUser(id, new Date());
    }
    return await this.getUser(id);
  }

  async updateUserLastLogin(id: string, timestamp: Date) {
    this.run('UPDATE users SET last_login_at = ? WHERE id = ?', [timestamp.toISOString(), id]);
  }

  async listUsers(options?: { q?: string; limit?: number }) {
    const query = options?.q?.trim();
    const limit =
      options?.limit == null
        ? query
          ? 50
          : undefined
        : Math.min(Math.max(Math.trunc(options.limit), 1), 100);
    const pattern = query ? `%${query.replace(/[\\%_]/g, '\\$&')}%` : undefined;
    const clauses = ['1 = 1'];
    const params: unknown[] = [];
    if (pattern != null) {
      clauses.push(
        "(LOWER(display_name) LIKE LOWER(?) ESCAPE '\\' OR LOWER(email) LIKE LOWER(?) ESCAPE '\\')"
      );
      params.push(pattern, pattern);
    }
    const limitClause = limit == null ? '' : ` LIMIT ${limit}`;
    return this.all(
      `SELECT * FROM users WHERE ${clauses.join(' AND ')} ORDER BY display_name, id${limitClause}`,
      params,
      authMappers.user
    );
  }

  async createRefreshSession(input: Parameters<AuthDatabase['createRefreshSession']>[0]) {
    this.run(
      'INSERT INTO auth_refresh_session (id, family_id, user_id, token_hash, issued_at, expires_at, consumed_at, replaced_by, revoked_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        input.id,
        input.family_id,
        input.user_id,
        input.token_hash,
        input.issued_at.toISOString(),
        input.expires_at.toISOString(),
        input.consumed_at?.toISOString() ?? null,
        input.replaced_by,
        input.revoked_at?.toISOString() ?? null
      ]
    );
    return (await this.get(
      'SELECT * FROM auth_refresh_session WHERE id = ?',
      [input.id],
      authMappers.refreshSession
    ))!;
  }

  async getRefreshSessionByTokenHash(tokenHash: string) {
    return this.get(
      'SELECT * FROM auth_refresh_session WHERE token_hash = ?',
      [tokenHash],
      authMappers.refreshSession
    );
  }

  async consumeRefreshSession(id: string, consumedAt: Date, replacedBy: string) {
    const result = this.run(
      'UPDATE auth_refresh_session SET consumed_at = ?, replaced_by = ? WHERE id = ? AND consumed_at IS NULL AND revoked_at IS NULL',
      [consumedAt.toISOString(), replacedBy, id]
    );
    return result.changes === 1;
  }

  async revokeRefreshSessionFamily(familyId: string, revokedAt: Date) {
    this.run(
      'UPDATE auth_refresh_session SET revoked_at = COALESCE(revoked_at, ?) WHERE family_id = ? AND revoked_at IS NULL',
      [revokedAt.toISOString(), familyId]
    );
  }

  async revokeAllRefreshSessionsForUser(userId: string, revokedAt: Date) {
    this.run(
      'UPDATE auth_refresh_session SET revoked_at = COALESCE(revoked_at, ?) WHERE user_id = ? AND revoked_at IS NULL',
      [revokedAt.toISOString(), userId]
    );
  }

  async cleanupExpiredRefreshSessions(now: Date) {
    this.run('DELETE FROM auth_refresh_session WHERE expires_at < ?', [now.toISOString()]);
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

  async listApiTokens(workspace: string, createdBy?: string) {
    if (createdBy != null) {
      return this.all(
        'SELECT * FROM api_token WHERE workspace = ? AND created_by = ? ORDER BY created_at DESC, id DESC',
        [workspace, createdBy],
        authMappers.apiToken
      );
    }
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

  async deleteApiToken(workspace: string, id: string, createdBy?: string) {
    if (createdBy != null) {
      const existing = this.get(
        'SELECT * FROM api_token WHERE workspace = ? AND id = ? AND created_by = ?',
        [workspace, id, createdBy],
        authMappers.apiToken
      );
      if (!existing) return null;
      this.run('DELETE FROM api_token WHERE workspace = ? AND id = ? AND created_by = ?', [
        workspace,
        id,
        createdBy
      ]);
      return existing;
    }

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
