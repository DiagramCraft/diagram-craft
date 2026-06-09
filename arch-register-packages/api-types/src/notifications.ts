export type WatchedEntity = {
  entity_id: string;
  entity_name: string;
  entity_slug: string;
  schema_id: string;
  created_at: string;
};

export type PinnedEntity = {
  entity_id: string;
  entity_name: string;
  entity_slug: string;
  schema_id: string;
  created_at: string;
};

export type NotificationItem = {
  id: string;
  entity_id: string;
  entity_name: string;
  entity_slug: string;
  schema_id: string | null;
  operation: 'create' | 'update' | 'delete';
  changed_by_user_id: string;
  changed_by_display_name: string;
  timestamp: string;
  created_at: string;
  audit_log_id: string;
};

export type NotificationCount = {
  count: number;
};
