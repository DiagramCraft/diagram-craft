CREATE TABLE workspace_schema_settings (
  workspace TEXT PRIMARY KEY REFERENCES workspace(id) ON DELETE CASCADE,
  schema_change_mode TEXT NOT NULL DEFAULT 'direct' CHECK (schema_change_mode IN ('direct', 'draft')),
  updated_at TEXT NOT NULL,
  updated_by TEXT REFERENCES users(id) ON DELETE SET NULL
);
