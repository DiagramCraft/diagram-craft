import {
  databaseDate,
  databaseEnum,
  parseDatabaseJsonWithGuard,
  type DatabaseRow
} from '../../../db/rowMappers';

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
  dedupe_key?: string | null;
};

export type AuditLogDbCreate = Omit<AuditLogDbResult, 'id' | 'user_display_name'>;

export type AuditOperation = 'create' | 'update' | 'delete';

export type AuditLogSummaryDbResult = Pick<
  AuditLogDbResult,
  'timestamp' | 'operation' | 'entity_type'
>;

export type AuditLogListOptions = {
  entityType?: string;
  entityId?: string;
  entityIds?: string[];
  schemaId?: string;
  operation?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
};

export type AuditEntityType =
  | 'workspace'
  | 'workspace_enum'
  | 'entity_schema'
  | 'workspace_field_group'
  | 'entity'
  | 'project'
  | 'content_node'
  | 'assessment'
  | 'assessment_response'
  | 'project_milestone'
  | 'relation_schema'
  | 'relation'
  // A note recorded by an automation rule's `create_audit_note` action. Written directly via
  // `db.audit.createAuditLog`, never through `writeAudit`, so it does not re-trigger webhook
  // delivery, watcher notifications, or another round of automation rule evaluation.
  | 'automation_note';

const AUDIT_OPERATIONS = [
  'create',
  'update',
  'delete'
] as const satisfies readonly AuditOperation[];
const AUDIT_ENTITY_TYPES = [
  'workspace',
  'workspace_enum',
  'entity_schema',
  'workspace_field_group',
  'entity',
  'project',
  'content_node',
  'assessment',
  'assessment_response',
  'project_milestone',
  'relation_schema',
  'relation',
  'automation_note'
] as const satisfies readonly AuditEntityType[];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const isAuditChanges = (value: unknown): value is AuditLogDbResult['changes'] =>
  isRecord(value) &&
  (value.old === undefined || isRecord(value.old)) &&
  (value.new === undefined || isRecord(value.new));

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
    operation: databaseEnum(row['operation'], AUDIT_OPERATIONS, 'audit_log.operation'),
    entity_type: databaseEnum(row['entity_type'], AUDIT_ENTITY_TYPES, 'audit_log.entity_type'),
    entity_id: String(row['entity_id']),
    entity_name: String(row['entity_name']),
    entity_slug: row['entity_slug'] == null ? null : String(row['entity_slug']),
    schema_id: row['schema_id'] == null ? null : String(row['schema_id']),
    changes: parseDatabaseJsonWithGuard(row['changes'], {}, 'audit_log.changes', isAuditChanges),
    metadata: parseDatabaseJsonWithGuard(row['metadata'], {}, 'audit_log.metadata', isRecord),
    dedupe_key: row['dedupe_key'] == null ? null : String(row['dedupe_key'])
  }),
  auditLogSummary: (row: DatabaseRow): AuditLogSummaryDbResult => ({
    timestamp: databaseDate(row['timestamp']),
    operation: databaseEnum(row['operation'], AUDIT_OPERATIONS, 'audit_log.operation'),
    entity_type: databaseEnum(row['entity_type'], AUDIT_ENTITY_TYPES, 'audit_log.entity_type')
  })
};

export type AuditDatabase = {
  /**
   * Returns raw, unredacted rows, including restricted field-group values in `changes`.
   * Only `listAuditLog` (auditOperations.ts) may call this for API entries, and it must always
   * redact via `redactAuditEntryChanges` before returning. Aggregate consumers should use
   * `listAuditLogSummaries` instead. Enforced by `auditAccessBoundary.test.ts`.
   */
  listAuditLogs(ws: string, options?: AuditLogListOptions): Promise<AuditLogDbResult[]>;
  /** Returns only fields needed by aggregate activity views, without loading JSON payloads. */
  listAuditLogSummaries(ws: string, since?: Date): Promise<AuditLogSummaryDbResult[]>;
  getAuditLog(ws: string, id: string): Promise<AuditLogDbResult | null>;
  /** Creates an entry, or returns the existing entry when `dedupe_key` is already present. */
  createAuditLog(input: AuditLogDbCreate): Promise<AuditLogDbResult>;
};
