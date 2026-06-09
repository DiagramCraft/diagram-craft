import type { AuditDatabase, AuditLogDbCreate } from './auditDatabase';
import { normalizePostgresError, PostgresDatabaseBase } from '../../../db/postgresBase';
import { AuditLogDbResult } from './auditDatabase';

export class PostgresAuditDatabase extends PostgresDatabaseBase implements AuditDatabase {
  async listAuditLogs(workspace: string) {
    return await this.sql<AuditLogDbResult[]>`
      SELECT *
      FROM audit_log
      WHERE workspace = ${workspace}
      ORDER BY timestamp DESC
    `;
  }

  async createAuditLog(input: AuditLogDbCreate) {
    try {
      const [row] = await this.sql<AuditLogDbResult[]>`
        INSERT INTO audit_log (id, workspace, timestamp, user_id, operation, entity_type, entity_id, entity_name, entity_slug, schema_id, changes, metadata)
        VALUES (
          gen_random_uuid(),
          ${input.workspace},
          ${input.timestamp},
          ${input.user_id},
          ${input.operation},
          ${input.entity_type},
          ${input.entity_id},
          ${input.entity_name},
          ${input.entity_slug},
          ${input.schema_id},
          ${this.json(input.changes)},
          ${this.json(input.metadata)}
        )
        RETURNING *
      `;
      return row!;
    } catch (error) {
      return normalizePostgresError(error);
    }
  }
}
