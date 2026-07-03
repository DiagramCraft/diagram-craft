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
  | 'assessment';

export type AuditDatabase = {
  listAuditLogs(ws: string): Promise<AuditLogDbResult[]>;
  createAuditLog(input: AuditLogDbCreate): Promise<AuditLogDbResult>;
};
