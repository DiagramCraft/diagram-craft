import type { CreateUserInput, IdentityAuthDatabase, UpdateUserInput } from './database';
import {
  normalizePostgresError,
  PostgresDatabaseBase,
  type PostgresRowTypes
} from './postgresBase';
import type { GlobalRole } from '../types';

export class PostgresIdentityAuthDatabase
  extends PostgresDatabaseBase
  implements IdentityAuthDatabase
{
  async getUser(id: string) {
    const [row] = await this.sql<PostgresRowTypes['user'][]>`
      SELECT * FROM users WHERE id = ${id}
    `;
    return row ?? null;
  }

  async getUserByEmail(email: string) {
    const [row] = await this.sql<PostgresRowTypes['user'][]>`
      SELECT * FROM users WHERE email = ${email}
    `;
    return row ?? null;
  }

  async getUserByOidc(issuer: string, subject: string) {
    const [row] = await this.sql<PostgresRowTypes['user'][]>`
      SELECT * FROM users
      WHERE oidc_issuer = ${issuer} AND oidc_subject = ${subject}
    `;
    return row ?? null;
  }

  async createUser(input: CreateUserInput) {
    try {
      const [row] = await this.sql<PostgresRowTypes['user'][]>`
        INSERT INTO users (id, email, display_name, auth_provider, password_hash, oidc_issuer, oidc_subject, is_active, color, created_at, updated_at, last_login_at)
        VALUES (
          ${input.id},
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
      return row!;
    } catch (error) {
      return normalizePostgresError(error);
    }
  }

  async updateUser(id: string, input: UpdateUserInput) {
    try {
      const sets: Record<string, unknown> = { updated_at: input.updated_at };

      if (input.email !== undefined) sets.email = input.email;
      if (input.display_name !== undefined) sets.display_name = input.display_name;
      if (input.password_hash !== undefined) sets.password_hash = input.password_hash;
      if (input.is_active !== undefined) sets.is_active = input.is_active;
      if (input.color !== undefined) sets.color = input.color;

      const [row] = await this.sql<PostgresRowTypes['user'][]>`
        UPDATE users
        SET ${this.sql(sets)}
        WHERE id = ${id}
        RETURNING *
      `;
      return row ?? null;
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

  async listUsers() {
    return await this.sql<PostgresRowTypes['user'][]>`
      SELECT * FROM users ORDER BY display_name
    `;
  }

  async listGlobalRoleAssignments(userId?: string) {
    if (userId) {
      return await this.sql<PostgresRowTypes['globalRoleAssignment'][]>`
        SELECT user_id, role, created_at
        FROM global_role_assignment
        WHERE user_id = ${userId}
        ORDER BY role
      `;
    }

    return await this.sql<PostgresRowTypes['globalRoleAssignment'][]>`
      SELECT user_id, role, created_at
      FROM global_role_assignment
      ORDER BY user_id, role
    `;
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
