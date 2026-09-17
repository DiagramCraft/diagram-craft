import type {
  AuditDatabase,
  AuditLogDbCreate,
  AuditLogListOptions
} from './auditDatabase';
import { AUDIT_LOG_SELECT_SQL, auditMappers } from './auditDatabase';
import { normalizePostgresError, PostgresDatabaseBase } from '../../../db/postgresBase';

export class PostgresAuditDatabase extends PostgresDatabaseBase implements AuditDatabase {
  async listAuditLogs(workspace: string, options: AuditLogListOptions = {}) {
    const conditions = ['audit_log.workspace = $1'];
    const params: (string | Date | number)[] = [workspace];
    const addParam = (value: string | Date | number) => {
      params.push(value);
      return `$${params.length}`;
    };
    if (options.entityType) conditions.push(`audit_log.entity_type = ${addParam(options.entityType)}`);
    if (options.entityId) conditions.push(`audit_log.entity_id = ${addParam(options.entityId)}`);
    if (options.entityIds) {
      if (options.entityIds.length === 0) return [];
      conditions.push(
        `audit_log.entity_id IN (${options.entityIds.map(entityId => addParam(entityId)).join(', ')})`
      );
    }
    if (options.schemaId) conditions.push(`audit_log.schema_id = ${addParam(options.schemaId)}`);
    if (options.operation) conditions.push(`audit_log.operation = ${addParam(options.operation)}`);
    if (options.startDate) conditions.push(`audit_log.timestamp >= ${addParam(options.startDate)}`);
    if (options.endDate) conditions.push(`audit_log.timestamp <= ${addParam(options.endDate)}`);
    const pagination =
      options.limit == null
        ? ''
        : ` LIMIT ${addParam(options.limit)} OFFSET ${addParam(options.offset ?? 0)}`;

    const rows = await this.sql.unsafe<Record<string, unknown>[]>(
      `${AUDIT_LOG_SELECT_SQL} WHERE ${conditions.join(' AND ')} ORDER BY audit_log.timestamp DESC, audit_log.id DESC${pagination}`,
      params
    );
    return rows.map(auditMappers.auditLog);
  }

  async listAuditLogSummaries(workspace: string, since?: Date) {
    const params: (string | Date)[] = [workspace];
    if (since) params.push(since);
    const rows = await this.sql.unsafe<Record<string, unknown>[]>(
      `SELECT timestamp, operation, entity_type
       FROM audit_log
       WHERE workspace = $1${since ? ' AND timestamp >= $2' : ''}
       ORDER BY timestamp DESC, id DESC`,
      params
    );
    return rows.map(auditMappers.auditLogSummary);
  }

  async getAuditLog(workspace: string, id: string) {
    const rows = await this.sql.unsafe<Record<string, unknown>[]>(
      `${AUDIT_LOG_SELECT_SQL} WHERE audit_log.workspace = $1 AND audit_log.id = $2`,
      [workspace, id]
    );
    return rows[0] ? auditMappers.auditLog(rows[0]) : null;
  }

  async createAuditLog(input: AuditLogDbCreate) {
    try {
      const [inserted] = await this.sql<{ id: string }[]>`
        INSERT INTO audit_log (id, workspace, timestamp, user_id, operation, entity_type, entity_id, entity_name, entity_slug, schema_id, changes, metadata, dedupe_key)
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
          ${this.json(input.metadata)},
          ${input.dedupe_key ?? null}
        )
        ON CONFLICT DO NOTHING
        RETURNING id
      `;
      const [row] = await this.sql.unsafe<Record<string, unknown>[]>(
        inserted
          ? `${AUDIT_LOG_SELECT_SQL} WHERE audit_log.id = $1`
          : `${AUDIT_LOG_SELECT_SQL} WHERE audit_log.workspace = $1 AND audit_log.dedupe_key = $2`,
        inserted ? [inserted.id] : [input.workspace, input.dedupe_key ?? null]
      );
      return auditMappers.auditLog(row!);
    } catch (error) {
      return normalizePostgresError(error);
    }
  }
}
