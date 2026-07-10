import { newid } from '@diagram-craft/utils/id';
import type { AuditDatabase, AuditLogDbCreate } from './auditDatabase';
import { SqliteDatabaseBase, sqliteMappers } from '../../../db/sqliteBase';

export class SqliteAuditDatabase extends SqliteDatabaseBase implements AuditDatabase {
  async listAuditLogs(workspace: string) {
    return this.all(
      `SELECT 
        audit_log.*,
        users.display_name as user_display_name
      FROM audit_log
      LEFT JOIN users ON audit_log.user_id = users.id
      WHERE audit_log.workspace = ?
      ORDER BY audit_log.timestamp DESC`,
      [workspace],
      sqliteMappers.auditLog
    );
  }

  async createAuditLog(input: AuditLogDbCreate) {
    const id = newid();
    this.run(
      'INSERT INTO audit_log (id, workspace, timestamp, user_id, operation, entity_type, entity_id, entity_name, entity_slug, schema_id, changes, metadata) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        id,
        input.workspace,
        input.timestamp.toISOString(),
        input.user_id,
        input.operation,
        input.entity_type,
        input.entity_id,
        input.entity_name,
        input.entity_slug,
        input.schema_id,
        JSON.stringify(input.changes),
        JSON.stringify(input.metadata)
      ]
    );
    return (await this.get(
      `SELECT
        audit_log.*,
        users.display_name as user_display_name
      FROM audit_log
      LEFT JOIN users ON audit_log.user_id = users.id
      WHERE audit_log.id = ?`,
      [id],
      sqliteMappers.auditLog
    ))!;
  }
}
