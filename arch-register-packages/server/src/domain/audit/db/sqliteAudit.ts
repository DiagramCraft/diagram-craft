import { newid } from '@diagram-craft/utils/id';
import type { AuditDatabase, AuditLogDbCreate, AuditLogListOptions } from './auditDatabase';
import { AUDIT_LOG_SELECT_SQL, auditMappers } from './auditDatabase';
import { SqliteDatabaseBase } from '../../../db/sqliteBase';

export class SqliteAuditDatabase extends SqliteDatabaseBase implements AuditDatabase {
  async listAuditLogs(workspace: string, options: AuditLogListOptions = {}) {
    const conditions = ['audit_log.workspace = ?'];
    const params: unknown[] = [workspace];
    if (options.entityType) {
      conditions.push('audit_log.entity_type = ?');
      params.push(options.entityType);
    }
    if (options.entityId) {
      conditions.push('audit_log.entity_id = ?');
      params.push(options.entityId);
    }
    if (options.entityIds) {
      if (options.entityIds.length === 0) return [];
      conditions.push(`audit_log.entity_id IN (${options.entityIds.map(() => '?').join(', ')})`);
      params.push(...options.entityIds);
    }
    if (options.schemaId) {
      conditions.push('audit_log.schema_id = ?');
      params.push(options.schemaId);
    }
    if (options.operation) {
      conditions.push('audit_log.operation = ?');
      params.push(options.operation);
    }
    if (options.startDate) {
      conditions.push('audit_log.timestamp >= ?');
      params.push(options.startDate.toISOString());
    }
    if (options.endDate) {
      conditions.push('audit_log.timestamp <= ?');
      params.push(options.endDate.toISOString());
    }
    if (options.limit != null) params.push(options.limit, options.offset ?? 0);

    return this.all(
      `${AUDIT_LOG_SELECT_SQL}
      WHERE ${conditions.join(' AND ')}
      ORDER BY audit_log.timestamp DESC, audit_log.id DESC
      ${options.limit == null ? '' : 'LIMIT ? OFFSET ?'}`,
      params,
      auditMappers.auditLog
    );
  }

  async listAuditLogSummaries(workspace: string, since?: Date) {
    return this.all(
      `SELECT timestamp, operation, entity_type
       FROM audit_log
       WHERE workspace = ?${since ? ' AND timestamp >= ?' : ''}
       ORDER BY timestamp DESC, id DESC`,
      since ? [workspace, since.toISOString()] : [workspace],
      auditMappers.auditLogSummary
    );
  }

  async getAuditLog(workspace: string, id: string) {
    return this.get(
      `${AUDIT_LOG_SELECT_SQL}
      WHERE audit_log.workspace = ? AND audit_log.id = ?`,
      [workspace, id],
      auditMappers.auditLog
    );
  }

  async createAuditLog(input: AuditLogDbCreate) {
    const id = newid();
    this.run(
      `INSERT INTO audit_log
       (id, workspace, timestamp, user_id, operation, entity_type, entity_id, entity_name,
        entity_slug, schema_id, changes, metadata, dedupe_key)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT DO NOTHING`,
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
        JSON.stringify(input.metadata),
        input.dedupe_key ?? null
      ]
    );
    return (await this.get(
      `${AUDIT_LOG_SELECT_SQL}
      WHERE audit_log.id = ?
         OR (audit_log.workspace = ? AND ? IS NOT NULL AND audit_log.dedupe_key = ?)`,
      [id, input.workspace, input.dedupe_key ?? null, input.dedupe_key ?? null],
      auditMappers.auditLog
    ))!;
  }
}
