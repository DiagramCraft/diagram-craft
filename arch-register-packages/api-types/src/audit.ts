// ── Audit Log Types ───────────────────────────────────────────

export type AuditOperation = 'create' | 'update' | 'delete';

export type AuditEntityType = 'workspace' | 'entity_schema' | 'entity' | 'project' | 'project_file';

export type AuditLogEntry = {
  id: string;
  workspace: string;
  timestamp: string;
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

export type AuditStats = {
  total: number;
  byOperation: Array<{ operation: string; count: number }>;
  byEntityType: Array<{ entity_type: string; count: number }>;
  recentActivity: Array<{ date: string; count: number }>;
};
