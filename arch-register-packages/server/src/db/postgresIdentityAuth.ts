import type {
  CreateUserInput,
  IdentityAuthDatabase,
  UpdateUserInput
} from './database.js';
import { normalizePostgresError, PostgresDatabaseBase, type PostgresRowTypes } from './postgresBase.js';
import type { GlobalRole } from '../types.js';

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
        INSERT INTO users (id, email, display_name, auth_provider, password_hash, oidc_issuer, oidc_subject, is_active, created_at, updated_at, last_login_at)
        VALUES (
          ${input.id},
          ${input.email},
          ${input.display_name},
          ${input.auth_provider},
          ${input.password_hash},
          ${input.oidc_issuer},
          ${input.oidc_subject},
          ${input.is_active},
          ${input.created_at},
          ${input.updated_at},
          ${input.last_login_at}
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
}
