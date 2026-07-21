import { databaseDate, parseDatabaseJson, type DatabaseRow } from '../../../db/rowMappers';

export type AuditLogDbResult = {
  id: string;
  workspace: string;
  timestamp: Date;
  user_id: string | null;
  user_display_name: string | null;
  operation: AuditOperation;
  entity_type: AuditEntityType;
  entity_id: string;
  entity_name: string;
  entity_slug: string | null;
  schema_id: string | null;
  changes: {
    old?: Record<string, unknown>;
    new?: Record<string, unknown>;
  };
  metadata: Record<string, unknown>;
};

export type AuditLogDbCreate = Omit<AuditLogDbResult, 'id' | 'user_display_name'>;

export type AuditOperation = 'create' | 'update' | 'delete';

export type AuditEntityType =
  | 'workspace'
  | 'entity_schema'
  | 'entity'
  | 'project'
  | 'content_node'
  | 'assessment'
  | 'assessment_response'
  | 'project_milestone'
  // A note recorded by an automation rule's `create_audit_note` action. Written directly via
  // `db.audit.createAuditLog`, never through `writeAudit`, so it does not re-trigger webhook
  // delivery, watcher notifications, or another round of automation rule evaluation.
  | 'automation_note';

export const AUDIT_LOG_SELECT_SQL = `
  SELECT audit_log.*, users.display_name as user_display_name
  FROM audit_log
  LEFT JOIN users ON audit_log.user_id = users.id
`;

export const auditMappers = {
  auditLog: (row: DatabaseRow): AuditLogDbResult => ({
    id: String(row['id']),
    workspace: String(row['workspace']),
    timestamp: databaseDate(row['timestamp']),
    user_id: row['user_id'] == null ? null : String(row['user_id']),
    user_display_name: row['user_display_name'] == null ? null : String(row['user_display_name']),
    operation: row['operation'] as AuditLogDbResult['operation'],
    entity_type: row['entity_type'] as AuditLogDbResult['entity_type'],
    entity_id: String(row['entity_id']),
    entity_name: String(row['entity_name']),
    entity_slug: row['entity_slug'] == null ? null : String(row['entity_slug']),
    schema_id: row['schema_id'] == null ? null : String(row['schema_id']),
    changes: parseDatabaseJson(row['changes'], {}, 'audit_log.changes'),
    metadata: parseDatabaseJson(row['metadata'], {}, 'audit_log.metadata')
  })
};

export type AuditDatabase = {
  listAuditLogs(ws: string): Promise<AuditLogDbResult[]>;
  createAuditLog(input: AuditLogDbCreate): Promise<AuditLogDbResult>;
};
