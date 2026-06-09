export type AuditLogEntryRow = {
  id: string;
  workspace: string;
  timestamp: Date;
  user_id: string | null;
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

export type AuditOperation = 'create' | 'update' | 'delete';

export type AuditEntityType = 'workspace' | 'entity_schema' | 'entity' | 'project' | 'project_file';

export type CreateAuditLogInput = Omit<AuditLogEntryRow, 'id'>;

export type AuditDatabase = {
  listAuditLogs(ws: string): Promise<AuditLogEntryRow[]>;
  createAuditLog(input: CreateAuditLogInput): Promise<AuditLogEntryRow>;
};
