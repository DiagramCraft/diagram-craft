import type { AuditDatabase, AuditLogDbCreate } from './auditDatabase';
import { AUDIT_LOG_SELECT_SQL, auditMappers } from './auditDatabase';
import { normalizePostgresError, PostgresDatabaseBase } from '../../../db/postgresBase';

export class PostgresAuditDatabase extends PostgresDatabaseBase implements AuditDatabase {
  async listAuditLogs(workspace: string) {
    const rows = await this.sql.unsafe<Record<string, unknown>[]>(
      `${AUDIT_LOG_SELECT_SQL} WHERE audit_log.workspace = $1 ORDER BY audit_log.timestamp DESC`,
      [workspace]
    );
    return rows.map(auditMappers.auditLog);
  }

  async createAuditLog(input: AuditLogDbCreate) {
    try {
      const [inserted] = await this.sql<{ id: string }[]>`
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
        RETURNING id
      `;
      const [row] = await this.sql.unsafe<Record<string, unknown>[]>(
        `${AUDIT_LOG_SELECT_SQL} WHERE audit_log.id = $1`,
        [inserted!.id]
      );
      return auditMappers.auditLog(row!);
    } catch (error) {
      return normalizePostgresError(error);
    }
  }
}
