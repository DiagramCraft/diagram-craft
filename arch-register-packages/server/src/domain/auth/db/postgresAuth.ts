import type {
  ApiTokenDbCreate,
  AuthDatabase,
  UserDbCreate,
  GlobalRole,
  UserDbUpdate,
  UserListOptions
} from './authDatabase';
import { authMappers } from './authDatabase';
import { normalizePostgresError, PostgresDatabaseBase } from '../../../db/postgresBase';
import { mapDatabaseRows, type DatabaseRow } from '../../../db/rowMappers';
import { DatabaseError } from '../../../db/database';

export class PostgresAuthDatabase extends PostgresDatabaseBase implements AuthDatabase {
  async getUser(id: string) {
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!UUID_RE.test(id)) return null;
    const [row] = await this.sql<DatabaseRow[]>`
      SELECT * FROM users WHERE id = ${id}
    `;
    return row ? authMappers.user(row) : null;
  }

  async getUserByUserId(userId: string) {
    const [row] = await this.sql<DatabaseRow[]>`
      SELECT * FROM users WHERE user_id = ${userId}
    `;
    return row ? authMappers.user(row) : null;
  }

  async getUserByEmail(email: string) {
    const [row] = await this.sql<DatabaseRow[]>`
      SELECT * FROM users WHERE email = ${email}
    `;
    return row ? authMappers.user(row) : null;
  }

  async getUserByOidc(issuer: string, subject: string) {
    const [row] = await this.sql<DatabaseRow[]>`
      SELECT * FROM users
      WHERE oidc_issuer = ${issuer} AND oidc_subject = ${subject}
    `;
    return row ? authMappers.user(row) : null;
  }

  async createUser(input: UserDbCreate) {
    try {
      const [row] = await this.sql<DatabaseRow[]>`
        INSERT INTO users (id, user_id, email, display_name, auth_provider, password_hash, oidc_issuer, oidc_subject, is_active, color, created_at, updated_at, last_login_at)
        VALUES (
          ${input.id},
          ${input.user_id ?? input.id},
          ${input.email ?? null},
          ${input.display_name},
          ${input.auth_provider},
          ${input.password_hash ?? null},
          ${input.oidc_issuer ?? null},
          ${input.oidc_subject ?? null},
          ${input.is_active},
          ${input.color ?? null},
          ${input.created_at},
          ${input.updated_at},
          ${input.last_login_at ?? null}
        )
        RETURNING *
      `;
      return authMappers.user(row!);
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async updateUser(id: string, input: UserDbUpdate) {
    const existing = await this.getUser(id);
    if (existing?.is_system_actor) {
      throw new DatabaseError('check', 'System users cannot be modified', undefined, { id });
    }
    try {
      const sets: Record<string, unknown> = { updated_at: input.updated_at };

      if (input.email !== undefined) sets.email = input.email;
      if (input.display_name !== undefined) sets.display_name = input.display_name;
      if (input.password_hash !== undefined) sets.password_hash = input.password_hash;
      if (input.is_active !== undefined) sets.is_active = input.is_active;
      if (input.color !== undefined) sets.color = input.color;

      const [row] = await this.sql<DatabaseRow[]>`
        UPDATE users
        SET ${this.sql(sets)}
        WHERE id = ${id}
        RETURNING *
      `;
      return row ? authMappers.user(row) : null;
    } catch (error) {
      return normalizePostgresError(error);
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
      return normalizePostgresError(error);
    }
  }

  async listUsers(options?: UserListOptions) {
    const query = options?.q?.trim();
    const limit =
      options?.limit == null
        ? query
          ? 50
          : undefined
        : Math.min(Math.max(Math.trunc(options.limit), 1), 100);
    const pattern = query ? `%${query.replace(/[\\%_]/g, '\\$&')}%` : undefined;
    const rows = await this.sql<DatabaseRow[]>`
      SELECT * FROM users
      WHERE ${
        pattern == null
          ? this.sql`TRUE`
          : this.sql`(
        display_name ILIKE ${pattern} ESCAPE '\\'
        OR email ILIKE ${pattern} ESCAPE '\\'
      )`
      }
      ORDER BY display_name, id
      ${limit == null ? this.sql`` : this.sql`LIMIT ${limit}`}
    `;
    return mapDatabaseRows(rows, authMappers.user);
  }

  async createApiToken(input: ApiTokenDbCreate) {
    try {
      const [row] = await this.sql<DatabaseRow[]>`
        INSERT INTO api_token (id, workspace, name, token_hash, capabilities, created_by, created_at, last_used_at, expires_at)
        VALUES (
          ${input.id},
          ${input.workspace},
          ${input.name},
          ${input.token_hash},
          ${this.json(input.capabilities)},
          ${input.created_by},
          ${input.created_at},
          ${input.last_used_at ?? null},
          ${input.expires_at ?? null}
        )
        RETURNING *
      `;
      return authMappers.apiToken(row!);
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async listApiTokens(workspace: string, createdBy?: string) {
    const rows = await this.sql<DatabaseRow[]>`
      SELECT * FROM api_token
      WHERE workspace = ${workspace}
      ${createdBy != null ? this.sql`AND created_by = ${createdBy}` : this.sql``}
      ORDER BY created_at DESC, id DESC
    `;
    return mapDatabaseRows(rows, authMappers.apiToken);
  }

  async countApiTokens(workspace: string, createdBy: string) {
    const [row] = await this.sql<{ count: string }[]>`
      SELECT COUNT(*)::text AS count
      FROM api_token
      WHERE workspace = ${workspace} AND created_by = ${createdBy}
    `;
    return Number(row?.count ?? 0);
  }

  async listApiTokensByCreator(createdBy: string) {
    const rows = await this.sql<DatabaseRow[]>`
      SELECT * FROM api_token
      WHERE created_by = ${createdBy}
      ORDER BY workspace, created_at DESC, id DESC
    `;
    return mapDatabaseRows(rows, authMappers.apiToken);
  }

  async getApiTokenByHash(tokenHash: string) {
    const [row] = await this.sql<DatabaseRow[]>`
      SELECT * FROM api_token WHERE token_hash = ${tokenHash}
    `;
    return row ? authMappers.apiToken(row) : null;
  }

  async deleteApiToken(workspace: string, id: string, createdBy?: string) {
    try {
      const [row] = await this.sql<DatabaseRow[]>`
        DELETE FROM api_token
        WHERE workspace = ${workspace} AND id = ${id}
        ${createdBy != null ? this.sql`AND created_by = ${createdBy}` : this.sql``}
        RETURNING *
      `;
      return row ? authMappers.apiToken(row) : null;
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async deleteApiTokenByCreator(createdBy: string, id: string) {
    try {
      const [row] = await this.sql<DatabaseRow[]>`
        DELETE FROM api_token
        WHERE created_by = ${createdBy} AND id = ${id}
        RETURNING *
      `;
      return row ? authMappers.apiToken(row) : null;
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async updateApiTokenLastUsed(id: string, timestamp: Date) {
    try {
      await this.sql`
        UPDATE api_token SET last_used_at = ${timestamp} WHERE id = ${id}
      `;
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async createApiTokenAudit(input: Parameters<AuthDatabase['createApiTokenAudit']>[0]) {
    try {
      const [row] = await this.sql<DatabaseRow[]>`
        INSERT INTO api_token_audit (id, workspace, token_id, user_id, event, created_at, metadata)
        VALUES (
          ${input.id},
          ${input.workspace},
          ${input.token_id},
          ${input.user_id},
          ${input.event},
          ${input.created_at},
          ${this.json(input.metadata)}
        )
        RETURNING *
      `;
      return authMappers.apiTokenAudit(row!);
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async listApiTokenAudit(workspace: string) {
    const rows = await this.sql<DatabaseRow[]>`
      SELECT * FROM api_token_audit
      WHERE workspace = ${workspace}
      ORDER BY created_at DESC, id DESC
    `;
    return mapDatabaseRows(rows, authMappers.apiTokenAudit);
  }

  async listGlobalRoleAssignments(userId?: string) {
    if (userId) {
      const rows = await this.sql<DatabaseRow[]>`
        SELECT user_id, role, created_at
        FROM global_role_assignment
        WHERE user_id = ${userId}
        ORDER BY role
      `;
      return mapDatabaseRows(rows, authMappers.globalRoleAssignment);
    }

    const rows = await this.sql<DatabaseRow[]>`
      SELECT user_id, role, created_at
      FROM global_role_assignment
      ORDER BY user_id, role
    `;
    return mapDatabaseRows(rows, authMappers.globalRoleAssignment);
  }

  async replaceGlobalRoleAssignments(userId: string, roles: GlobalRole[], createdAt: Date) {
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
      return normalizePostgresError(error);
    }
  }

  async storeOidcAuthState(state: string, nonce: string, codeVerifier: string, expiresAt: Date) {
    try {
      await this.sql`
        INSERT INTO oidc_auth_state (state, nonce, code_verifier, expires_at)
        VALUES (${state}, ${nonce}, ${codeVerifier}, ${expiresAt})
      `;
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async getOidcAuthState(state: string) {
    const [row] = await this.sql<{ nonce: string; code_verifier: string }[]>`
      SELECT nonce, code_verifier
      FROM oidc_auth_state
      WHERE state = ${state}
    `;
    return row ?? null;
  }

  async deleteOidcAuthState(state: string) {
    try {
      await this.sql`
        DELETE FROM oidc_auth_state WHERE state = ${state}
      `;
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async cleanupExpiredOidcAuthStates() {
    try {
      await this.sql`
        DELETE FROM oidc_auth_state WHERE expires_at < ${new Date()}
      `;
    } catch (error) {
      return normalizePostgresError(error);
    }
  }
}
